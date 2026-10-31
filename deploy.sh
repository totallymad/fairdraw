#!/bin/bash
# Скрипт для сборки и загрузки на VDS

set -e

echo "=== FairDraw Deployment Script ==="
echo ""

# Конфигурация
IMAGE_NAME="fairdraw"
IMAGE_TAG="latest"
VDS_USER="${VDS_USER:-root}"
VDS_HOST="${VDS_HOST:-}"
VDS_PATH="${VDS_PATH:-/opt/fairdraw}"

# Проверка переменных
if [ -z "$VDS_HOST" ]; then
    echo "❌ Укажите VDS_HOST:"
    echo "   export VDS_HOST=your-vds-ip"
    exit 1
fi

echo "📦 Сборка Docker образа..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo ""
echo "💾 Сохранение образа в архив..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > ${IMAGE_NAME}.tar.gz

SIZE=$(du -h ${IMAGE_NAME}.tar.gz | cut -f1)
echo "✅ Образ сохранён: ${IMAGE_NAME}.tar.gz (${SIZE})"

echo ""
echo "📤 Загрузка на VDS (${VDS_USER}@${VDS_HOST})..."
scp ${IMAGE_NAME}.tar.gz ${VDS_USER}@${VDS_HOST}:${VDS_PATH}/

echo ""
echo "🚀 Деплой на VDS..."
ssh ${VDS_USER}@${VDS_HOST} << EOF
    cd ${VDS_PATH}
    
    # Загрузка образа
    echo "Загрузка образа..."
    docker load < ${IMAGE_NAME}.tar.gz
    
    # Перезапуск контейнера
    echo "Перезапуск контейнера..."
    docker compose down || true
    docker compose up -d
    
    # Проверка статуса
    echo ""
    echo "Статус контейнера:"
    docker compose ps
    
    # Очистка
    rm -f ${IMAGE_NAME}.tar.gz
    
    echo ""
    echo "✅ Деплой завершён!"
EOF

echo ""
echo "🧹 Очистка локальных файлов..."
rm -f ${IMAGE_NAME}.tar.gz

echo ""
echo "=== Готово! ==="
echo "Приложение доступно на http://${VDS_HOST}:3001"
