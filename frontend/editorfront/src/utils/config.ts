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
    const apiBase = getApiBase()
    const apiUrl = new URL(apiBase, window.location.href)
    const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsPath = apiUrl.pathname.replace(/\/api\/?$/, '/api/ws')
    return `${wsProtocol}//${apiUrl.host}${wsPath}`
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
