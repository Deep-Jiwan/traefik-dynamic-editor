package main

import (
	"bufio"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
)

// Load .env file on startup
func init() {
	loadEnvFile(".env")
}

// loadEnvFile reads and sets environment variables from .env file
func loadEnvFile(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return // .env file is optional
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Parse KEY=VALUE
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			// Only set if not already set in environment
			if os.Getenv(key) == "" {
				os.Setenv(key, value)
			}
		}
	}
}

// Config holds the dynamic configuration path
var (
	configPath          = getEnv("DYNAMIC_CONFIG_PATH", "../dynamic/dynamic.yml")
	traefikConfigPath   = getEnv("TRAEFIK_CONFIG_PATH", "../config/traefik.yml")
	traefikDashboardURL = getEnv("TRAEFIK_DASHBOARD_URL", "")
	upgrader            = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	}
	wsClients        = make(map[*websocket.Conn]bool)
	wsMutex          sync.Mutex
	fileWatcher      *fsnotify.Watcher
	discoveryMutex   sync.Mutex
	discoveryRunning = false
)

// Get environment variable with default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
