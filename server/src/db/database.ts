import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'fairdraw.db');

let db: SqlJsDatabase | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

// Инициализация sql.js (асинхронная)
export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  // Загружаем WASM
  const SQL = await initSqlJs();

  // Создаём директорию если нужно
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Загружаем существующую БД или создаём новую
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  return db;
}

// Сохранение БД на диск (debounced)
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  }, 100);
}

// Немедленное сохранение
export function saveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Обёртка для совместимости с better-sqlite3 API
export class DatabaseWrapper {
  private db: SqlJsDatabase;

  constructor(database: SqlJsDatabase) {
    this.db = database;
  }

  // Выполняет SQL без возврата результатов
  exec(sql: string): void {
    this.db.run(sql);
    scheduleSave();
  }

  // Для prepare().run()
  prepare(sql: string) {
    return {
      run: (...params: any[]) => {
        this.db.run(sql, params);
        scheduleSave();
      },
      get: (...params: any[]) => {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all: (...params: any[]) => {
        const results: any[] = [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  // Прямой exec для множественных statements
  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.run('COMMIT');
      scheduleSave();
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }
}

let dbWrapper: DatabaseWrapper | null = null;

export async function getDb(): Promise<DatabaseWrapper> {
  if (!dbWrapper) {
    const database = await initDb();
    dbWrapper = new DatabaseWrapper(database);
  }
  return dbWrapper;
}

export async function runMigrations(): Promise<void> {
  const database = await getDb();
  
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
  `);

  // Индексы создаём отдельно (sql.js не поддерживает множественные statements в одном exec)
  try {
    database.exec('CREATE INDEX IF NOT EXISTS idx_participants_draw_id ON participants(draw_id)');
  } catch {}
  
  try {
    database.exec('CREATE INDEX IF NOT EXISTS idx_draws_status ON draws(status)');
  } catch {}

  saveDb();
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbWrapper = null;
  }
}
