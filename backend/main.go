package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"gopkg.in/yaml.v3"
)

// Config holds the dynamic configuration path
var (
	configPath        = getEnv("DYNAMIC_CONFIG_PATH", "../dynamic/dynamic.yml")
	traefikConfigPath = getEnv("TRAEFIK_CONFIG_PATH", "../config/traefik.yml")
	upgrader          = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	}
	wsClients   = make(map[*websocket.Conn]bool)
	wsMutex     sync.Mutex
	fileWatcher *fsnotify.Watcher
)

// TraefikStaticConfig represents the structure of traefik.yml
type TraefikStaticConfig struct {
	EntryPoints map[string]EntryPoint `yaml:"entryPoints" json:"entryPoints"`
}

type EntryPoint struct {
	Address string `yaml:"address" json:"address"`
}

// TraefikConfig represents the structure of dynamic.yml
type TraefikConfig struct {
	HTTP HTTPConfig `yaml:"http" json:"http"`
}

type HTTPConfig struct {
	Routers  map[string]Router  `yaml:"routers" json:"routers"`
	Services map[string]Service `yaml:"services" json:"services"`
}

type Router struct {
	Rule        string   `yaml:"rule" json:"rule"`
	EntryPoints []string `yaml:"entryPoints" json:"entryPoints"`
	Service     string   `yaml:"service" json:"service"`
	TLS         *TLS     `yaml:"tls,omitempty" json:"tls,omitempty"`
}

type TLS struct {
	CertResolver string `yaml:"certResolver,omitempty" json:"certResolver,omitempty"`
}

type Service struct {
	LoadBalancer LoadBalancer `yaml:"loadBalancer" json:"loadBalancer"`
}

type LoadBalancer struct {
	Servers []Server `yaml:"servers" json:"servers"`
}

type Server struct {
	URL string `yaml:"url" json:"url"`
}

func main() {
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
	api.HandleFunc("/ping", pingHandler).Methods("GET")
	api.HandleFunc("/entrypoints", getEntryPoints).Methods("GET")
	api.HandleFunc("/routers", listRouters).Methods("GET")
	api.HandleFunc("/routers/{name}", getRouter).Methods("GET")
	api.HandleFunc("/routers/{name}", createOrUpdateRouter).Methods("POST", "PUT")
	api.HandleFunc("/routers/{name}", deleteRouter).Methods("DELETE")
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

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GET /api/config - Get full configuration
func getConfig(w http.ResponseWriter, r *http.Request) {
	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// PUT /api/config - Update full configuration
func updateConfig(w http.ResponseWriter, r *http.Request) {
	var config TraefikConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if err := writeConfig(&config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Configuration updated"})
}

// GET /api/routers - List all routers
func listRouters(w http.ResponseWriter, r *http.Request) {
	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config.HTTP.Routers)
}

// GET /api/routers/{name} - Get specific router
func getRouter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	router, exists := config.HTTP.Routers[name]
	if !exists {
		http.Error(w, "Router not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(router)
}

// POST/PUT /api/routers/{name} - Create or update router
func createOrUpdateRouter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	var router Router
	if err := json.NewDecoder(r.Body).Decode(&router); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize maps if they don't exist
	if config.HTTP.Routers == nil {
		config.HTTP.Routers = make(map[string]Router)
	}
	if config.HTTP.Services == nil {
		config.HTTP.Services = make(map[string]Service)
	}

	// Add/update router
	config.HTTP.Routers[name] = router

	// Create corresponding service if it doesn't exist
	if _, exists := config.HTTP.Services[router.Service]; !exists {
		config.HTTP.Services[router.Service] = Service{
			LoadBalancer: LoadBalancer{
				Servers: []Server{},
			},
		}
	}

	if err := writeConfig(config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Router saved"})
}

// DELETE /api/routers/{name} - Delete router
func deleteRouter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if _, exists := config.HTTP.Routers[name]; !exists {
		http.Error(w, "Router not found", http.StatusNotFound)
		return
	}

	delete(config.HTTP.Routers, name)

	if err := writeConfig(config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Router deleted"})
}

// WebSocket handler for real-time updates
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}
	defer conn.Close()

	wsMutex.Lock()
	wsClients[conn] = true
	wsMutex.Unlock()

	log.Println("New WebSocket client connected")

	// Keep connection alive
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			wsMutex.Lock()
			delete(wsClients, conn)
			wsMutex.Unlock()
			log.Println("WebSocket client disconnected")
			break
		}
	}
}

