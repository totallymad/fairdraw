# Деплой FairDraw: Пошаговая инструкция

## Проблема
VDS слишком слаб для сборки Docker-образов (нехватка RAM).

## Решение
Собрать образ на локальной машине (Windows) → загрузить на VDS.

---

## 🚀 Быстрый старт (копируйте команды)

### Шаг 1: На локальной машине (Windows PowerShell)

```powershell
# Перейдите в директорию проекта
cd C:\Users\pc_admin\projects\fairdraw

# Соберите Docker-образ
docker build -t fairdraw:latest .

# Сохраните образ в файл
docker save fairdraw:latest -o fairdraw.tar

# Загрузите на VDS (замените YOUR_VDS_IP)
scp fairdraw.tar root@YOUR_VDS_IP:/opt/fairdraw/

# Также загрузите конфигурацию
scp .env root@YOUR_VDS_IP:/opt/fairdraw/
scp docker-compose.yml root@YOUR_VDS_IP:/opt/fairdraw/
```

### Шаг 2: На VDS (SSH)

```bash
# Подключитесь к VDS
ssh root@YOUR_VDS_IP

# Перейдите в директорию
cd /opt/fairdraw

# Загрузите Docker-образ
docker load -i fairdraw.tar

# Удалите архив (экономия места)
rm fairdraw.tar

# Запустите приложение
docker compose up -d

# Проверьте статус
docker compose ps

# Проверьте работоспособность
curl http://localhost:3001/api/health
```

**Готово!** Приложение доступно на `http://YOUR_VDS_IP:3001`

---

## 📋 Альтернативные методы

### Метод A: Через Docker Hub

**На локальной машине:**
```powershell
docker login
docker build -t YOUR_DOCKERHUB_USERNAME/fairdraw:latest .
docker push YOUR_DOCKERHUB_USERNAME/fairdraw:latest
```

**На VDS:**
```bash
docker login
# Измените docker-compose.yml: image: YOUR_DOCKERHUB_USERNAME/fairdraw:latest
docker compose pull
docker compose up -d
```

### Метод B: Автоматический скрипт

**Создайте файл `deploy.ps1`:**

```powershell
param([string]$VdsHost)

docker build -t fairdraw:latest .
docker save fairdraw:latest -o fairdraw.tar
scp fairdraw.tar "root@${VdsHost}:/opt/fairdraw/"
ssh "root@${VdsHost}" "cd /opt/fairdraw && docker load -i fairdraw.tar && rm fairdraw.tar && docker compose up -d"
Remove-Item fairdraw.tar
```

**Запуск:**
```powershell
.\deploy.ps1 -VdsHost YOUR_VDS_IP
```

---

## 🔄 Обновление приложения

### На локальной машине:

```powershell
# Обновите код
git pull

# Пересоберите
docker build -t fairdraw:latest .
docker save fairdraw:latest -o fairdraw.tar

# Загрузите на VDS
scp fairdraw.tar root@YOUR_VDS_IP:/opt/fairdraw/
```

### На VDS:

```bash
cd /opt/fairdraw
docker load -i fairdraw.tar
rm fairdraw.tar
docker compose down
docker compose up -d
```

---

## 📊 Размеры и время

| Операция | Размер | Время |
|----------|--------|-------|
| Сборка образа | - | 2-5 мин (локально) |
| fairdraw.tar | ~150-200 MB | - |
| Загрузка на VDS | 150-200 MB | 1-5 мин (зависит от интернета) |
| Запуск на VDS | - | 10 секунд |

---

## ✅ Требования к VDS

- **RAM:** 256 MB (минимум)
- **Disk:** 500 MB (образ + данные)
- **Software:** Docker + Docker Compose
- **OS:** Ubuntu 20.04+ / Debian 11+

---

## 🛠️ Troubleshooting

### Ошибка при сборке на локальной машине

```powershell
# Проверьте Docker Desktop
docker --version

# Если не работает, перезапустите Docker Desktop
```

### Ошибка при загрузке на VDS

```bash
# Проверьте свободное место
df -h

# Очистите старые образы
docker image prune -a
```

### Контейнер не запускается

```bash
# Проверьте логи
docker compose logs fairdraw

# Проверьте .env
cat .env

# Перезапустите
docker compose down
docker compose up -d
```

### Приложение недоступно

```bash
# Проверьте firewall
sudo ufw allow 3001/tcp

# Проверьте, что контейнер запущен
docker compose ps

# Проверьте health endpoint
curl http://localhost:3001/api/health
```

---

## 📚 Документация

- **QUICK_DEPLOY.md** - Подробная инструкция по быстрому деплою
- **DEPLOYMENT.md** - Все методы деплоя с примерами
- **VDS_QUICKSTART.md** - Настройка VDS (swap, Nginx, HTTPS)
- **TROUBLESHOOTING.md** - Решение проблем
- **README.md** - Общая документация проекта

---

## 💡 Рекомендации

1. **Используйте метод с файлом** (самый простой и надёжный)
2. **Создайте swap на VDS** (даже если образ загружается, swap нужен для работы)
3. **Настройте автоматический деплой** через скрипт для удобства
4. **Храните .env отдельно** (не коммитьте в git)

---

## 🎯 Итого

**Самый простой путь:**

```
Windows (build) → fairdraw.tar → SCP → VDS (load + run)
```

**Время:** 5-10 минут на первый деплой, 2-3 минуты на обновление.

**Результат:** Рабочее приложение FairDraw на вашем VDS! 🎉
