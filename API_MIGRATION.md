# Что изменилось: Frontend теперь работает через API

## Проблема
Розыгрыши были видны только в одном браузере, потому что данные хранились в `localStorage` каждого браузера отдельно.

## Решение
Frontend переделан на работу с backend API. Теперь все данные хранятся в SQLite на сервере и доступны всем пользователям.

---

## Что изменилось технически

### Было (localStorage)
```
Браузер 1 → localStorage → свои данные
Браузер 2 → localStorage → свои данные
Браузер 3 → localStorage → свои данные
```

### Стало (API + SQLite)
```
Браузер 1 → API → Backend → SQLite
Браузер 2 → API → Backend → SQLite
Браузер 3 → API → Backend → SQLite
```

---

## Как это работает

### Frontend (React)
- Загружает данные через API (`/api/draws`, `/api/draws/:id`)
- Отправляет изменения через API (создание, редактирование, розыгрыш)
- Показывает loading-состояния при загрузке
- Обрабатывает ошибки API

### Backend (Node.js + Express)
- Принимает запросы от frontend
- Работает с SQLite через `sql.js`
- Возвращает данные в JSON формате
- Обрабатывает авторизацию через сессии

### База данных (SQLite)
- Хранит все розыгрыши и участников
- Доступна всем пользователям
- Сохраняется на диске сервера

---

## Что нужно для работы

### 1. Backend должен быть запущен

Frontend теперь **не работает автономно** — ему нужен backend.

**Вариант A: Production (Docker)**
```bash
docker compose up -d
```
Backend и frontend работают вместе в одном контейнере.

**Вариант B: Разработка (локально)**
```bash
# Терминал 1: Backend
cd server
npm install
npm run dev

# Терминал 2: Frontend
npm install
npm run dev
```

### 2. Настройте CORS (для разработки)

В `server/src/index.ts` уже настроен CORS:
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
```

Для production измените `CORS_ORIGIN` в `.env`:
```env
CORS_ORIGIN=https://your-domain.com
```

### 3. Настройте API URL (если нужно)

По умолчанию frontend использует относительные пути (`/api/...`), что работает, если frontend и backend на одном домене.

Если нужно изменить, отредактируйте `src/lib/api.ts`:
```typescript
const API_BASE = 'https://your-api-domain.com/api';
```

---

## Деплой на VDS

### Шаг 1: Соберите образ на локальной машине

```powershell
docker build -t fairdraw:latest .
docker save fairdraw:latest -o fairdraw.tar
scp fairdraw.tar root@YOUR_VDS_IP:/opt/fairdraw/
scp .env root@YOUR_VDS_IP:/opt/fairdraw/
scp docker-compose.yml root@YOUR_VDS_IP:/opt/fairdraw/
```

### Шаг 2: Запустите на VDS

```bash
cd /opt/fairdraw
docker load -i fairdraw.tar
rm fairdraw.tar
docker compose up -d
```

### Шаг 3: Проверьте

```bash
# Проверьте backend
curl http://localhost:3001/api/health

# Откройте в браузере
http://YOUR_VDS_IP:3001
```

---

## Проверка работы

### 1. Создайте розыгрыш в одном браузере

1. Откройте `http://YOUR_VDS_IP:3001`
2. Войдите (пароль из `.env`)
3. Создайте розыгрыш
4. Добавьте участников

### 2. Откройте в другом браузере

1. Откройте `http://YOUR_VDS_IP:3001` в другом браузере или в приватном окне
2. Вы должны увидеть тот же розыгрыш!

### 3. Проведите розыгрыш

1. Вернитесь в первый браузер
2. Зафиксируйте список
3. Проведите розыгрыш
4. Обновите страницу во втором браузере — результат должен появиться!

---

## API Endpoints

Frontend использует следующие endpoints:

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Проверка работоспособности |
| GET | `/api/draws` | Список всех розыгрышей |
| GET | `/api/draws/:id` | Детали розыгрыша |
| POST | `/api/draws` | Создать розыгрыш |
| PUT | `/api/draws/:id/participants` | Обновить участников |
| POST | `/api/draws/:id/finalize` | Зафиксировать список |
| POST | `/api/draws/:id/execute` | Провести розыгрыш |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/status` | Статус авторизации |

---

## Troubleshooting

### Ошибка: "Failed to fetch"

**Причина:** Backend не запущен или недоступен

**Решение:**
```bash
# Проверьте, что контейнер запущен
docker compose ps

# Проверьте логи
docker compose logs fairdraw

# Перезапустите
docker compose restart
```

### Ошибка: "CORS policy"

**Причина:** Неправильный CORS_ORIGIN

**Решение:**
```bash
# Проверьте .env
cat .env | grep CORS_ORIGIN

# Обновите и перезапустите
docker compose down
docker compose up -d
```

### Розыгрыши не сохраняются

**Причина:** Проблема с базой данных

**Решение:**
```bash
# Проверьте volume
docker volume ls | grep fairdraw

# Проверьте логи
docker compose logs fairdraw | grep -i error

# Пересоздайте volume (ВНИМАНИЕ: удалит данные!)
docker compose down -v
docker compose up -d
```

### Авторизация не работает

**Причина:** Неправильный ADMIN_PASSWORD или SESSION_SECRET

**Решение:**
```bash
# Проверьте .env
cat .env

# Убедитесь, что ADMIN_PASSWORD и SESSION_SECRET заполнены
# Перезапустите контейнер
docker compose restart
```

---

## Преимущества нового подхода

✅ **Все пользователи видят одни данные** — розыгрыши синхронизированы  
✅ **Данные не теряются** — хранятся на сервере в SQLite  
✅ **Публичные страницы работают** — доступны без авторизации  
✅ **Масштабируемость** — можно добавить балансировку и репликацию  
✅ **Безопасность** — сессии на сервере, не в браузере  

---

## Итого

**Проблема решена:** Теперь розыгрыши видны во всех браузерах!

**Что нужно:**
1. Задеплоить backend на VDS (через Docker)
2. Frontend автоматически будет работать через API
3. Все пользователи будут видеть одни и те же данные

**Деплой:**
```powershell
# На локальной машине
docker build -t fairdraw:latest .
docker save fairdraw:latest -o fairdraw.tar
scp fairdraw.tar root@VDS_IP:/opt/fairdraw/

# На VDS
docker load -i fairdraw.tar
docker compose up -d
```

Готово! 🎉
