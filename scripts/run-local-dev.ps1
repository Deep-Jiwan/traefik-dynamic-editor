# PowerShell script for running backend and frontend in development mode with live reload
# Handles proper process management and graceful shutdown on Ctrl+C

$ErrorActionPreference = "Stop"

Write-Host "Starting Traefik Dynamic Editor - Local Development with Live Reload" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Get the root directory (parent of scripts folder)
$rootDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path (Join-Path $rootDir "frontend") "editorfront"

# Set environment variables for Traefik Dashboard discovery (optional)
# Update this to your actual Traefik dashboard URL if available
$env:TRAEFIK_DASHBOARD_URL = "http://localhost:8080"

# Track running jobs
$jobs = @()

try {
    # Start backend service
    Write-Host "[Backend] Starting Go service..." -ForegroundColor Cyan
    Write-Host "[Backend] TRAEFIK_DASHBOARD_URL: $env:TRAEFIK_DASHBOARD_URL" -ForegroundColor Gray
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:backendDir
        $env:TRAEFIK_DASHBOARD_URL = $using:env:TRAEFIK_DASHBOARD_URL
        & go run .
    } -Name "backend-service"
    $jobs += $backendJob
    Write-Host "[Backend] Started (Job ID: $($backendJob.Id))" -ForegroundColor Green

    # Start frontend service in dev mode
    Write-Host "[Frontend] Starting dev server with live reload..." -ForegroundColor Cyan
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location $using:frontendDir
        & npm run dev
    } -Name "frontend-dev"
    $jobs += $frontendJob
    Write-Host "[Frontend] Started (Job ID: $($frontendJob.Id))" -ForegroundColor Green

    Write-Host ""
    Write-Host "Services running. Monitoring for output..." -ForegroundColor Green
    Write-Host ""

    # Monitor jobs and stream output
    $allRunning = $true
    while ($allRunning) {
        $allRunning = $false
        
        foreach ($job in $jobs) {
            if ($job.State -eq "Running") {
                $allRunning = $true
                
                # Receive and display job output
                $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
                if ($output) {
                    Write-Host $output
                }
            }
            elseif ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
                $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
                if ($output) {
                    Write-Host $output -ForegroundColor Red
                }
                Write-Host "[$($job.Name)] Process ended with state: $($job.State)" -ForegroundColor Red
            }
        }
        
        Start-Sleep -Milliseconds 100
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    Write-Host ""
    Write-Host "Shutting down services..." -ForegroundColor Yellow
    
    # Stop all jobs gracefully
    foreach ($job in $jobs) {
        if ($job.State -eq "Running") {
            Write-Host "Stopping $($job.Name)..." -ForegroundColor Cyan
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "All services stopped." -ForegroundColor Green
    exit 0
}
