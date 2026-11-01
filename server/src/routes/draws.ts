import { Router, Request, Response } from 'express';
import { getDb } from '../db/database.js';
import { sha256, canonicalParticipants, determineWinner } from '../lib/crypto.js';
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
      SELECT * FROM draws 
      ORDER BY created_at DESC
    `).all() as any[];
    
    // Добавляем participants к каждому розыгрышу
    const drawsWithParticipants = draws.map(draw => {
      const participants = db.prepare(
        'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
      ).all(draw.id);
      return { ...draw, participants };
    });
    
    res.json(drawsWithParticipants);
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
    db.transaction(() => {
      db.prepare('DELETE FROM participants WHERE draw_id = ?').run(req.params.id);
      participants.forEach((p: { name: string; vk_url?: string }, i: number) => {
        const pId = crypto.randomBytes(6).toString('hex');
        db.prepare(
          'INSERT INTO participants (id, draw_id, name, vk_url, position) VALUES (?, ?, ?, ?, ?)'
        ).run(pId, req.params.id, p.name.trim(), p.vk_url?.trim() || null, i + 1);
      });
    });
    
    const updatedParticipants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id);
    
    res.json({ participants: updatedParticipants });
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/draws/:id/finalize - Finalize draw (lock participants)
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
    
    // Calculate hash of participants list
    const canonical = canonicalParticipants(participants);
    const hash = sha256(canonical);
    
    db.prepare(`
      UPDATE draws 
      SET status = 'finalized', 
          participants_hash = ?,
          finalized_at = datetime('now')
      WHERE id = ?
    `).run(hash, req.params.id);
    
    const updated = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
    const finalParticipants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id);
    
    res.json({ ...updated, participants: finalParticipants });
  } catch (error) {
    console.error('Error finalizing draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/draws/:id/execute - Execute draw (pick winner)
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
    
    // Get participants
    const participants = db.prepare(
      'SELECT * FROM participants WHERE draw_id = ? ORDER BY position'
    ).all(req.params.id) as any[];
    
    if (participants.length < 2) {
      return res.status(400).json({ error: 'Недостаточно участников' });
    }
    
    // Pick winner using cryptographically secure random
    const winnerIndex = determineWinner(participants.length);
    const winner = participants[winnerIndex];
    
    // Generate random seed for transparency
    const randomSeed = crypto.randomBytes(32).toString('hex');
    
    // Save result
    db.prepare(`
      UPDATE draws 
      SET status = 'completed',
          randomness = ?,
          winner_id = ?,
          completed_at = datetime('now')
      WHERE id = ?
    `).run(randomSeed, winner.id, req.params.id);
    
    const updated = db.prepare('SELECT * FROM draws WHERE id = ?').get(req.params.id);
    
    res.json({ ...updated, participants, winner });
  } catch (error) {
    console.error('Error executing draw:', error);
    
    // Mark as failed
    try {
      const db = await getDb();
      db.prepare("UPDATE draws SET status = 'failed' WHERE id = ?").run(req.params.id);
    } catch {}
    
    res.status(500).json({ error: 'Ошибка при проведении розыгрыша' });
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
    
    const winner = participants.find((p: any) => p.id === draw.winner_id);
    
    res.json({
      valid: hashMatches,
      hash_matches: hashMatches,
      participants_count: participants.length,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        position: winner.position,
      } : null,
      verification: {
        participants_hash: draw.participants_hash,
        recalculated_hash: recalculatedHash,
        randomness: draw.randomness,
      }
    });
  } catch (error) {
    console.error('Error verifying draw:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
