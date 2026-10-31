# Быстрый деплой FairDraw на слабый VDS

## Проблема
VDS не может собрать Docker-образ из-за нехватки RAM.

## Решение
Собрать образ на локальной машине → загрузить на VDS.

---

## Метод 1: Через файл (самый простой)

### На локальной машине (Windows PowerShell):

```powershell
# 1. Соберите образ
docker build -t fairdraw:latest .

# 2. Сохраните в файл
docker save fairdraw:latest -o fairdraw.tar

# 3. Загрузите на VDS через SCP
scp fairdraw.tar root@YOUR_VDS_IP:/opt/fairdraw/

# 4. (Опционально) Загрузите .env и docker-compose.yml
scp .env root@YOUR_VDS_IP:/opt/fairdraw/
scp docker-compose.yml root@YOUR_VDS_IP:/opt/fairdraw/
```

### На VDS (SSH):

```bash
# 1. Перейдите в директорию проекта
cd /opt/fairdraw

# 2. Загрузите образ
docker load -i fairdraw.tar

# 3. Удалите архив (экономия места)
rm fairdraw.tar

# 4. Запустите
docker compose up -d

# 5. Проверьте
docker compose ps
curl http://localhost:3001/api/health
```

---

## Метод 2: Через Docker Hub

### На локальной машине:

```powershell
# 1. Войдите в Docker Hub
docker login

# 2. Соберите и запушьте
docker build -t YOUR_USERNAME/fairdraw:latest .
docker push YOUR_USERNAME/fairdraw:latest
```

### На VDS:

```bash
# 1. Войдите в Docker Hub
docker login

# 2. Обновите docker-compose.yml (замените build на image)
# image: YOUR_USERNAME/fairdraw:latest

# 3. Запустите
docker compose pull
docker compose up -d
```

---

## docker-compose.yml для VDS (без сборки)

```yaml
services:
  fairdraw:
    image: fairdraw:latest  # локальный образ
    # image: yourusername/fairdraw:latest  # или из Docker Hub
    container_name: fairdraw-app
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - fairdraw-/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/fairdraw.db
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - SESSION_SECRET=${SESSION_SECRET}
      - NODE_OPTIONS=--max-old-space-size=256
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  fairdraw-
    driver: local
```

---

## Обновление приложения

### На локальной машине:

```powershell
# 1. Обновите код
git pull

# 2. Пересоберите образ
docker build -t fairdraw:latest .

# 3. Загрузите на VDS
scp fairdraw.tar root@YOUR_VDS_IP:/opt/fairdraw/
```

### На VDS:

```bash
# 1. Загрузите новый образ
docker load -i fairdraw.tar
rm fairdraw.tar

# 2. Перезапустите контейнер
docker compose down
docker compose up -d

# 3. Проверьте
docker compose ps
```

---

## Автоматизация (PowerShell скрипт)

Создайте файл `deploy.ps1`:

```powershell
param(
    [string]$VdsHost = "YOUR_VDS_IP",
    [string]$VdsUser = "root"
)

# Сборка
docker build -t fairdraw:latest .
docker save fairdraw:latest -o fairdraw.tar

# Загрузка
scp fairdraw.tar "${VdsUser}@${VdsHost}:/opt/fairdraw/"

# Деплой
ssh "${VdsUser}@${VdsHost}" "cd /opt/fairdraw && docker load -i fairdraw.tar && rm fairdraw.tar && docker compose down && docker compose up -d"

# Очистка
Remove-Item fairdraw.tar
```

Запуск:

```powershell
.\deploy.ps1 -VdsHost 123.45.67.89
```

---

## Размер образа

- **fairdraw.tar**: ~150-200 MB
- **fairdraw.tar.gz**: ~50-70 MB (если сжать)

Для сжатия на Windows (если есть Git Bash или WSL):

```bash
gzip fairdraw.tar
scp fairdraw.tar.gz root@VDS_IP:/opt/fairdraw/
```

На VDS:

```bash
gunzip fairdraw.tar.gz
docker load -i fairdraw.tar
```

---

## Troubleshooting

### Ошибка: "Cannot connect to the Docker daemon"

```powershell
# Запустите Docker Desktop
# Или проверьте службу Docker
```

### Ошибка: "permission denied" при SCP

```powershell
# Используйте SSH ключ или укажите пароль
scp -i ~/.ssh/id_rsa fairdraw.tar root@VDS_IP:/opt/fairdraw/
```

### Образ не загружается на VDS

```bash
# Проверьте свободное место
df -h

# Очистите старые образы
docker image prune -a
```

### Контейнер не запускается

```bash
# Проверьте логи
docker compose logs

# Проверьте .env
cat .env

# Пересоздайте volume (ВНИМАНИЕ: удалит данные!)
docker compose down -v
docker compose up -d
```

---

## Итого

**Самый простой путь:**

1. На Windows: `docker build` → `docker save` → `scp`
2. На VDS: `docker load` → `docker compose up`

**Время:**
- Сборка на локальной машине: 2-5 минут
- Загрузка на VDS: 1-3 минуты (зависит от интернета)
- Запуск на VDS: 10 секунд

**Требования к VDS:**
- RAM: 256 MB
- Disk: 500 MB (для образа + данные)
- Docker + Docker Compose
