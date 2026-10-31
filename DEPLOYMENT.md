# Деплой FairDraw на VDS через Docker Registry

Если ваш VDS слишком слаб для сборки Docker-образов, вы можете собрать образ на локальной машине и загрузить его на сервер.

## Вариант 1: Docker Hub (рекомендуется)

### Шаг 1: Регистрация в Docker Hub

1. Зарегистрируйтесь на https://hub.docker.com
2. Создайте репозиторий (например, `fairdraw`)

### Шаг 2: Сборка на локальной машине (Windows)

```powershell
# Войдите в Docker Hub
docker login

# Соберите образ
docker build -t yourusername/fairdraw:latest .

# Запушьте в Docker Hub
docker push yourusername/fairdraw:latest
```

### Шаг 3: Запуск на VDS

```bash
# Войдите в Docker Hub
docker login

# Обновите docker-compose.yml (замените build на image)
# См. пример ниже

# Запустите
docker compose pull
docker compose up -d
```

### Пример docker-compose.yml для VDS:

```yaml
services:
  fairdraw:
    image: yourusername/fairdraw:latest
    container_name: fairdraw-app
    restart: unless-stopped
    ports:
      - "${PORT:-3001}:3001"
    volumes:
      - fairdraw-/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/fairdraw.db
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - SESSION_SECRET=${SESSION_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3001}
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

## Вариант 2: GitHub Container Registry (GHCR)

Если ваш код на GitHub, используйте GHCR:

### Шаг 1: Создайте Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token с правами `write:packages` и `read:packages`

### Шаг 2: Сборка на локальной машине

```powershell
# Войдите в GHCR
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Соберите образ
docker build -t ghcr.io/YOUR_USERNAME/fairdraw:latest .

# Запушьте
docker push ghcr.io/YOUR_USERNAME/fairdraw:latest
```

### Шаг 3: Запуск на VDS

```bash
# Войдите в GHCR
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Запустите
docker compose pull
docker compose up -d
```

## Вариант 3: Экспорт/импорт через файл (без registry)

Если не хотите использовать registry:

### Шаг 1: Сборка на локальной машине

```powershell
# Соберите образ
docker build -t fairdraw:latest .

# Сохраните в файл
docker save fairdraw:latest | gzip > fairdraw.tar.gz

# Или без gzip (если нет):
docker save fairdraw:latest -o fairdraw.tar
```

### Шаг 2: Загрузка на VDS

```powershell
# Через SCP
scp fairdraw.tar.gz user@your-vds-ip:/opt/fairdraw/

# Или через WinSCP (графический интерфейс)
```

### Шаг 3: Развёртывание на VDS

```bash
# Загрузите образ
docker load < fairdraw.tar.gz

# Запустите
docker compose up -d
```

## Автоматический деплой (скрипт)

### Для Windows (PowerShell):

```powershell
# Используйте готовый скрипт
.\deploy.ps1 -VdsHost your-vds-ip -VdsUser root
```

### Для Linux/Mac:

```bash
# Сделайте скрипт исполняемым
chmod +x deploy.sh

# Запустите
VDS_HOST=your-vds-ip ./deploy.sh
```

## Обновление приложения

Когда вы обновляете код:

### Через Docker Hub:

```powershell
# На локальной машине
docker build -t yourusername/fairdraw:latest .
docker push yourusername/fairdraw:latest
```

```bash
# На VDS
docker compose pull
docker compose up -d
```

### Через файл:

```powershell
# На локальной машине
docker build -t fairdraw:latest .
docker save fairdraw:latest | gzip > fairdraw.tar.gz
scp fairdraw.tar.gz user@vds:/opt/fairdraw/
```

```bash
# На VDS
docker load < fairdraw.tar.gz
docker compose up -d
rm fairdraw.tar.gz  # очистка
```

## Оптимизация размера образа

Образ FairDraw занимает ~150-200 MB. Для ускорения загрузки:

1. **Используйте multi-stage build** (уже настроено в Dockerfile)
2. **Сжимайте образ** через gzip при экспорте
3. **Используйте Docker Hub** с кэшированием слоёв

## Troubleshooting

### Ошибка: "unauthorized: authentication required"

```bash
# Проверьте логин
docker login

# Или для GHCR
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### Ошибка: "manifest unknown"

```bash
# Убедитесь, что образ запушен
docker images | grep fairdraw

# Проверьте тег
docker push yourusername/fairdraw:latest
```

### Медленная загрузка на VDS

```bash
# Проверьте скорость интернета на VDS
curl -o /dev/null http://speedtest.tele2.net/1GB.zip

# Если медленно, используйте локальный экспорт/импорт
```

### Образ занимает много места

```bash
# Очистите старые образы
docker image prune -a

# Проверьте размер
docker images | grep fairdraw
```

## Сравнение методов

| Метод | Плюсы | Минусы |
|-------|-------|--------|
| **Docker Hub** | Автоматизация, кэширование, легко обновлять | Нужен аккаунт, публичный (или платный приватный) |
| **GHCR** | Интеграция с GitHub, приватные репо бесплатно | Нужен GitHub token |
| **Файл** | Полностью приватно, не нужен интернет | Ручная загрузка, нет кэширования |

## Рекомендации

- **Для личного проекта**: Docker Hub (бесплатные публичные образы)
- **Для приватного проекта**: GHCR или экспорт через файл
- **Для быстрого деплоя**: Экспорт через файл + SCP

## Полный workflow

```powershell
# 1. Разработка на локальной машине
git pull
# ... изменения кода ...

# 2. Сборка и пуш
docker build -t yourusername/fairdraw:latest .
docker push yourusername/fairdraw:latest

# 3. Деплой на VDS (через SSH)
ssh root@your-vds-ip "cd /opt/fairdraw && docker compose pull && docker compose up -d"
```

Или используйте скрипт:

```powershell
.\deploy.ps1 -VdsHost your-vds-ip
```
