# FairDraw Deployment Script for Windows
# Скрипт для сборки и загрузки на VDS

param(
    [Parameter(Mandatory=$true)]
    [string]$VdsHost,
    
    [string]$VdsUser = "root",
    [string]$VdsPath = "/opt/fairdraw",
    [string]$ImageName = "fairdraw",
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

Write-Host "=== FairDraw Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

# Проверка Docker
try {
    $null = docker --version
} catch {
    Write-Host "❌ Docker не установлен или не запущен" -ForegroundColor Red
    exit 1
}

# Сборка образа
Write-Host "📦 Сборка Docker образа..." -ForegroundColor Yellow
docker build -t "${ImageName}:${ImageTag}" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка сборки образа" -ForegroundColor Red
    exit 1
}

# Сохранение в архив
Write-Host ""
Write-Host "💾 Сохранение образа в архив..." -ForegroundColor Yellow
$archivePath = "${ImageName}.tar.gz"

# На Windows используем docker save + gzip через WSL или просто tar
if (Test-Path $archivePath) {
    Remove-Item $archivePath -Force
}

# Сохраняем образ
docker save "${ImageName}:${ImageTag}" -o "${ImageName}.tar"

# Сжимаем через gzip (если есть) или оставляем tar
if (Get-Command gzip -ErrorAction SilentlyContinue) {
    gzip -c "${ImageName}.tar" > $archivePath
    Remove-Item "${ImageName}.tar" -Force
} else {
    $archivePath = "${ImageName}.tar"
    Write-Host "⚠️  gzip не найден, используется .tar (больше размер)" -ForegroundColor Yellow
}

$size = (Get-Item $archivePath).Length / 1MB
Write-Host "✅ Образ сохранён: $archivePath ($([math]::Round($size, 2)) MB)" -ForegroundColor Green

# Загрузка на VDS
Write-Host ""
Write-Host "📤 Загрузка на VDS (${VdsUser}@${VdsHost})..." -ForegroundColor Yellow
scp $archivePath "${VdsUser}@${VdsHost}:${VdsPath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка загрузки на VDS" -ForegroundColor Red
    exit 1
}

# Деплой на VDS
Write-Host ""
Write-Host "🚀 Деплой на VDS..." -ForegroundColor Yellow

$sshCommand = @"
cd ${VdsPath}

# Загрузка образа
echo "Загрузка образа..."
docker load < ${archivePath}

# Перезапуск контейнера
echo "Перезапуск контейнера..."
docker compose down || true
docker compose up -d

# Проверка статуса
echo ""
echo "Статус контейнера:"
docker compose ps

# Очистка
rm -f ${archivePath}

echo ""
echo "✅ Деплой завершён!"
"@

ssh "${VdsUser}@${VdsHost}" $sshCommand
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка деплоя" -ForegroundColor Red
    exit 1
}

# Очистка локальных файлов
Write-Host ""
Write-Host "🧹 Очистка локальных файлов..." -ForegroundColor Yellow
Remove-Item $archivePath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Green
Write-Host "Приложение доступно на http://${VdsHost}:3001" -ForegroundColor Cyan
