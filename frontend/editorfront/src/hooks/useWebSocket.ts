import { useEffect, useRef, useState } from 'react'
import { getWebSocketUrl } from '../utils/config'
import type { WebSocketMessage } from '../types/traefik'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export const useWebSocket = (onMessage: (message: WebSocketMessage) => void) => {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let mounted = true

    const connectWs = () => {
      if (!mounted) return

      try {
        const wsUrl = getWebSocketUrl()
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          if (mounted) setStatus('connected')
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            onMessage(message)
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err)
          }
        }

        ws.onclose = () => {
          if (mounted) {
            setStatus('disconnected')
            wsRef.current = null
          }
        }

        ws.onerror = () => {
          if (mounted) setStatus('error')
        }

        wsRef.current = ws
      } catch (err) {
        console.error('WebSocket connection error:', err)
        if (mounted) setStatus('error')
      }
    }

    connectWs()

    // Set up auto-reconnect
    const reconnectInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWs()
      }
    }, 3000)

    return () => {
      mounted = false
      clearInterval(reconnectInterval)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [onMessage])

  return { status }
}
