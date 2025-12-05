#!/bin/bash
# Bash script for running backend and frontend with hot reload
# Handles proper process management and graceful shutdown on Ctrl+C

set -e

echo "Starting Traefik Dynamic Editor - Local Development with Hot Reload"
echo "Press Ctrl+C to stop all services"
echo ""

# Get the root directory (parent of scripts folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend/editorfront"

# Arrays to track PIDs
declare -a PIDS=()
declare -a NAMES=()

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    
    # Kill all child processes
    for i in "${!PIDS[@]}"; do
        pid=${PIDS[$i]}
        name=${NAMES[$i]}
        
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
        fi
    done
    
    # Wait for processes to terminate gracefully
    sleep 1
    
    # Force kill any remaining processes
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
    
    echo "All services stopped."
    exit 0
}

# Trap Ctrl+C and other signals
trap cleanup SIGINT SIGTERM EXIT

# Start backend service
echo "[Backend] Starting Go service..."
cd "$BACKEND_DIR"
go run main.go &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
NAMES+=("backend-service")
echo "[Backend] Started (PID: $BACKEND_PID)"

# Start frontend service
echo "[Frontend] Starting build:watch..."
cd "$FRONTEND_DIR"
npm run build:watch &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)
NAMES+=("frontend-service")
echo "[Frontend] Started (PID: $FRONTEND_PID)"

echo ""
echo "Services running. Press Ctrl+C to stop."
echo ""

# Wait for all processes
wait
