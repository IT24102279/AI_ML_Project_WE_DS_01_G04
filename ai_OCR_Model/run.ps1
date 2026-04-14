# Try to find the python command
$py = "python"
try { python --version >$null 2>&1 } catch { $py = "python3" }
try { python3 --version >$null 2>&1 } catch { 
    if ($py -eq "python3") {
        Write-Host "Error: Python was not found. Please ensure Python is installed and added to your PATH." -ForegroundColor Red
        exit
    }
}

Write-Host "Checking requirements..." -ForegroundColor Cyan

# Check for key dependencies
& $py -c "import flask, dotenv, requests, torch, cv2" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Requirements missing. Installing..." -ForegroundColor Yellow
    & $py -m pip install -r requirements.txt
} else {
    Write-Host "Requirements satisfied." -ForegroundColor Green
}

Write-Host "Starting Transcription OCR Pipeline..." -ForegroundColor Blue
& $py ocr.py
