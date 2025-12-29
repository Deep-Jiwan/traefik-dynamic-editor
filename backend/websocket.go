package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// handleWebSocket upgrades connection to WebSocket
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

// notifyDiscoveryUpdate sends discovery data to all WebSocket clients
func notifyDiscoveryUpdate(discovery *DiscoveryData) {
	message, err := json.Marshal(map[string]interface{}{
		"type": "discovery-updated",
		"data": discovery,
	})
	if err != nil {
		log.Println("Error marshaling discovery notification:", err)
		return
	}

	wsMutex.Lock()
	defer wsMutex.Unlock()

	for client := range wsClients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Println("Error sending discovery update to client:", err)
			client.Close()
			delete(wsClients, client)
		}
	}
	log.Println("Discovery update sent to", len(wsClients), "WebSocket clients")
}

// notifyConfigUpdate sends config update notification to all WebSocket clients
func notifyConfigUpdate() {
	message, err := json.Marshal(map[string]interface{}{
		"type": "config-updated",
	})
	if err != nil {
		log.Println("Error marshaling config notification:", err)
		return
	}

	wsMutex.Lock()
	defer wsMutex.Unlock()

	for client := range wsClients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Println("Error sending config update to client:", err)
			client.Close()
			delete(wsClients, client)
		}
	}
	log.Println("Config update sent to", len(wsClients), "WebSocket clients")
}
