# Диагностика проблем с авторизацией

## Проблема: пароль из .env не принимается

### Шаг 1: Проверьте логи контейнера

```bash
docker compose logs fairdraw | grep -A 10 "Диагностика"
```

Вы должны увидеть:
```
=== Диагностика конфигурации ===
NODE_ENV: production
PORT: 3001
DB_PATH: /app/data/fairdraw.db
ADMIN_PASSWORD: ✓ установлен
SESSION_SECRET: ✓ установлен
CORS_ORIGIN: http://localhost:3001
================================
```

**Если видите `ADMIN_PASSWORD: ✗ НЕ УСТАНОВЛЕН!`** — проблема в .env файле.

---

## Возможные причины и решения

### Причина 1: Пробелы в .env

**Неправильно:**
```env
ADMIN_PASSWORD = mypassword
```

**Правильно:**
```env
ADMIN_PASSWORD=mypassword
```

**Решение:** Уберите пробелы вокруг `=`

---

### Причина 2: Кавычки в .env

**Может быть проблемой:**
```env
ADMIN_PASSWORD="mypassword"
```

**Решение:** Уберите кавычки:
```env
ADMIN_PASSWORD=mypassword
```

---

### Причина 3: .env не в той директории

**Проверьте:**
```bash
ls -la /opt/fairdraw/.env
```

Файл должен быть в той же директории, что и `docker-compose.yml`.

---

### Причина 4: Docker не подхватывает .env

**Проверьте docker-compose.yml:**

```yaml
services:
  fairdraw:
    image: fairdraw:latest
    env_file:
      - .env  # ← Убедитесь, что эта строка есть!
    environment:
      - NODE_ENV=production
      # ... другие переменные
```

**Если `env_file` отсутствует**, добавьте его:

```yaml
services:
  fairdraw:
    image: fairdraw:latest
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/fairdraw.db
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - SESSION_SECRET=${SESSION_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3001}
      - NODE_OPTIONS=--max-old-space-size=256
```

---

### Причина 5: Пароль содержит специальные символы

Если пароль содержит `#`, `$`, `\`, это может быть интерпретировано shell'ом.

**Решение:** Используйте простой пароль без спецсимволов:
```env
ADMIN_PASSWORD=mypassword123
```

---

### Причина 6: Сессии не работают (HTTPS)

Если вы используете HTTPS, но cookie не устанавливаются:

**Проверьте в browser DevTools:**
- Application → Cookies → есть ли сессия?

**Решение:** В `server/src/index.ts` измените:

```typescript
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  }
}));
```

И в `.env`:
```env
USE_HTTPS=false  # если нет HTTPS
```

---

## Быстрая проверка

### 1. Проверьте .env на сервере

```bash
cd /opt/fairdraw
cat .env
```

Должно быть:
```env
ADMIN_PASSWORD=ваш_пароль
SESSION_SECRET=длинная_случайная_строка
PORT=3001
CORS_ORIGIN=http://localhost:3001
```

### 2. Перезапустите контейнер

```bash
docker compose down
docker compose up -d
```

### 3. Проверьте логи

```bash
docker compose logs -f fairdraw
```

Ищите строку:
```
ADMIN_PASSWORD: ✓ установлен
```

### 4. Попробуйте войти

Откройте браузер и попробуйте войти с паролем из .env.

---

## Пример правильного .env

```env
# Пароль администратора (без пробелов и кавычек)
ADMIN_PASSWORD=mypassword123

# Секрет для сессий (минимум 32 символа)
SESSION_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234

# Порт сервера
PORT=3001

# CORS (адрес frontend)
CORS_ORIGIN=http://localhost:3001

# Путь к базе данных
DB_PATH=/app/data/fairdraw.db

# Окружение
NODE_ENV=production
```

---

## Если ничего не помогло

### Временное решение: хардкод пароля

В `server/src/routes/draws.ts` найдите:

```typescript
const adminPassword = process.env.ADMIN_PASSWORD;
```

Замените на:

```typescript
const adminPassword = 'mypassword123'; // ВРЕМЕННО!
```

Пересоберите и перезапустите:

```bash
docker compose down
docker build -t fairdraw:latest .
docker compose up -d
```

**Не забудьте убрать хардкод после решения проблемы!**

---

## Чек-лист

- [ ] Файл `.env` существует в `/opt/fairdraw/`
- [ ] В `.env` нет пробелов вокруг `=`
- [ ] В `.env` нет кавычек вокруг значений
- [ ] `ADMIN_PASSWORD` установлен и не пустой
- [ ] `docker-compose.yml` содержит `env_file: - .env`
- [ ] Контейнер перезапущен после изменений в `.env`
- [ ] В логах видно `ADMIN_PASSWORD: ✓ установлен`
- [ ] Пароль в браузере совпадает с `.env` (без лишних пробелов)

---

## Команды для быстрой диагностики

```bash
# Проверить .env
cat /opt/fairdraw/.env

# Проверить логи
docker compose logs fairdraw | grep -E "(ADMIN_PASSWORD|Диагностика)"

# Перезапустить
cd /opt/fairdraw
docker compose down
docker compose up -d

# Проверить статус
docker compose ps

# Посмотреть все логи
docker compose logs -f fairdraw
```
