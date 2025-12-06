package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// readConfig reads the dynamic configuration from individual router files only
// Does NOT use dynamic.yml at all
func readConfig() (*TraefikConfig, error) {
	config := &TraefikConfig{
		HTTP: HTTPConfig{
			Routers:  make(map[string]Router),
			Services: make(map[string]Service),
		},
	}

	// Scan the directory for router-*.yml files
	dir := filepath.Dir(configPath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory %s: %w", dir, err)
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "router-") && strings.HasSuffix(entry.Name(), ".yml") {
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

			// Merge routers from this file
			if routerConfig.HTTP.Routers != nil {
				for routerName, router := range routerConfig.HTTP.Routers {
					config.HTTP.Routers[routerName] = router
				}
			}

			// Merge services from this file
			if routerConfig.HTTP.Services != nil {
				for serviceName, service := range routerConfig.HTTP.Services {
					config.HTTP.Services[serviceName] = service
				}
			}
		}
	}

	return config, nil
}

// writeConfig writes configuration to file
func writeConfig(config *TraefikConfig) error {
	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// writeRouterFile writes individual router to router-{name}.yml file
func writeRouterFile(routerName string, router Router) error {
	// Create a structure with the router data
	routerData := map[string]interface{}{
		"http": map[string]interface{}{
			"routers": map[string]Router{
				routerName: router,
			},
			"services": map[string]Service{
				router.Service: {
					LoadBalancer: LoadBalancer{
						Servers: []Server{},
					},
				},
			},
		},
	}

	data, err := yaml.Marshal(routerData)
	if err != nil {
		return fmt.Errorf("failed to marshal router: %w", err)
	}

	routerFilePath := filepath.Join(filepath.Dir(configPath), fmt.Sprintf("router-%s.yml", routerName))
	if err := os.WriteFile(routerFilePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write router file: %w", err)
	}

	log.Printf("Written router file: %s", routerFilePath)
	return nil
}

// readTraefikConfig reads Traefik static configuration from traefik.yml
func readTraefikConfig() (*TraefikStaticConfig, error) {
	data, err := os.ReadFile(traefikConfigPath)
	if err != nil {
		// If file doesn't exist, return empty config instead of error
		if os.IsNotExist(err) {
			log.Printf("Traefik config file not found at %s, returning empty config", traefikConfigPath)
			return &TraefikStaticConfig{
				EntryPoints: make(map[string]EntryPoint),
			}, nil
		}
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var config TraefikStaticConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// Initialize empty map if nil
	if config.EntryPoints == nil {
		config.EntryPoints = make(map[string]EntryPoint)
	}

	return &config, nil
}
