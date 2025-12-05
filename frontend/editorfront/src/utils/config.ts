// Runtime configuration
export const getApiBase = (): string => {
  if (window.APP_CONFIG && window.APP_CONFIG.API_BASE) {
    return window.APP_CONFIG.API_BASE
  }
  return `${window.location.protocol}//${window.location.host}/api`
}

export const getWebSocketUrl = (): string => {
  if (window.APP_CONFIG && window.APP_CONFIG.WS_URL) {
    return window.APP_CONFIG.WS_URL
  }

  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${window.location.host}/api/ws`
  } catch {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/api/ws`
  }
}

declare global {
  interface Window {
    APP_CONFIG?: {
      API_BASE?: string
      WS_URL?: string
    }
  }
}
