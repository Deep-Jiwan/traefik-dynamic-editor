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
)

// DiscoveryMiddleware represents middleware information from Traefik API
type DiscoveryMiddleware struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	Provider string `json:"provider"`
	Type     string `json:"type"`
}

// RouterAuthInfo represents authentication status for a router
type RouterAuthInfo struct {
	RouterName string `json:"router_name"`
	UsesAuth   bool   `json:"uses_auth"`
}

// DiscoveryData holds all discovered information
type DiscoveryData struct {
	Middlewares []DiscoveryMiddleware `json:"middlewares"`
	UsesAuth    []RouterAuthInfo      `json:"uses_auth"`
	LastUpdated string                `json:"lastUpdated"`
}

// TraefikMiddleware represents the raw response from Traefik API
type TraefikMiddleware struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	Provider string `json:"provider"`
	Type     string `json:"type"`
}

// DiscoverMiddlewares queries the Traefik dashboard API and saves middleware info
func DiscoverMiddlewares(dashboardURL string) error {
	if dashboardURL == "" {
		log.Println("Warning: TRAEFIK_DASHBOARD_URL not set, skipping discovery")
		return nil
	}

	log.Printf("Starting middleware discovery from: %s", dashboardURL)

	// Build the API URL
	apiURL := dashboardURL + "/api/http/middlewares"
	log.Printf("Querying Traefik API: %s", apiURL)

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Make the request
	resp, err := client.Get(apiURL)
	if err != nil {
		return fmt.Errorf("failed to query Traefik API: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Traefik API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var traefikMiddlewares []TraefikMiddleware
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if err := json.Unmarshal(body, &traefikMiddlewares); err != nil {
		log.Printf("Debug: Response body: %s", string(body))
		return fmt.Errorf("failed to parse Traefik response: %w", err)
	}

	log.Printf("Discovered %d middlewares", len(traefikMiddlewares))

	// Convert to DiscoveryMiddleware format
	discoveryMiddlewares := make([]DiscoveryMiddleware, 0, len(traefikMiddlewares))
	for _, tm := range traefikMiddlewares {
		discoveryMiddlewares = append(discoveryMiddlewares, DiscoveryMiddleware{
			Name:     tm.Name,
			Status:   tm.Status,
			Provider: tm.Provider,
			Type:     tm.Type,
		})
	}

	// Create discovery data
	discovery := DiscoveryData{
		Middlewares: discoveryMiddlewares,
		LastUpdated: time.Now().UTC().Format(time.RFC3339),
	}

	// Save to discovery.json in backend folder
	discoveryFilePath := "discovery.json"
	data, err := json.MarshalIndent(discovery, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal discovery data: %w", err)
	}

	if err := os.WriteFile(discoveryFilePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write discovery file: %w", err)
	}

	log.Printf("Discovery data saved to %s", discoveryFilePath)
	return nil
}

// CheckRouterAuth checks if a router uses authentication by examining its middlewares
func CheckRouterAuth(dashboardURL string, routerName string) (bool, error) {
	if dashboardURL == "" {
		return false, nil
	}

	// Try with @file suffix first (Traefik file provider routers are registered as name@file)
	possibleNames := []string{
		routerName + "@file",
		routerName,
	}

	var routerData map[string]interface{}
	var found bool

	for _, name := range possibleNames {
		// Get the router configuration
		routerURL := dashboardURL + "/api/http/routers/" + name
		client := &http.Client{
			Timeout: 10 * time.Second,
		}

		resp, err := client.Get(routerURL)
		if err != nil {
			log.Printf("Debug: Failed to get router %s: %v", name, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Printf("Debug: Router %s not found (status %d)", name, resp.StatusCode)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}

		if err := json.Unmarshal(body, &routerData); err != nil {
			log.Printf("Debug: Failed to parse router data for %s: %v", name, err)
			continue
		}

		found = true
		log.Printf("Debug: Found router %s with middlewares: %v", name, routerData["middlewares"])
		break
	}

	if !found {
		log.Printf("Warning: Router %s not found in Traefik", routerName)
		return false, nil
	}

	// Check if middlewares field exists and contains any middlewares
	middlewares, ok := routerData["middlewares"].([]interface{})
	if !ok || len(middlewares) == 0 {
		log.Printf("Debug: Router %s has no middlewares", routerName)
		return false, nil
	}

	log.Printf("Debug: Checking %d middlewares for router %s", len(middlewares), routerName)

	// Check each middleware for forwardAuth type
	for _, m := range middlewares {
		middlewareName := fmt.Sprintf("%v", m)
		log.Printf("Debug: Checking middleware %s", middlewareName)

		// Get middleware details
		middlewareURL := dashboardURL + "/api/http/middlewares/" + middlewareName
		client := &http.Client{
			Timeout: 10 * time.Second,
		}
		resp, err := client.Get(middlewareURL)
		if err != nil {
			log.Printf("Debug: Failed to get middleware %s: %v", middlewareName, err)
			continue
		}

		middlewareBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("Debug: Failed to read middleware body for %s: %v", middlewareName, err)
			continue
		}

		var middlewareData map[string]interface{}
		if err := json.Unmarshal(middlewareBody, &middlewareData); err != nil {
			log.Printf("Debug: Failed to parse middleware data for %s: %v", middlewareName, err)
			continue
		}

		log.Printf("Debug: Middleware %s data: %v", middlewareName, middlewareData)

		// Check if this middleware is a forwardAuth type
		if middlewareType, ok := middlewareData["type"].(string); ok {
			log.Printf("Debug: Middleware %s type: %s", middlewareName, middlewareType)
			if strings.EqualFold(middlewareType, "forwardauth") {
				log.Printf("Info: Router %s uses forwardAuth middleware: %s", routerName, middlewareName)
				return true, nil
			}
		}
	}

	log.Printf("Info: Router %s does not use forwardAuth", routerName)
	return false, nil
}

// DiscoverRouterAuth scans all router files and checks which ones use authentication
func DiscoverRouterAuth(dashboardURL string) ([]RouterAuthInfo, error) {
	authInfo := make([]RouterAuthInfo, 0)

	if dashboardURL == "" {
		log.Println("Warning: TRAEFIK_DASHBOARD_URL not set, skipping router auth discovery")
		return authInfo, nil
	}

	// Scan the directory for router-*.yml files
	dir := filepath.Dir(configPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("Warning: Failed to read directory %s: %v", dir, err)
		return authInfo, err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "router-") && strings.HasSuffix(entry.Name(), ".yml") {
			// Extract router name from filename (router-{name}.yml)
			routerName := strings.TrimPrefix(entry.Name(), "router-")
			routerName = strings.TrimSuffix(routerName, ".yml")

			// Check if this router uses authentication
			usesAuth, _ := CheckRouterAuth(dashboardURL, routerName)

			authInfo = append(authInfo, RouterAuthInfo{
				RouterName: routerName,
				UsesAuth:   usesAuth,
			})

			log.Printf("Router %s: uses_auth=%v", routerName, usesAuth)
		}
	}

	return authInfo, nil
}

// ReadDiscoveryData reads the complete discovery data from discovery.json
func ReadDiscoveryData() (*DiscoveryData, error) {
	discoveryPath := "discovery.json"
	data, err := os.ReadFile(discoveryPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("Warning: discovery.json not found, creating initial file")
			// Create initial empty discovery file
			initialData := &DiscoveryData{
				Middlewares: []DiscoveryMiddleware{},
				UsesAuth:    []RouterAuthInfo{},
				LastUpdated: time.Now().UTC().Format(time.RFC3339),
			}
			// Write initial file
			if initErr := writeDiscoveryData(initialData); initErr != nil {
				log.Printf("Warning: Failed to create initial discovery.json: %v", initErr)
			}
			return initialData, nil
		}
		return nil, fmt.Errorf("failed to read discovery.json: %w", err)
	}

	var discovery DiscoveryData
	if err := json.Unmarshal(data, &discovery); err != nil {
		return nil, fmt.Errorf("failed to parse discovery.json: %w", err)
	}

	return &discovery, nil
}

