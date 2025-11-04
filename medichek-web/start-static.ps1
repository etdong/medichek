# Quick Start Script for Medichek Web (Static)
# This starts a simple HTTP server for testing the static site

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Medichek Web - Static Site Server" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Python found: $pythonCmd" -ForegroundColor Green
Write-Host ""

# Configuration
$port = 8080
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Port: $port" -ForegroundColor White
Write-Host "  Django Server: Check static/config.js" -ForegroundColor White
Write-Host ""

Write-Host "Starting HTTP server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Server Running!                       ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Open: http://localhost:$port          ║" -ForegroundColor Green
Write-Host "║                                        ║" -ForegroundColor Green
Write-Host "║  Press Ctrl+C to stop server          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Note: This is a STATIC site - no Flask required!" -ForegroundColor Cyan
Write-Host "      All tracking happens in your browser." -ForegroundColor Cyan
Write-Host ""

# Start server
try {
    & $pythonCmd -m http.server $port
} catch {
    Write-Host ""
    Write-Host "Server stopped." -ForegroundColor Yellow
}
