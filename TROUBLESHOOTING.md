# Решение проблем при развёртывании на VDS

## Проблема: Сборка зависает на `npm install`

### Симптомы
- Docker build останавливается на этапе `RUN npm install` или `RUN npm ci`
- Нет ошибок, но процесс не завершается
- На локальной машине работает нормально

### Причины
1. **Нехватка RAM** — компиляция нативных модулей (better-sqlite3) требует много памяти
2. **Отсутствие swap** — система не может использовать диск как дополнительную память
3. **Слишком много параллельных процессов** — npm по умолчанию запускает много потоков

### Решения

#### 1. Создайте swap-файл (обязательно!)

```bash
# Проверьте текущий swap
free -h

# Если swap нет или он меньше 2GB, создайте:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавьте в автозагрузку
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Проверьте
free -h
```

#### 2. Ограничьте параллелизм npm

Создайте файл `.npmrc` в корне проекта:

```ini
audit=false
fund=false
maxsockets=2
```

#### 3. Увеличьте лимит памяти Node.js

В `docker-compose.yml` добавьте:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=512
```

#### 4. Пересоберите с очисткой кэша

```bash
docker compose down
docker system prune -a
docker compose build --no-cache
```

## Проблема: JavaScript heap out of memory

### Симптомы
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
JavaScript heap out of memory
```

### Решение

Увеличьте лимит памяти в `docker-compose.yml`:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=1024
```

Или добавьте больше swap (см. выше).

## Проблема: Контейнер падает с OOM Killed

### Симптомы
```bash
docker compose ps
# STATUS: OOMKilled
```

### Решение

#### 1. Увеличьте лимит памяти в docker-compose.yml

```yaml
deploy:
  resources:
    limits:
      memory: 1G
    reservations:
      memory: 512M
```

#### 2. Добавьте больше swap

```bash
# Увеличьте swap до 4GB
sudo swapoff /swapfile
sudo fallocate -l 4G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 3. Оптимизируйте приложение

В `Dockerfile` добавьте:

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=256"
```

## Проблема: better-sqlite3 не компилируется

### Решение

**Эта проблема больше не актуальна!** Проект использует `sql.js` (WebAssembly), который не требует компиляции нативных модулей. Сборка работает на любых VDS без дополнительных инструментов.

## Проблема: Порт уже занят

### Симптомы
```
Error: listen EADDRINUSE: address already in use :::3001
```

### Решение

```bash
# Найдите процесс
sudo lsof -i :3001

# Или измените порт в .env
PORT=3002

# Перезапустите
docker compose down
docker compose up -d
```

## Проблема: База данных не создаётся

### Симптомы
```
Error: ENOENT: no such file or directory, open '/app/data/fairdraw.db'
```

### Решение

```bash
# Проверьте volume
docker volume ls | grep fairdraw

# Создайте директорию вручную
docker compose exec fairdraw mkdir -p /app/data

# Или пересоздайте volume (ВНИМАНИЕ: удалит данные!)
docker compose down -v
docker compose up -d
```

## Проблема: Нет доступа из интернета

### Симптомы
- Приложение работает локально (`curl localhost:3001`)
- Но недоступно по внешнему IP

### Решение

#### 1. Проверьте firewall

```bash
# UFW
sudo ufw allow 3001/tcp

# Или iptables
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

#### 2. Проверьте security group (если VPS в облаке)

Откройте порт 3001 в панели управления хостингом.

#### 3. Используйте Nginx reverse proxy

См. раздел "Настройка Nginx + HTTPS" в README.md

## Оптимизация для слабых VDS

### Минимальная конфигурация

Если у вас VDS с 512MB RAM:

1. **Обязательно создайте swap 2-4GB**
2. **Используйте Node.js 22** (уже настроено в Dockerfile)
3. **Ограничьте память Node.js:**
   ```yaml
   environment:
     - NODE_OPTIONS=--max-old-space-size=256
   ```
4. **Отключите source maps в production:**
   ```dockerfile
   ENV NODE_ENV=production
   ```

### Мониторинг ресурсов

```bash
# Используйте htop для мониторинга
sudo apt install htop
htop

# Или встроенные инструменты
top
free -h
df -h
```

### Автоматический restart

Уже настроен в `docker-compose.yml`:

```yaml
restart: unless-stopped
```

## Полезные команды

```bash
# Посмотреть логи
docker compose logs -f fairdraw

# Перезапустить контейнер
docker compose restart fairdraw

# Пересобрать без кэша
docker compose build --no-cache

# Очистить всё и начать заново
docker compose down -v
docker system prune -a
docker compose up -d --build

# Войти в контейнер
docker compose exec fairdraw sh

# Проверить размер базы данных
docker compose exec fairdraw ls -lh /app/data/
```

## Если ничего не помогает

1. **Увеличьте тариф VDS** до 2GB RAM
2. **Используйте локальную сборку:**
   ```bash
   # Соберите образ локально
   docker build -t fairdraw .
   
   # Сохраните в файл
   docker save fairdraw | gzip > fairdraw.tar.gz
   
   # Загрузите на VDS
   scp fairdraw.tar.gz user@vds:/path/
   
   # Разверните на VDS
   docker load < fairdraw.tar.gz
   docker compose up -d
   ```

3. **Попробуйте альтернативный хостинг** с большим объёмом RAM
