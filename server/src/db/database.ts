import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'fairdraw.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function runMigrations(): void {
  const database = getDb();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS draws (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'finalized', 'completed', 'failed')),
      participants_hash TEXT,
      drand_chain_hash TEXT,
      drand_round INTEGER,
      randomness TEXT,
      signature TEXT,
      winner_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      finalized_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      draw_id TEXT NOT NULL,
      name TEXT NOT NULL,
      vk_url TEXT,
      position INTEGER NOT NULL,
      FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_participants_draw_id ON participants(draw_id);
    CREATE INDEX IF NOT EXISTS idx_draws_status ON draws(status);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
