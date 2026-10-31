import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/login - Admin login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD не установлен в переменных окружения');
    return res.status(500).json({ error: 'Пароль администратора не настроен на сервере' });
  }
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Пароль обязателен' });
  }
  
  // Простое сравнение
  if (password !== adminPassword) {
    console.log('Попытка входа с неверным паролем');
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  
  console.log('Успешный вход администратора');
  (req.session as any).authenticated = true;
  res.json({ success: true });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка выхода' });
    }
    res.json({ success: true });
  });
});

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  const authenticated = !!(req.session && (req.session as any).authenticated);
  res.json({ authenticated });
});

export default router;
