package main

import (
	"encoding/json"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
)

// Watch config file and router files for changes
func watchConfigFile() {
	// Watch the main config file
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		log.Println("Error getting absolute path:", err)
		return
	}

	if err := fileWatcher.Add(absPath); err != nil {
		log.Println("Error watching file:", err)
		return
	}

	// Also watch the directory containing router files
	dynamicDir := filepath.Dir(absPath)
	if err := fileWatcher.Add(dynamicDir); err != nil {
		log.Println("Error watching dynamic directory:", err)
	} else {
		log.Println("Started watching directory:", dynamicDir)
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

			if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
				// Check if it's a router file change
				isRouterFile := strings.HasPrefix(filepath.Base(event.Name), "router-") && 
				                strings.HasSuffix(event.Name, ".yml")
				
				// Debounce: only notify after 500ms of no changes
				if debounceTimer != nil {
					debounceTimer.Stop()
				}

				debounceTimer = time.AfterFunc(500*time.Millisecond, func() {
					if isRouterFile {
						log.Printf("Router file changed: %s, notifying clients and triggering discovery", filepath.Base(event.Name))
					} else {
						log.Println("Config file changed, notifying clients")
					}
					notifyClients()
					
					// Trigger discovery refresh after any config/router file change
					go func() {
						time.Sleep(1 * time.Second) // Wait for Traefik to reload
						if err := InitDiscovery(); err != nil {
							log.Printf("Discovery refresh after file change error: %v", err)
						}
					}()
				})
			}
			
			// Handle router file deletions
			if event.Op&fsnotify.Remove == fsnotify.Remove {
				isRouterFile := strings.HasPrefix(filepath.Base(event.Name), "router-") && 
				                strings.HasSuffix(event.Name, ".yml")
				
				if isRouterFile {
					if debounceTimer != nil {
						debounceTimer.Stop()
					}
					
					debounceTimer = time.AfterFunc(500*time.Millisecond, func() {
						log.Printf("Router file deleted: %s, notifying clients and triggering discovery", filepath.Base(event.Name))
						notifyClients()
						
						go func() {
							time.Sleep(1 * time.Second)
							if err := InitDiscovery(); err != nil {
								log.Printf("Discovery refresh after deletion error: %v", err)
							}
						}()
					})
				}
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
