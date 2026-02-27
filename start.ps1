# Ensure MySQL is running
$containerExists = docker ps -a -q -f name=pharmacy-mysql
if (-not $containerExists) {
    Write-Host "Creating and starting MySQL container..."
    docker run -d --name pharmacy-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=pharmacy_pos -p 3306:3306 mysql:8.4
} else {
    $containerRunning = docker ps -q -f name=pharmacy-mysql
    if (-not $containerRunning) {
        Write-Host "Starting existing MySQL container..."
        docker start pharmacy-mysql
    }
}

Write-Host "Waiting for MySQL database to initialize..."
while ($true) {
    $ping = docker exec pharmacy-mysql mysqladmin ping -h localhost --silent 2>$null
    if ($LASTEXITCODE -eq 0) {
        break
    }
    Start-Sleep -Seconds 3
}

Write-Host "Database is ready."

Write-Host "Starting Backend Server..."
Set-Location -Path "backend"
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "Setting up database schema and seeding..."
npx tsx src/seed.ts

Write-Host "Running Backend on port 5000..."
$BackendJob = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "tsx src/server.ts"
Set-Location -Path ".."

Write-Host "Starting Frontend App..."
Set-Location -Path "frontend"
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "Running Frontend on port 5173..."
$FrontendJob = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run dev"
Set-Location -Path ".."

Write-Host "Pharmacy POS system is running."
Write-Host "Backend PID: $($BackendJob.Id)"
Write-Host "Frontend PID: $($FrontendJob.Id)"

try {
    Wait-Process -Id $BackendJob.Id, $FrontendJob.Id
}
finally {
    Write-Host "Stopping servers..."
    Stop-Process -Id $BackendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $FrontendJob.Id -ErrorAction SilentlyContinue
}
