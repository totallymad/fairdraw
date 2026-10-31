import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { sha256, canonicalParticipants, determineWinner } from '../lib/crypto.js';
import { getCurrentRound, fetchDrandRandomness, verifyDrandSignature, getRoundTime, DRAND_CHAIN } from '../lib/drand.js';
import crypto from 'crypto';

const router = Router();

// Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (req.session && (req.session as any).authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Требуется авторизация' });
}

// GET /api/draws - List all draws
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draws = db.prepare(`
      SELECT d.*, 
        (SELECT COUNT(*) as count FROM participants WHERE draw_id = d.id) as participant_count
      FROM draws d 
      ORDER BY d.created_at DESC
    `).all();
    
    res.json(draws);
  } catch (error) {
    console.error('Error listing draws:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/draws - Create a new draw
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Название обязательно' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Название слишком длинное (макс. 200 символов)' });
    }
    if (description && typeof description !== 'string') {
      return res.status(400).json({ error: 'Описание должно быть строкой' });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ error: 'Описание слишком длинное (макс. 2000 символов)' });
    }
    
    const id = crypto.randomBytes(6).toString('hex');
    const db = await getDb();
    
    db.prepare(`
      INSERT INTO draws (id, title, description, status) 
      VALUES (?, ?, ?, 'draft')
    `).run(id, title.trim(), (description || '').trim());
    
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(id);
    res.status(201).json(draw);
  } catch (error) {
    console.error('Error creating draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/draws/:id - Get draw details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
    
    if (!draw) {
      return res.status(404).json({ error: 'Розыгрыш не найден' });
    }
    
    const participants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id);
    
    res.json({ ...draw, participants });
  } catch (error) {
    console.error('Error getting draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/draws/:id/participants - Update participants (only in draft)
router.put('/:id/participants', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id) as any;
    
    if (!draw) {
      return res.status(404).json({ error: 'Розыгрыш не найден' });
    }
    if (draw.status !== 'draft') {
      return res.status(400).json({ error: 'Нельзя изменить участников после фиксации' });
    }
    
    const { participants } = req.body;
    if (!Array.isArray(participants)) {
      return res.status(400).json({ error: 'participants должен быть массивом' });
    }
    
    // Validate each participant
    for (const p of participants) {
      if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
        return res.status(400).json({ error: 'Имя участника обязательно' });
      }
      if (p.name.length > 100) {
        return res.status(400).json({ error: 'Имя участника слишком длинное' });
      }
      if (p.vk_url && typeof p.vk_url !== 'string') {
        return res.status(400).json({ error: 'vk_url должен быть строкой' });
      }
      if (p.vk_url && p.vk_url.length > 500) {
        return res.status(400).json({ error: 'vk_url слишком длинный' });
      }
    }
    
    // Replace all participants
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM participants WHERE draw_id = ?').run(req.params.id);
      participants.forEach((p: { name: string; vk_url?: string }, i: number) => {
        const pId = crypto.randomBytes(6).toString('hex');
        db.prepare(
          'INSERT INTO participants (id, draw_id, name, vk_url, position) VALUES (?, ?, ?, ?, ?)'
        ).run(pId, req.params.id, p.name.trim(), p.vk_url?.trim() || null, i + 1);
      });
    });
    
    transaction();
    
    const updatedParticipants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id);
    
    res.json({ participants: updatedParticipants });
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/draws/:id/finalize - Finalize draw and select drand round
router.post('/:id/finalize', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id) as any;
    
    if (!draw) {
      return res.status(404).json({ error: 'Розыгрыш не найден' });
    }
    if (draw.status !== 'draft') {
      return res.status(400).json({ error: 'Розыгрыш уже зафиксирован' });
    }
    
    const participants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id) as any[];
    
    if (participants.length < 2) {
      return res.status(400).json({ error: 'Минимум 2 участника для розыгрыша' });
    }
    
    // Calculate hash
    const canonical = canonicalParticipants(participants);
    const hash = sha256(canonical);
    
    // Select future round (5 rounds ahead, ~15 seconds for Quicknet)
    const currentRound = getCurrentRound();
    const targetRound = currentRound + 5;
    
    db.prepare(`
      UPDATE draws 
      SET status = 'finalized', 
          participants_hash = ?, 
          drand_chain_hash = ?, 
          drand_round = ?,
          finalized_at = datetime('now')
      WHERE id = ?
    `).run(hash, DRAND_CHAIN.hash, targetRound, req.params.id);
    
    const updated = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Error finalizing draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/draws/:id/execute - Get randomness and determine winner
