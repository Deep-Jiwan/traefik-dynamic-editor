// Traefik Dynamic Config Types

export interface Router {
  rule: string
  entryPoints: string[]
  service: string
  middlewares?: string[]
  tls: TLS | null
}

export interface TLS {
  certResolver: string
}

export interface Service {
  loadBalancer: LoadBalancer
}

export interface LoadBalancer {
  servers: Server[]
}

export interface Server {
  url: string
}

export interface Config {
  http: {
    routers: Record<string, Router>
    services: Record<string, Service>
  }
}

export interface PingResponse {
  status: 'up' | 'down'
  code: number
  latency_ms: number
  error?: string
}

export interface WebSocketMessage {
  type: 'config-updated'
  data?: unknown
}

export interface Middleware {
  name: string
  type: string
  description?: string
  status?: string
  provider?: string
}

export interface RouterFormData {
  name: string
  host: string
  serviceName: string
  serviceUrl: string
  entryPoints: string[]
  tlsEnabled: boolean
  middlewares: string[]
}
