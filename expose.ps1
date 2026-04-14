# expose.ps1
# This script uses localtunnel to expose the application to the internet.
# Requires: Node.js and NPM

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Exposing AI Pharmacy POS to Internet  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if localtunnel is installed, if not, it will be handled by npx
Write-Host "Starting tunnels..." -ForegroundColor Gray

$Tunnels = @()

# 1. Main POS Frontend
Write-Host "Exposing Main POS Frontend (5173)..." -ForegroundColor Green
$FrontendMain = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "localtunnel --port 5173"
$Tunnels += $FrontendMain

# 2. Customer App Frontend
Write-Host "Exposing Customer App Frontend (5174)..." -ForegroundColor Green
$FrontendCustomer = Start-Process -NoNewWindow -PassThru -FilePath "npx.cmd" -ArgumentList "localtunnel --port 5174"
$Tunnels += $FrontendCustomer

Write-Host "`nAll tunnels requested. Check the console output above for the public URLs." -ForegroundColor Yellow
Write-Host "Note: You must keep this script running to maintain the connection." -ForegroundColor Gray
Write-Host "Press [CTRL+C] to stop all tunnels."

try {
    Wait-Process -Id ($Tunnels | ForEach-Object { $_.Id })
}
finally {
    Write-Host "Stopping tunnels..."
    foreach ($t in $Tunnels) { Stop-Process -Id $t.Id -ErrorAction SilentlyContinue }
}
