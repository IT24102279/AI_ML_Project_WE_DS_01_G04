# setup.ps1
# Full Application Setup Script for AI Pharmacy POS
# - Configures .env files
# - Creates databases based on .env credentials
# - Installs all Node.js and Python dependencies

Write-Host "============================" -ForegroundColor Cyan
Write-Host "   AI Pharmacy POS Setup    " -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# 1. Ensure .env files exist (create with defaults if missing)
if (-not (Test-Path "backend/.env")) {
    Write-Host "Creating default .env for backend..." -ForegroundColor Gray
    "DATABASE_URL=mysql://root:root@127.0.0.1:3306/pharmacy_pos`nPORT=5000" | Out-File -FilePath "backend/.env" -Encoding utf8
}
if (-not (Test-Path "backend_customer/.env")) {
    Write-Host "Creating default .env for backend_customer..." -ForegroundColor Gray
    "PORT=4000`nDB_HOST=127.0.0.1`nDB_PORT=3306`nDB_USER=root`nDB_PASSWORD=root`nDB_NAME=pharmacy_customer_db" | Out-File -FilePath "backend_customer/.env" -Encoding utf8
}

# 2. Extract Credentials & Create Databases
Write-Host "`n[1/3] Setting up Databases..." -ForegroundColor Green

function Get-EnvVar {
    param($file, $key)
    $content = Get-Content $file
    foreach ($line in $content) {
        if ($line -match "^$key=(.*)") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

# Parse backend .env for Main Database
$dbUrl = Get-EnvVar "backend/.env" "DATABASE_URL"
$DB_USER_MAIN = "root"
$DB_PASS_MAIN = ""
$DB_NAME_MAIN = "pharmacy_pos"

if ($dbUrl -match "mysql://(.*?):(.*?)@(.*?):(.*?)/(.*)") {
    $DB_USER_MAIN = $Matches[1]
    $DB_PASS_MAIN = $Matches[2]
    $DB_NAME_MAIN = $Matches[5]
}

# Parse customer .env for Customer Database
$DB_NAME_CUST = Get-EnvVar "backend_customer/.env" "DB_NAME"
$DB_USER_CUST = Get-EnvVar "backend_customer/.env" "DB_USER"
$DB_PASS_CUST = Get-EnvVar "backend_customer/.env" "DB_PASSWORD"

Write-Host "  Extracted DB Main: $DB_NAME_MAIN (User: $DB_USER_MAIN)" -ForegroundColor Gray
Write-Host "  Extracted DB Cust: $DB_NAME_CUST" -ForegroundColor Gray

# Create Databases via MySQL CLI
$mysqlFound = $false
try {
    Get-Command mysql -ErrorAction Stop | Out-Null
    $mysqlFound = $true
}
catch {
    $mysqlFound = $false
}

if ($mysqlFound) {
    Write-Host "  Creating databases..." -ForegroundColor Yellow
    $passArgMain = if ($DB_PASS_MAIN) { "-p$DB_PASS_MAIN" } else { "" }
    $passArgCust = if ($DB_PASS_CUST) { "-p$DB_PASS_CUST" } else { "" }
    
    try {
        # Create Main DB
        & mysql -u $DB_USER_MAIN $passArgMain -e "CREATE DATABASE IF NOT EXISTS $DB_NAME_MAIN;" 2>$null
        # Create Customer DB
        & mysql -u $DB_USER_CUST $passArgCust -e "CREATE DATABASE IF NOT EXISTS $DB_NAME_CUST;" 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Databases ensured successfully." -ForegroundColor Green
        }
        else {
            Write-Host "  [WARNING] Databases might not have been created. Check if MySQL is running." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  [ERROR] Error during DB creation: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "  [ERROR] 'mysql' CLI not found. Please ensure MySQL is installed and added to PATH." -ForegroundColor Red
}

# 3. NPM Installs
Write-Host "`n[2/3] Installing Node.js dependencies..." -ForegroundColor Green
$projects = @("backend", "frontend", "backend_customer", "frontend_customer")
foreach ($proj in $projects) {
    if (Test-Path $proj) {
        Write-Host "  Processing $proj..." -ForegroundColor Cyan
        Set-Location -Path $proj
        npm install
        Set-Location -Path ".."
    }
}

# 4. Python Installs
Write-Host "`n[3/3] Installing Python dependencies for AI OCR Model..." -ForegroundColor Green
if (Test-Path "ai_OCR_Model") {
    Set-Location -Path "ai_OCR_Model"
    $py = "python"
    try {
        python --version >$null 2>&1
    }
    catch {
        $py = "python3"
    }
    
    Write-Host "  Using $py to install requirements..." -ForegroundColor Cyan
    & $py -m pip install --upgrade pip --user
    & $py -m pip install -r requirements.txt --user
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: Python package installation had issues. Try running manually:" -ForegroundColor Yellow
        Write-Host "  cd ai_OCR_Model && python -m pip install -r requirements.txt --user" -ForegroundColor Yellow
    }
    Set-Location -Path ".."
}

Write-Host "`n============================" -ForegroundColor Green
Write-Host "   Setup Completed Successfully! " -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host "You can now run the app using: .\fullAppRun.ps1"
