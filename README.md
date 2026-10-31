# FairDraw

Прозрачные и проверяемые розыгрыши с использованием криптографической случайности [drand](https://drand.love/).

## Архитектура

```
fairdraw/
├── src/                    # Frontend (React + TypeScript + Vite)
│   ├── App.tsx
│   ├── pages/
│   ├── components/
│   ├── store/
│   ├── lib/
│   └── types/
├── server/                 # Backend (Node.js + Express + SQLite)
│   ├── src/
│   │   ├── index.ts
│   │   ├── db/
│   │   ├── lib/
│   │   └── routes/
│   └── package.json
├── docker-compose.yml
├── Dockerfile
├── nginx/
└── .env.example
```

**Frontend:** React + TypeScript + Vite + Tailwind CSS  
**Backend:** Node.js + Express + sql.js  
**Случайность:** drand Quicknet (публичный API)  
**Хранение:** SQLite через sql.js (WebAssembly, не требует компиляции)

## Быстрый старт (локально)

### Frontend (разработка)

```bash
npm install
npm run dev
```

Frontend будет доступен на http://localhost:3000

### Backend (разработка)

```bash
cd server
npm install
npm run dev
```

Backend будет доступен на http://localhost:3001

### Переменные окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Обязательные переменные:
- `ADMIN_PASSWORD` — пароль для управления розыгрышами
- `SESSION_SECRET` — секретный ключ для сессий (мин. 32 символа)

## Развёртывание на VDS через Docker

### 1. Подготовка сервера

```bash
# Установите Docker и Docker Compose
curl -fsSL https://get.docker.com | sh
```

### 2. Настройка swap (обязательно для VDS с RAM < 2GB)

Если на вашем VDS меньше 2GB RAM, обязательно создайте swap-файл:

```bash
# Создайте swap-файл 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавьте в /etc/fstab для автоматического включения при перезагрузке
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Проверьте
free -h
```

### 3. Клонирование и настройка

```bash
git clone <your-repo-url> fairdraw
cd fairdraw
cp .env.example .env
nano .env  # Заполните ADMIN_PASSWORD и SESSION_SECRET
```

### 4. Сборка и запуск

```bash
# Сборка может занять 5-15 минут на слабом VDS
docker compose up -d --build
```

**Если сборка зависает или падает с ошибкой OOM:**

```bash
# Убедитесь, что swap активирован
free -h

# Увеличьте swap до 4GB если нужно
sudo swapoff /swapfile
sudo fallocate -l 4G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Попробуйте сборку снова
docker compose build --no-cache
```

### 5. Проверка работоспособности

```bash
# Проверьте статус контейнера
docker compose ps

# Проверьте логи
docker compose logs -f

# Проверьте health endpoint
curl http://localhost:3001/api/health
```

Приложение будет доступно на порту 3001.

### 6. Настройка Nginx + HTTPS

```bash
# Установите Nginx и Certbot
apt install nginx certbot python3-certbot-nginx

# Скопируйте конфигурацию
cp nginx/fairdraw.conf /etc/nginx/sites-available/fairdraw
ln -s /etc/nginx/sites-available/fairdraw /etc/nginx/sites-enabled/

# Отредактируйте домен в конфиге
nano /etc/nginx/sites-available/fairdraw

# Получите SSL сертификат
certbot --nginx -d your-domain.com

# Перезапустите Nginx
systemctl reload nginx
```

## Создание первого розыгрыша

1. Откройте приложение в браузере
2. Нажмите «Войти» и введите пароль из `.env`
3. Нажмите «Новый розыгрыш»
4. Заполните название и описание
5. Добавьте участников (минимум 2)
6. Нажмите «Зафиксировать список»
7. Дождитесь раунда drand (~15 секунд)
8. Нажмите «Провести розыгрыш»
9. Результат можно проверить на публичной странице

## Проверка результата

Каждый розыгрыш имеет публичную страницу `/public/:id`, на которой доступны:
- Хеш списка участников (SHA-256)
- Номер раунда drand
- Полученная случайность (randomness)
- Подпись drand
- Данные для независимой верификации

Можно скачать JSON-файл с полными данными для проверки.

## API Endpoints

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|-------------|
| GET | `/api/health` | Проверка работоспособности | Нет |
| GET | `/api/draws` | Список розыгрышей | Нет |
| POST | `/api/draws` | Создание розыгрыша | Да |
| GET | `/api/draws/:id` | Информация о розыгрыше | Нет |
| PUT | `/api/draws/:id/participants` | Изменение участников | Да |
| POST | `/api/draws/:id/finalize` | Фиксация списка | Да |
| POST | `/api/draws/:id/execute` | Проведение розыгрыша | Да |
| GET | `/api/draws/:id/verify` | Проверка результата | Нет |
| POST | `/api/auth/login` | Вход | Нет |
| POST | `/api/auth/logout` | Выход | Да |
| GET | `/api/auth/status` | Статус авторизации | Нет |

## Безопасность

- ✅ Защита от XSS (helmet, валидация ввода)
- ✅ Rate limiting (100 req/15min, 10 auth/15min)
- ✅ CORS настроен
- ✅ SQL injection защищён (parameterized queries)
- ✅ Сессии с httpOnly cookies
- ✅ Constant-time password comparison
- ✅ Нет stack trace в ответах
- ✅ Ограничение размера запросов (1MB)

## Решение проблем

### Сборка зависает на `npm install`

**Причина:** Нехватка RAM для компиляции нативных модулей (better-sqlite3)

**Решение:**
```bash
# 1. Создайте swap-файл (см. раздел "Настройка swap")
# 2. Ограничьте параллелизм npm
export npm_config_maxsockets=2
# 3. Попробуйте сборку снова
docker compose build --no-cache
```

### Ошибка `ENOMEM` или `JavaScript heap out of memory`

**Причина:** Node.js исчерпал доступную память

**Решение:**
```bash
# Увеличьте лимит памяти в docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=512

# Или добавьте больше swap
```

### Контейнер не запускается после сборки

**Причина:** Ошибка в конфигурации или базе данных

**Решение:**
```bash
# Проверьте логи
docker compose logs fairdraw

# Проверьте права на volume
docker volume ls
docker volume inspect fairdraw_fairdraw-data

# Пересоздайте volume (ВНИМАНИЕ: удалит все данные!)
docker compose down -v
docker compose up -d
```

### Порт 3001 уже занят

**Решение:**
```bash
# Измените порт в .env
PORT=3002

# Перезапустите
docker compose down
docker compose up -d
```

## Известные ограничения

1. **BLS-подпись:** В текущей версии верификация подписи drand проверяет формат, но не выполняет полную криптографическую проверку BLS12-381. Для полной верификации необходима интеграция с библиотекой BLS (например, `@noble/bls12-381`).

2. **Нет регистрации пользователей:** MVP использует один общий пароль администратора.

3. **Демо-режим frontend:** В standalone-режиме (без backend) frontend использует симуляцию drand через Web Crypto API.

4. **Один розыгрыш за раз:** Нет очередей или параллельного выполнения.

## Требования к системе

**Минимальные:**
- CPU: 1 vCPU
- RAM: 512MB + 2GB swap
- Disk: 1GB
- OS: Ubuntu 20.04+ / Debian 11+

**Рекомендуемые:**
- CPU: 2 vCPU
- RAM: 2GB
- Disk: 5GB
- OS: Ubuntu 22.04 LTS

## Лицензия

MIT