// Watch config file for changes
func watchConfigFile() {
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		log.Println("Error getting absolute path:", err)
		return
	}

	if err := fileWatcher.Add(absPath); err != nil {
		log.Println("Error watching file:", err)
		return
	}

	log.Println("Started watching:", absPath)

	// Debounce timer
	var debounceTimer *time.Timer

	for {
		select {
		case event, ok := <-fileWatcher.Events:
			if !ok {
				return
			}

			if event.Op&fsnotify.Write == fsnotify.Write {
				// Debounce: only notify after 500ms of no changes
				if debounceTimer != nil {
					debounceTimer.Stop()
				}

				debounceTimer = time.AfterFunc(500*time.Millisecond, func() {
					log.Println("Config file changed, notifying clients")
					notifyClients()
				})
			}

		case err, ok := <-fileWatcher.Errors:
			if !ok {
				return
			}
			log.Println("File watcher error:", err)
		}
	}
}

// Notify all WebSocket clients of changes
func notifyClients() {
	config, err := readConfig()
	if err != nil {
		log.Println("Error reading config for notification:", err)
		return
	}

	message, err := json.Marshal(map[string]interface{}{
		"type": "config-updated",
		"data": config,
	})
	if err != nil {
		log.Println("Error marshaling notification:", err)
		return
	}

	wsMutex.Lock()
	defer wsMutex.Unlock()

	for client := range wsClients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Println("Error sending to client:", err)
			client.Close()
			delete(wsClients, client)
		}
	}
}

// Read configuration from file
func readConfig() (*TraefikConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var config TraefikConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

// GET /api/entrypoints - Get entry points from traefik.yml
func getEntryPoints(w http.ResponseWriter, r *http.Request) {
	staticConfig, err := readTraefikConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(staticConfig.EntryPoints)
}

// Read Traefik static configuration from traefik.yml
func readTraefikConfig() (*TraefikStaticConfig, error) {
	data, err := os.ReadFile(traefikConfigPath)
	if err != nil {
		return nil, err
	}

	var config TraefikStaticConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

// GET /api/ping?host=example.com - simple reachability check (uses https://<host>)
func pingHandler(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("host")
	if host == "" {
		http.Error(w, "missing host parameter", http.StatusBadRequest)
		return
	}
	// If a scheme query param is provided, only use that scheme.
	// Otherwise try HTTPS then HTTP.
	schemeParam := r.URL.Query().Get("scheme")
	client := &http.Client{Timeout: 3 * time.Second}
	result := map[string]interface{}{"status": "down"}

	var schemes []string
	if schemeParam != "" {
		if schemeParam == "https" {
			schemes = []string{"https://"}
		} else if schemeParam == "http" {
			schemes = []string{"http://"}
		} else {
			// invalid scheme
			http.Error(w, "invalid scheme parameter", http.StatusBadRequest)
			return
		}
	} else {
		schemes = []string{"https://", "http://"}
	}

	for _, scheme := range schemes {
		url := scheme + host
		start := time.Now()
		resp, err := client.Get(url)
		latency := time.Since(start).Milliseconds()

		if err != nil {
			// record error for this attempt, try next if available
			result["error"] = err.Error()
			result["latency_ms"] = latency
			continue
		}

		defer resp.Body.Close()
		result["status"] = "up"
		result["code"] = resp.StatusCode
		result["latency_ms"] = latency
		// if caller requested a specific scheme, return what we got
		break
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Write configuration to file
func writeConfig(config *TraefikConfig) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// Get environment variable with default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
