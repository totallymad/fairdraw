import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, closeDb } from './db/database.js';
import drawsRouter from './routes/draws.js';
import authRouter from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || 'fairdraw-dev-secret-change-in-production';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.drand.sh"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Слишком много запросов, попробуйте позже' },
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток входа' },
});
app.use('/api/auth/login', authLimiter);

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session
const isHttps = process.env.USE_HTTPS === 'true' || process.env.CORS_ORIGIN?.startsWith('https://');
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isHttps,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  }
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/draws', drawsRouter);

// Serve frontend in production
const frontendPath = path.join(__dirname, '../../dist');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  closeDb();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing database...');
  closeDb();
  process.exit(0);
});

// Start server
async function start() {
  // Диагностика переменных окружения
  console.log('=== Диагностика конфигурации ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);
  console.log(`PORT: ${PORT}`);
  console.log(`DB_PATH: ${process.env.DB_PATH || 'не установлен'}`);
  console.log(`ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ установлен' : '✗ НЕ УСТАНОВЛЕН!'}`);
  console.log(`SESSION_SECRET: ${process.env.SESSION_SECRET ? '✓ установлен' : '⚠ используется default'}`);
  console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
  console.log('================================');
  
  if (!process.env.ADMIN_PASSWORD) {
    console.error('⚠️  ВНИМАНИЕ: ADMIN_PASSWORD не установлен! Авторизация не будет работать.');
    console.error('Добавьте ADMIN_PASSWORD=ваш_пароль в файл .env');
  }
  
  // Run migrations
  console.log('Initializing database...');
  await runMigrations();
  console.log('Database ready.');
  
  app.listen(PORT, () => {
    console.log(`FairDraw server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