router.post('/:id/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id) as any;
    
    if (!draw) {
      return res.status(404).json({ error: 'Розыгрыш не найден' });
    }
    if (draw.status !== 'finalized') {
      return res.status(400).json({ error: 'Розыгрыш должен быть зафиксирован' });
    }
    
    // Check if round time has passed
    const roundTime = getRoundTime(draw.drand_round);
    if (new Date() < roundTime) {
      return res.status(400).json({ 
        error: 'Раунд ещё не наступил',
        round_time: roundTime.toISOString()
      });
    }
    
    // Fetch randomness from drand
    const beacon = await fetchDrandRandomness(draw.drand_round);
    
    // Verify signature
    const isValid = await verifyDrandSignature(beacon);
    if (!isValid) {
      db.prepare("UPDATE draws SET status = 'failed' WHERE id = ?").run(req.params.id);
      return res.status(500).json({ error: 'Не удалось верифицировать подпись drand' });
    }
    
    // Get participants count
    const participants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id) as any[];
    
    // Determine winner
    const winnerIndex = determineWinner(beacon.randomness, participants.length);
    const winner = participants[winnerIndex];
    
    // Save result
    db.prepare(`
      UPDATE draws 
      SET status = 'completed',
          randomness = ?,
          signature = ?,
          winner_id = ?,
          completed_at = datetime('now')
      WHERE id = ?
    `).run(beacon.randomness, beacon.signature, winner.id, req.params.id);
    
    const updated = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
    res.json({ ...updated, winner });
  } catch (error) {
    console.error('Error executing draw:', error);
    
    // Mark as failed
    try {
      const db = await getDb();
      db.prepare("UPDATE draws SET status = 'failed' WHERE id = ?").run(req.params.id);
    } catch {}
    
    res.status(500).json({ error: 'Ошибка при получении случайности' });
  }
});

// GET /api/draws/:id/verify - Verify draw result
router.get('/:id/verify', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id) as any;
    
    if (!draw) {
      return res.status(404).json({ error: 'Розыгрыш не найден' });
    }
    if (draw.status !== 'completed') {
      return res.status(400).json({ error: 'Розыгрыш ещё не завершён' });
    }
    
    const participants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id) as any[];
    
    // Re-calculate hash
    const canonical = canonicalParticipants(participants);
    const recalculatedHash = sha256(canonical);
    const hashMatches = recalculatedHash === draw.participants_hash;
    
    // Re-determine winner
    let winnerIndex = -1;
    let winnerValid = false;
    try {
      winnerIndex = determineWinner(draw.randomness, participants.length);
      const expectedWinner = participants[winnerIndex];
      winnerValid = expectedWinner.id === draw.winner_id;
    } catch {}
    
    const winner = participants.find((p: any) => p.id === draw.winner_id);
    
    res.json({
      valid: hashMatches && winnerValid,
      hash_matches: hashMatches,
      winner_valid: winnerValid,
      participants_count: participants.length,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        position: winner.position,
      } : null,
      verification: {
        participants_hash: draw.participants_hash,
        recalculated_hash: recalculatedHash,
        drand_chain_hash: draw.drand_chain_hash,
        drand_round: draw.drand_round,
        randomness: draw.randomness,
        signature: draw.signature,
        winner_index: winnerIndex,
      }
    });
  } catch (error) {
    console.error('Error verifying draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/login - Admin login
router.post('/auth/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return res.status(500).json({ error: 'Пароль администратора не настроен' });
  }
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Пароль обязателен' });
  }
  
  // Constant-time comparison to prevent timing attacks
  const provided = Buffer.from(password);
  const expected = Buffer.from(adminPassword);
  
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  
  (req.session as any).authenticated = true;
  res.json({ success: true });
});

// POST /api/auth/logout
router.post('/auth/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка выхода' });
    }
    res.json({ success: true });
  });
});

// GET /api/auth/status
router.get('/auth/status', (req: Request, res: Response) => {
  const authenticated = !!(req.session && (req.session as any).authenticated);
  res.json({ authenticated });
});

export default router;
