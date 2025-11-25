import { useEffect, useRef, useState } from 'react'
import type { PingResponse } from '../types/traefik'
import { getApiBase } from '../utils/config'

const BASE_BACKOFF = 1000 // 1s
const MAX_BACKOFF = 180000 // 3 minutes

interface ServiceStatus {
  status: 'up' | 'down' | 'checking'
  latency?: number
  error?: string
  code?: number
}

export const useServiceStatus = (host: string | null, scheme: 'http' | 'https') => {
  const [status, setStatus] = useState<ServiceStatus>(() => {
    if (!host || host === 'Unknown') {
      return { status: 'down', error: 'Invalid host' }
    }
    return { status: 'checking' }
  })
  const backoffRef = useRef(BASE_BACKOFF)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (!host || host === 'Unknown') {
      return
    }

    const checkService = async () => {
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
          // Increase backoff (exponential) up to max
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF)
        } else {
          setStatus({
            status: 'down',
            code: data.code,
            error: data.error,
          })
          // Reset backoff on failure
          backoffRef.current = BASE_BACKOFF
        }

        // Schedule next check
        timerRef.current = setTimeout(checkService, backoffRef.current)
      } catch (err) {
        setStatus({
          status: 'down',
          error: err instanceof Error ? err.message : 'Unreachable',
        })
        // Reset backoff
        backoffRef.current = BASE_BACKOFF
        timerRef.current = setTimeout(checkService, backoffRef.current)
      }
    }

    checkService()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [host, scheme])

  return status
}
