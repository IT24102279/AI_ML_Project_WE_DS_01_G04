# fullAppRun.ps1
# Master script to run all components of the AI Pharmacy POS system:
# 1. Main POS (Backend & Frontend)
# 2. Customer Service & Shop (Backend & Frontend)
# 3. AI OCR Model Pipeline

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   AI Pharmacy POS - Full Application    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 0. Cleanup old processes to avoid port conflicts
Write-Host "Cleaning up old processes..." -ForegroundColor Gray
Get-Process -Name "node", "npx", "python", "python3" -ErrorAction SilentlyContinue | Stop-Process -Force

$Jobs = @()

# --- 1. Customer Service & Shop Microservices ---
Write-Host "`n[1/3] Starting Customer Service & Shop Microservices..." -ForegroundColor Green
Set-Location -Path "backend_customer"
if (-not (Test-Path "node_modules")) { 
    Write-Host "  Installing backend dependencies..." -ForegroundColor Cyan
    npm install 
}
Write-Host "  Seeding customer database..." -ForegroundColor Yellow
Start-Process -NoNewWindow -Wait -FilePath "npx.cmd" -ArgumentList "tsx src/seed.ts" 2>$null

$BackendCustomer = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "tsx src/index.ts"
$Jobs += $BackendCustomer
Set-Location -Path ".."

Set-Location -Path "frontend_customer"
if (-not (Test-Path "node_modules")) { npm install }
$FrontendCustomer = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run dev"
$Jobs += $FrontendCustomer
Set-Location -Path ".."


# --- 2. Main Pharmacy POS Services ---
Write-Host "`n[2/3] Starting Main Pharmacy POS Services..." -ForegroundColor Green
Set-Location -Path "backend"
if (-not (Test-Path "node_modules")) { 
    Write-Host "  Installing backend dependencies..." -ForegroundColor Cyan
    npm install 
}
Write-Host "  Seeding main database..." -ForegroundColor Yellow
Start-Process -NoNewWindow -Wait -FilePath "npx.cmd" -ArgumentList "tsx src/seed.ts" 2>$null

$BackendMain = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "tsx src/server.ts"
$Jobs += $BackendMain
Set-Location -Path ".."

Set-Location -Path "frontend"
if (-not (Test-Path "node_modules")) { npm install }
$FrontendMain = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" -ArgumentList "run dev"
$Jobs += $FrontendMain
Set-Location -Path ".."


# --- 3. AI OCR Model Pipeline ---
Write-Host "`n[3/3] Starting AI OCR Model Pipeline..." -ForegroundColor Blue
Set-Location -Path "ai_OCR_Model"
$py = "python"
try { python --version >$null 2>&1 } catch { $py = "python3" }

# Check requirements
Write-Host "  Checking Python requirements..." -ForegroundColor Gray
& $py -c "import flask, dotenv, requests, torch, cv2" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing requirements for OCR..." -ForegroundColor Yellow
    & $py -m pip install -r requirements.txt
}

$OCRJob = Start-Process -NoNewWindow -PassThru -FilePath $py -ArgumentList "ocr.py"
$Jobs += $OCRJob
Set-Location -Path ".."


# --- Final Status ---
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "All components are starting!" -ForegroundColor Green
Write-Host "Main POS URL:      http://localhost:5173" -ForegroundColor White
Write-Host "Customer App URL:  http://localhost:5174" -ForegroundColor White
Write-Host "OCR Backend URL:   http://localhost:5005" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Press [CTRL+C] to stop all services."

try {
    # Extract IDs for Wait-Process
    $jobIds = $Jobs | ForEach-Object { $_.Id }
    Wait-Process -Id $jobIds
}
catch {
    # Handle interruption
}
finally {
    Write-Host "`nStopping all services..." -ForegroundColor Yellow
    foreach ($job in $Jobs) {
        Stop-Process -Id $job.Id -ErrorAction SilentlyContinue
    }
    Write-Host "Cleanup complete." -ForegroundColor Gray
}