// writeDiscoveryData writes discovery data to discovery.json
func writeDiscoveryData(discovery *DiscoveryData) error {
	discoveryFilePath := "discovery.json"
	data, err := json.MarshalIndent(discovery, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal discovery data: %w", err)
	}

	if err := os.WriteFile(discoveryFilePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write discovery file: %w", err)
	}

	return nil
}

// ReadDiscoveredMiddlewares reads middlewares from discovery.json (for backward compatibility)
func ReadDiscoveredMiddlewares() ([]DiscoveryMiddleware, error) {
	discovery, err := ReadDiscoveryData()
	if err != nil {
		return nil, err
	}
	return discovery.Middlewares, nil
}

// InitDiscovery starts the discovery process on application startup
func InitDiscovery() error {
	// Prevent multiple simultaneous discoveries
	discoveryMutex.Lock()
	if discoveryRunning {
		discoveryMutex.Unlock()
		log.Println("Discovery already running, skipping...")
		return nil
	}
	discoveryRunning = true
	discoveryMutex.Unlock()

	defer func() {
		discoveryMutex.Lock()
		discoveryRunning = false
		discoveryMutex.Unlock()
	}()

	dashboardURL := getEnv("TRAEFIK_DASHBOARD_URL", "")
	if dashboardURL == "" {
		log.Println("TRAEFIK_DASHBOARD_URL not set, skipping discovery initialization")
		return nil
	}

	log.Println("Starting discovery refresh...")

	// Discover middlewares
	if err := DiscoverMiddlewares(dashboardURL); err != nil {
		log.Printf("Middleware discovery error (non-fatal): %v", err)
	}

	// Discover router auth status
	authInfo, err := DiscoverRouterAuth(dashboardURL)
	if err != nil {
		log.Printf("Router auth discovery error (non-fatal): %v", err)
	}

	// Read discovery data and update with auth info
	discovery, err := ReadDiscoveryData()
	if err != nil {
		log.Printf("Warning: Failed to read discovery data: %v", err)
		return nil
	}

	discovery.UsesAuth = authInfo
	discovery.LastUpdated = time.Now().UTC().Format(time.RFC3339)

	// Save updated discovery data
	if err := writeDiscoveryData(discovery); err != nil {
		log.Printf("Warning: Failed to write discovery data: %v", err)
		return nil
	}

	log.Printf("Discovery complete. Found %d routers with auth status", len(authInfo))
	
	// Notify WebSocket clients of discovery update
	notifyDiscoveryUpdate(discovery)
	
	return nil
}

// DiscoveryAutoRefresh periodically refreshes discovery data every 5 minutes
func DiscoveryAutoRefresh() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		log.Println("Running scheduled discovery refresh...")
		if err := InitDiscovery(); err != nil {
			log.Printf("Scheduled discovery refresh error: %v", err)
		}
	}
}
