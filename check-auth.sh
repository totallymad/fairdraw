#!/bin/bash
# Скрипт для диагностики проблем с авторизацией

echo "=== Диагностика FairDraw ==="
echo ""

# Проверка .env
echo "1. Проверка файла .env"
if [ -f .env ]; then
    echo "✓ Файл .env существует"
    echo ""
    echo "Содержимое .env:"
    cat .env | grep -E "^(ADMIN_PASSWORD|SESSION_SECRET|PORT|CORS_ORIGIN)" | sed 's/=.*/=***/' 
    echo ""
    
    # Проверка ADMIN_PASSWORD
    if grep -q "^ADMIN_PASSWORD=" .env; then
        PASSWORD=$(grep "^ADMIN_PASSWORD=" .env | cut -d'=' -f2)
        if [ -z "$PASSWORD" ]; then
            echo "✗ ADMIN_PASSWORD пустой!"
        else
            echo "✓ ADMIN_PASSWORD установлен (длина: ${#PASSWORD} символов)"
        fi
    else
        echo "✗ ADMIN_PASSWORD не найден в .env!"
    fi
else
    echo "✗ Файл .env не найден!"
fi

echo ""
echo "2. Проверка docker-compose.yml"
if [ -f docker-compose.yml ]; then
    echo "✓ docker-compose.yml существует"
    if grep -q "env_file:" docker-compose.yml; then
        echo "✓ env_file указан в docker-compose.yml"
    else
        echo "⚠ env_file НЕ указан в docker-compose.yml!"
        echo "  Добавьте строку: env_file: - .env"
    fi
else
    echo "✗ docker-compose.yml не найден!"
fi

echo ""
echo "3. Проверка контейнера"
if docker compose ps | grep -q "fairdraw-app"; then
    echo "✓ Контейнер запущен"
    echo ""
    echo "Статус:"
    docker compose ps fairdraw
else
    echo "⚠ Контейнер не запущен"
    echo "  Запустите: docker compose up -d"
fi

echo ""
echo "4. Проверка логов (последние 20 строк)"
docker compose logs --tail=20 fairdraw | grep -E "(Диагностика|ADMIN_PASSWORD|Database|running)" || echo "Логи недоступны"

echo ""
echo "5. Проверка API health"
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✓ API доступен"
    curl -s http://localhost:3001/api/health | jq .
else
    echo "✗ API недоступен"
fi

echo ""
echo "=== Рекомендации ==="
echo ""
echo "Если ADMIN_PASSWORD не установлен:"
echo "1. Отредактируйте .env: nano .env"
echo "2. Добавьте: ADMIN_PASSWORD=ваш_пароль"
echo "3. Перезапустите: docker compose down && docker compose up -d"
echo ""
echo "Если пароль установлен, но не принимается:"
echo "1. Убедитесь, что нет пробелов вокруг ="
echo "2. Убедитесь, что нет кавычек вокруг значения"
echo "3. Проверьте, что вводите правильный пароль"
echo ""
