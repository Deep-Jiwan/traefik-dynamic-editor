package main

import (
	"log"
	"net/http"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/mux"
)

func main() {
	// Log configuration paths on startup
	log.Printf("Starting Traefik Dynamic Config Editor")
	log.Printf("Dynamic config path: %s", configPath)
	log.Printf("Traefik config path: %s", traefikConfigPath)
	log.Printf("Traefik Dashboard URL: %s", traefikDashboardURL)

	// Initialize discovery (queries Traefik API)
	if err := InitDiscovery(); err != nil {
		log.Printf("Warning: Discovery initialization failed: %v", err)
	}

	// Start discovery auto-refresh (every 5 minutes)
	go DiscoveryAutoRefresh()

	// Initialize file watcher
	var err error
	fileWatcher, err = fsnotify.NewWatcher()
	if err != nil {
		log.Fatal("Error creating file watcher:", err)
	}
	defer fileWatcher.Close()

	// Start watching the config file
	go watchConfigFile()

	// Setup router
	r := mux.NewRouter()

	// API Routes
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/config", getConfig).Methods("GET")
	api.HandleFunc("/config", updateConfig).Methods("PUT")
	api.HandleFunc("/yaml", getYAML).Methods("GET")
	api.HandleFunc("/yaml", updateYAML).Methods("PUT")
	api.HandleFunc("/ping", pingHandler).Methods("GET")
	api.HandleFunc("/health", healthHandler).Methods("GET")
	api.HandleFunc("/entrypoints", getEntryPoints).Methods("GET")
	api.HandleFunc("/routers", listRouters).Methods("GET")
	api.HandleFunc("/routers/{name}", getRouter).Methods("GET")
	api.HandleFunc("/routers/{name}", createOrUpdateRouter).Methods("POST", "PUT")
	api.HandleFunc("/routers/{name}", deleteRouter).Methods("DELETE")
	api.HandleFunc("/middlewares", getMiddlewares).Methods("GET")
	api.HandleFunc("/routers/{name}/auth", checkRouterAuthStatus).Methods("GET")
	api.HandleFunc("/discovery", getDiscovery).Methods("GET")
	api.HandleFunc("/discovery/auth", getDiscoveryAuth).Methods("GET")
	api.HandleFunc("/discovery/refresh", triggerDiscoveryRefresh).Methods("POST")
	api.HandleFunc("/ws", handleWebSocket)

	// Enable CORS
	r.Use(corsMiddleware)

	// Serve static files from the new React frontend
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("../frontend/editorfront/dist")))

	// Start server
	port := getEnv("PORT", "8010")
	log.Printf("Server starting on port %s", port)
	log.Printf("Watching config file: %s", configPath)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
