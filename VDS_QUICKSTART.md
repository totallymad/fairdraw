# Быстрый старт на VDS (для слабых серверов)

## Что было исправлено

### Проблема
Сборка Docker зависала на этапе `npm install` на VDS с малым объёмом RAM.

### Причины
1. Node.js 20 несовместим с `@supabase/supabase-js` (требует Node 22+)
2. Компиляция `better-sqlite3` требует много RAM
3. Параллельная сборка трёх stages перегружает систему

### Решения
✅ Обновлён Node.js до версии 22 в Dockerfile  
✅ Добавлены `.npmrc` файлы для ограничения параллелизма  
✅ Добавлен `NODE_OPTIONS=--max-old-space-size=256` для экономии памяти  
✅ Добавлены build-инструменты (python3, make, g++) для компиляции нативных модулей  
✅ Добавлены ограничения памяти в docker-compose.yml  
✅ Создан подробный TROUBLESHOOTING.md  

## Пошаговая инструкция

### 1. Подготовка VDS

```bash
# Подключитесь к серверу
ssh user@your-vds-ip

# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите Docker
curl -fsSL https://get.docker.com | sh

# Проверьте RAM
free -h
```

### 2. Создайте swap (ОБЯЗАТЕЛЬНО для RAM < 2GB)

```bash
# Создайте swap 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавьте в автозагрузку
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Проверьте
free -h
```

### 3. Клонируйте проект

```bash
git clone <your-repo-url> fairdraw
cd fairdraw
```

### 4. Настройте переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполните:
```env
ADMIN_PASSWORD=ваш-надёжный-пароль
SESSION_SECRET=длинная-случайная-строка-минимум-32-символа
PORT=3001
CORS_ORIGIN=http://your-domain.com:3001
```

### 5. Соберите и запустите

```bash
# Сборка (может занять 5-15 минут)
docker compose up -d --build

# Проверьте статус
docker compose ps

# Проверьте логи
docker compose logs -f
```

### 6. Проверьте работоспособность

```bash
# Должно вернуть {"status":"ok",...}
curl http://localhost:3001/api/health
```

Откройте в браузере: `http://your-vds-ip:3001`

## Если сборка зависает

### Вариант 1: Увеличьте swap

```bash
sudo swapoff /swapfile
sudo fallocate -l 4G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Вариант 2: Пересоберите с очисткой

```bash
docker compose down
docker system prune -a
docker compose build --no-cache
```

### Вариант 3: Соберите локально и загрузите образ

```bash
# На локальной машине
docker build -t fairdraw .
docker save fairdraw | gzip > fairdraw.tar.gz

# Загрузите на VDS
scp fairdraw.tar.gz user@vds:/home/user/

# На VDS
docker load < fairdraw.tar.gz
docker compose up -d
```

## Настройка домена и HTTPS (опционально)

```bash
# Установите Nginx и Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Скопируйте конфиг
cp nginx/fairdraw.conf /etc/nginx/sites-available/fairdraw
sudo ln -s /etc/nginx/sites-available/fairdraw /etc/nginx/sites-enabled/

# Отредактируйте домен
sudo nano /etc/nginx/sites-available/fairdraw
# Замените your-domain.com на ваш домен

# Получите SSL сертификат
sudo certbot --nginx -d your-domain.com

# Перезапустите Nginx
sudo systemctl reload nginx
```

## Полезные команды

```bash
# Логи
docker compose logs -f

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Обновление
git pull
docker compose up -d --build

# Проверка базы данных
docker compose exec fairdraw ls -lh /app/data/
```

## Мониторинг

```bash
# Использование ресурсов
htop

# Или
top
free -h
df -h
```

## Решение проблем

Подробное руководство: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### Быстрые решения

**Сборка зависает:**
```bash
# Добавьте swap (см. шаг 2)
# Пересоберите
docker compose build --no-cache
```

**Контейнер падает:**
```bash
# Проверьте логи
docker compose logs fairdraw

# Увеличьте лимит памяти в docker-compose.yml
# NODE_OPTIONS=--max-old-space-size=512
```

**Порт занят:**
```bash
# Измените PORT в .env
# Перезапустите
docker compose down
docker compose up -d
```

## Минимальные требования

- **CPU:** 1 vCPU
- **RAM:** 512MB + 2GB swap (обязательно!)
- **Disk:** 1GB
- **OS:** Ubuntu 20.04+ / Debian 11+

## Рекомендации

- **RAM:** 2GB (без swap)
- **Disk:** 5GB
- **OS:** Ubuntu 22.04 LTS

---

**Готово!** Приложение должно работать на http://your-vds-ip:3001

Для создания первого розыгрыша:
1. Откройте приложение
2. Нажмите "Войти"
3. Введите пароль из `.env` (ADMIN_PASSWORD)
4. Создайте розыгрыш
