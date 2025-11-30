import { useEffect, useState } from 'react'
import type { PingResponse } from '../types/traefik'
import { getApiBase } from '../utils/config'

interface ServiceStatus {
  status: 'up' | 'down' | 'checking'
  latency?: number
  error?: string
  code?: number
}

export const useServiceStatus = (host: string | null, scheme: 'http' | 'https', trigger: number = 0) => {
  const [status, setStatus] = useState<ServiceStatus>(() => {
    if (!host || host === 'Unknown') {
      return { status: 'down', error: 'Invalid host' }
    }
    return { status: 'checking' }
  })

  useEffect(() => {
    if (!host || host === 'Unknown') {
      setStatus({ status: 'down', error: 'Invalid host' })
      return
    }

    const checkService = async () => {
      setStatus({ status: 'checking' })
      try {
        const apiBase = getApiBase()
        const response = await fetch(
          `${apiBase}/ping?host=${encodeURIComponent(host)}&scheme=${encodeURIComponent(scheme)}`
        )
        const data: PingResponse = await response.json()

        if (data.status === 'up' && data.code === 200) {
          setStatus({
            status: 'up',
            latency: data.latency_ms,
          })
        } else {
          setStatus({
            status: 'down',
            code: data.code,
            error: data.error,
          })
        }
      } catch (err) {
        setStatus({
          status: 'down',
          error: err instanceof Error ? err.message : 'Unreachable',
        })
      }
    }

    checkService()
  }, [host, scheme, trigger])

  return status
}
