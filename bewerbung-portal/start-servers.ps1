Write-Host "Starte Bewerbungsportal Server..." -ForegroundColor Green
Write-Host ""

# Terminal 1: Backend
Write-Host "-> Backend wird gestartet auf Port 3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\julia\OneDrive\Desktop\irgendwas\bewerbung-portal\backend'; npm start"

# Warte kurz
Start-Sleep -Seconds 2

# Terminal 2: Frontend
Write-Host "-> Frontend wird gestartet auf Port 8080..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\julia\OneDrive\Desktop\irgendwas\bewerbung-portal\public'; npx http-server -p 8080"

Write-Host ""
Write-Host "Beide Server starten jetzt!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:8080" -ForegroundColor Yellow
Write-Host "Admin Login: http://localhost:8080/admin/login.html" -ForegroundColor Yellow
Write-Host "Backend API: http://localhost:3000" -ForegroundColor Yellow
