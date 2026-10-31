# Проблема: пароль из .env не принимается

## Быстрая диагностика

### Шаг 1: Проверьте логи

```bash
docker compose logs fairdraw | grep "ADMIN_PASSWORD"
```

Должно быть:
```
ADMIN_PASSWORD: ✓ установлен
```

Если видите `✗ НЕ УСТАНОВЛЕН` — проблема в .env файле.

---

## Самые частые причины

### 1. Пробелы в .env

**Неправильно:**
```env
ADMIN_PASSWORD = mypassword
```

**Правильно:**
```env
ADMIN_PASSWORD=mypassword
```

### 2. Кавычки в .env

**Неправильно:**
```env
ADMIN_PASSWORD="mypassword"
```

**Правильно:**
```env
ADMIN_PASSWORD=mypassword
```

### 3. .env не в той директории

Файл `.env` должен быть в `/opt/fairdraw/` (рядом с `docker-compose.yml`).

### 4. Docker не подхватывает .env

Проверьте `docker-compose.yml` — должна быть строка:
```yaml
env_file:
  - .env
```

---

## Решение

### 1. Проверьте .env

```bash
cd /opt/fairdraw
cat .env
```

Должно быть:
```env
ADMIN_PASSWORD=mypassword123
SESSION_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234
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

Ищите:
```
=== Диагностика конфигурации ===
ADMIN_PASSWORD: ✓ установлен
```

### 4. Попробуйте войти

Откройте браузер и введите пароль из .env (без пробелов и кавычек).

---

## Автоматическая проверка

Запустите скрипт диагностики:

```bash
chmod +x check-auth.sh
./check-auth.sh
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

Пересоберите:

```bash
docker compose down
docker build -t fairdraw:latest .
docker compose up -d
```

**Не забудьте убрать хардкод после решения проблемы!**

---

## Чек-лист

- [ ] Файл `.env` существует
- [ ] Нет пробелов вокруг `=`
- [ ] Нет кавычек вокруг значений
- [ ] `ADMIN_PASSWORD` не пустой
- [ ] `docker-compose.yml` содержит `env_file: - .env`
- [ ] Контейнер перезапущен
- [ ] В логах видно `ADMIN_PASSWORD: ✓ установлен`

---

## Команды

```bash
# Проверить .env
cat .env

# Проверить логи
docker compose logs fairdraw | grep ADMIN_PASSWORD

# Перезапустить
docker compose down && docker compose up -d

# Посмотреть все логи
docker compose logs -f fairdraw
```
