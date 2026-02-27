Write-Host "Starting Customer Service & Shop Microservices..." -ForegroundColor Green

Write-Host "▶ Checking Backend Dependencies..." -ForegroundColor Cyan
Set-Location -Path "backend_customer"
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "▶ Setting up isolated Customer Database..." -ForegroundColor Yellow
try {
    Start-Process -NoNewWindow -Wait -FilePath "npx.cmd" -ArgumentList "tsx src/seed.ts"
} catch {
    Write-Host "  (Database initialization encountered an issue)"
}

Write-Host "▶ Starting Node.js Backend Server on Port 4000..." -ForegroundColor Cyan
$BackendJob = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "tsx src/index.ts"
Set-Location -Path ".."

Start-Sleep -Seconds 2

Write-Host "▶ Checking Frontend Dependencies..." -ForegroundColor Cyan
Set-Location -Path "frontend_customer"
if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "▶ Starting React Vite Frontend Server on Port 5174..." -ForegroundColor Cyan
$FrontendJob = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run dev"
Set-Location -Path ".."

Write-Host "Both servers are running!" -ForegroundColor Green
Write-Host "Backend: http://localhost:4000"
Write-Host "Frontend: http://localhost:5174"
Write-Host "Press [CTRL+C] to stop both servers."

try {
    Wait-Process -Id $BackendJob.Id, $FrontendJob.Id
}
finally {
    Write-Host "Stopping servers..."
    Stop-Process -Id $BackendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $FrontendJob.Id -ErrorAction SilentlyContinue
}
