package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"gopkg.in/yaml.v3"
)

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

// GET /api/config - Get full configuration from all router files
func getConfig(w http.ResponseWriter, r *http.Request) {
	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// PUT /api/config - Update full configuration by writing to individual router files
func updateConfig(w http.ResponseWriter, r *http.Request) {
	var config TraefikConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Write each router to its own file
	if config.HTTP.Routers != nil {
		for routerName, router := range config.HTTP.Routers {
			// Find the corresponding service
			var service Service
			if config.HTTP.Services != nil {
				if svc, exists := config.HTTP.Services[router.Service]; exists {
					service = svc
				}
			}

			// Create router config with router and its service
			routerConfig := TraefikConfig{
				HTTP: HTTPConfig{
					Routers: map[string]Router{
						routerName: router,
					},
					Services: map[string]Service{
						router.Service: service,
					},
				},
			}

			// Write to individual router file
			data, err := yaml.Marshal(routerConfig)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to marshal router %s: %v", routerName, err), http.StatusInternalServerError)
				return
			}

			dir := filepath.Dir(configPath)
			routerPath := filepath.Join(dir, fmt.Sprintf("router-%s.yml", routerName))
			if err := os.WriteFile(routerPath, data, 0644); err != nil {
				http.Error(w, fmt.Sprintf("Failed to write router file %s: %v", routerName, err), http.StatusInternalServerError)
				return
			}

			log.Printf("Updated router file: %s", routerPath)
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Configuration updated"})
}

// GET /api/yaml - Get raw YAML configuration
func getYAML(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/yaml")
	w.Header().Set("Content-Disposition", "inline")
	w.Write(data)
}

// PUT /api/yaml - Update raw YAML configuration
func updateYAML(w http.ResponseWriter, r *http.Request) {
	// Read raw YAML body
	yamlData, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Validate YAML by unmarshaling it
	var config TraefikConfig
	if err := yaml.Unmarshal(yamlData, &config); err != nil {
		log.Printf("YAML validation error: %v", err)
		log.Printf("YAML content: %s", string(yamlData))
		http.Error(w, "Format not followed, please check your YAML structure", http.StatusBadRequest)
		return
	}

	// Write the YAML file directly
	if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
		log.Printf("Failed to write config file: %v", err)
		http.Error(w, fmt.Sprintf("Failed to write config: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("YAML configuration updated successfully")
	// Notify WebSocket clients of update
	notifyClients()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "YAML configuration updated"})
}

// GET /api/routers - List all routers
func listRouters(w http.ResponseWriter, r *http.Request) {
	config, err := readConfig()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// First, try to load routers from individual router-*.yml files
	routers := make(map[string]Router)

	// Scan the directory for router-*.yml files
	dir := filepath.Dir(configPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("Warning: Failed to read directory %s: %v", dir, err)
		// Fall back to config routers if directory read fails
		if config.HTTP.Routers != nil {
			routers = config.HTTP.Routers
		}
	} else {
		for _, entry := range entries {
			if !entry.IsDir() && strings.HasPrefix(entry.Name(), "router-") && strings.HasSuffix(entry.Name(), ".yml") {
				// Extract router name from filename (router-{name}.yml)
				routerName := strings.TrimPrefix(entry.Name(), "router-")
				routerName = strings.TrimSuffix(routerName, ".yml")

				// Read the individual router file
				routerPath := filepath.Join(dir, entry.Name())
				data, err := os.ReadFile(routerPath)
				if err != nil {
					log.Printf("Warning: Failed to read router file %s: %v", routerPath, err)
					continue
				}

				var routerConfig TraefikConfig
				if err := yaml.Unmarshal(data, &routerConfig); err != nil {
					log.Printf("Warning: Failed to parse router file %s: %v", routerPath, err)
					continue
				}

				// Extract the router from the file
				if routerConfig.HTTP.Routers != nil && len(routerConfig.HTTP.Routers) > 0 {
					for _, router := range routerConfig.HTTP.Routers {
						routers[routerName] = router
						break // Take the first router in the file
					}
				}
			}
		}
	}

	// Ensure we always return a valid JSON object (empty map if no routers)
	if routers == nil {
		routers = make(map[string]Router)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(routers)
}

// GET /api/routers/{name} - Get specific router
func getRouter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	// Try to read from individual router file first
	dir := filepath.Dir(configPath)
	routerPath := filepath.Join(dir, fmt.Sprintf("router-%s.yml", name))
	
	data, err := os.ReadFile(routerPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Fall back to consolidated config
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
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var routerConfig TraefikConfig
	if err := yaml.Unmarshal(data, &routerConfig); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse router file: %v", err), http.StatusInternalServerError)
		return
	}

	// Extract the router from the file
	if routerConfig.HTTP.Routers != nil && len(routerConfig.HTTP.Routers) > 0 {
		for _, router := range routerConfig.HTTP.Routers {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(router)
			return
		}
	}

	http.Error(w, "Router not found in file", http.StatusNotFound)
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

	// Create service data from request body if provided
	// Need to check if service data was included
	type RouterUpdateRequest struct {
		Router  Router
		Service Service
	}

	// Try to decode as extended format first
	var updateReq RouterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
		// Fall back to simple router format
		updateReq.Router = router
		updateReq.Service = Service{
			LoadBalancer: LoadBalancer{
				Servers: []Server{},
			},
		}
	}

	// Write router file with service
	routerConfig := TraefikConfig{
		HTTP: HTTPConfig{
			Routers: map[string]Router{
				name: router,
			},
			Services: map[string]Service{
				router.Service: updateReq.Service,
			},
		},
	}

	data, err := yaml.Marshal(routerConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal router: %v", err), http.StatusInternalServerError)
		return
	}

	dir := filepath.Dir(configPath)
	routerPath := filepath.Join(dir, fmt.Sprintf("router-%s.yml", name))
	if err := os.WriteFile(routerPath, data, 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write router file: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("Created/updated router file: %s", routerPath)

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

	_, exists := config.HTTP.Routers[name]
	if !exists {
		http.Error(w, "Router not found", http.StatusNotFound)
		return
	}

	// Delete the individual router file
	routerFilePath := filepath.Join(filepath.Dir(configPath), fmt.Sprintf("router-%s.yml", name))
	if err := os.Remove(routerFilePath); err != nil && !os.IsNotExist(err) {
		http.Error(w, fmt.Sprintf("Failed to delete router file: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("Deleted router file: %s", routerFilePath)
	notifyClients()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Router deleted"})
}

// GET /api/middlewares - Get available middlewares from discovery
func getMiddlewares(w http.ResponseWriter, r *http.Request) {
	discoveryData, err := ReadDiscoveryData()
	if err != nil {
		log.Printf("Error reading discovery data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to read discovery data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(discoveryData.Middlewares)
}

// GET /api/ping?host=example.com - simple reachability check
func pingHandler(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("host")
	if host == "" {
		http.Error(w, "missing host parameter", http.StatusBadRequest)
		return
	}

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
			result["error"] = err.Error()
			result["latency_ms"] = latency
			continue
		}

		defer resp.Body.Close()
		result["status"] = "up"
		result["code"] = resp.StatusCode
		result["latency_ms"] = latency
		break
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GET /api/health - simple health check
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GET /api/routers/{name}/auth - Check if router uses authentication
func checkRouterAuthStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	routerName := vars["name"]

	// Read discovery data to get auth status
	discovery, err := ReadDiscoveryData()
	if err != nil {
		log.Printf("Warning: Failed to read discovery data: %v", err)
		// If discovery data unavailable, return false (no auth assumed)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"router_name": routerName,
			"uses_auth":   false,
			"cached":      false,
		})
		return
	}

	// Find auth status for this router
	usesAuth := false
	for _, auth := range discovery.UsesAuth {
		if auth.RouterName == routerName {
			usesAuth = auth.UsesAuth
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"router_name": routerName,
		"uses_auth":   usesAuth,
		"cached":      true,
	})
}

// GET /api/discovery - Get complete discovery data
func getDiscovery(w http.ResponseWriter, r *http.Request) {
	discoveryData, err := ReadDiscoveryData()
	if err != nil {
		log.Printf("Error reading discovery data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to read discovery data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(discoveryData)
}

// GET /api/discovery/auth - Get router auth status list
func getDiscoveryAuth(w http.ResponseWriter, r *http.Request) {
	discoveryData, err := ReadDiscoveryData()
	if err != nil {
		log.Printf("Error reading discovery data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to read discovery data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(discoveryData.UsesAuth)
}

// POST /api/discovery/refresh - Manually trigger discovery refresh
func triggerDiscoveryRefresh(w http.ResponseWriter, r *http.Request) {
	// Trigger discovery in background
	go func() {
		log.Println("Manual discovery refresh triggered from frontend")
		if err := InitDiscovery(); err != nil {
			log.Printf("Manual discovery refresh error: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Discovery refresh triggered",
		"status":  "success",
	})
}
