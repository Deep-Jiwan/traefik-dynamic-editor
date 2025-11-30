import { useState, FormEvent, useEffect } from 'react'
import useSWR from 'swr'
import { FiChevronDown } from 'react-icons/fi'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import type { RouterFormData, Router, Config, Middleware } from '../types/traefik'
import { getApiBase } from '../utils/config'

interface RouterFormProps {
  routerName: string | null
  onSuccess: () => void
  onCancel: () => void
}

export const RouterForm = ({ routerName, onSuccess, onCancel }: RouterFormProps) => {
  const [formData, setFormData] = useState<RouterFormData>({
    name: '',
    host: '',
    serviceName: '',
    serviceUrl: '',
    entryPoints: ['websecure'],
    tlsEnabled: true,
    authEnabled: false,
    authMiddleware: '',
  })
  const [loading, setLoading] = useState(false)

  const apiBase = getApiBase()
  
  // Fetch available middlewares
  const { data: middlewares } = useSWR<Middleware[]>(`${apiBase}/middlewares`)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        onCancel()
      }
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const form = document.querySelector('form')
        if (form) {
          form.requestSubmit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  useEffect(() => {
    if (routerName) {
      loadRouterData(routerName)
    }
  }, [routerName])

  const loadRouterData = async (name: string) => {
    try {
      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/routers/${name}`)
      const router: Router = await response.json()

      const configResponse = await fetch(`${apiBase}/config`)
      const config: Config = await configResponse.json()

      const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || ''
      const service = config.http.services[router.service]
      const serviceUrl = service?.loadBalancer.servers[0]?.url || ''

      const hasAuth = !!(router.middlewares && router.middlewares.length > 0)
      const authMiddleware = hasAuth && router.middlewares ? router.middlewares[0] : ''

      setFormData({
        name,
        host,
        serviceName: router.service,
        serviceUrl,
        entryPoints: router.entryPoints,
        tlsEnabled: router.tls !== null,
        authEnabled: hasAuth,
        authMiddleware: authMiddleware,
      })
    } catch (error) {
      console.error('Error loading router:', error)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const apiBase = getApiBase()
      const name = routerName || formData.name

      const router: Router = {
        rule: `Host(\`${formData.host}\`)`,
        entryPoints: formData.entryPoints,
        service: formData.serviceName,
        middlewares: formData.authEnabled && formData.authMiddleware 
          ? [formData.authMiddleware] 
          : undefined,
        tls: formData.tlsEnabled ? { certResolver: 'cloudflare' } : null,
      }

      // Save router
      await fetch(`${apiBase}/routers/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(router),
      })

      // Update service
      const configResponse = await fetch(`${apiBase}/config`)
      const config: Config = await configResponse.json()

      if (!config.http.services[formData.serviceName]) {
        config.http.services[formData.serviceName] = {
          loadBalancer: { servers: [] },
        }
      }
      config.http.services[formData.serviceName].loadBalancer.servers = [
        { url: formData.serviceUrl },
      ]

      await fetch(`${apiBase}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      onSuccess()
    } catch (error) {
      console.error('Error saving router:', error)
      alert('Failed to save router')
    } finally {
      setLoading(false)
    }
  }

  const toggleEntryPoint = (ep: string) => {
    setFormData((prev) => ({
      ...prev,
      entryPoints: prev.entryPoints.includes(ep)
        ? prev.entryPoints.filter((e) => e !== ep)
        : [...prev.entryPoints, ep],
    }))
  }

  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Check for invalid protocol prefixes
    if (/^(https?:\/\/|wss?:\/\/)/i.test(value)) {
      e.target.setCustomValidity('Host should not include http://, https://, ws://, or wss://')
    } else {
      e.target.setCustomValidity('')
    }
    setFormData((prev) => ({ ...prev, host: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-white mb-1">Router Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          disabled={!!routerName}
          className="w-full px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent text-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="my-service-router"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">Unique identifier for this router</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1">Host Rule</label>
        <input
          type="text"
          value={formData.host}
          onChange={handleHostChange}
          pattern="^(?!https?:\/\/)(?!wss?:\/\/).*$"
          className="w-full px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="example.com"
          title="Host should not include http://, https://, ws://, or wss://"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">Domain name for this service (without protocol)</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1">Service Name</label>
        <input
          type="text"
          value={formData.serviceName}
          onChange={(e) => setFormData((prev) => ({ ...prev, serviceName: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="my-service"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">Name of the service to route to</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1">Backend URL</label>
        <input
          type="url"
          value={formData.serviceUrl}
          onChange={(e) => setFormData((prev) => ({ ...prev, serviceUrl: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="http://192.168.1.100:8080"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">Internal service URL (http://ip:port)</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1">Entry Points</label>
        <div className="flex gap-6">
          <Checkbox
            checked={formData.entryPoints.includes('web')}
            onChange={() => toggleEntryPoint('web')}
            label="HTTP (web)"
          />
          <Checkbox
            checked={formData.entryPoints.includes('websecure')}
            onChange={() => toggleEntryPoint('websecure')}
            label="HTTPS (websecure)"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1.5">TLS & Authentication</label>
        <div className="space-y-2">
          <Checkbox
            checked={formData.tlsEnabled}
            onChange={(checked) => setFormData((prev) => ({ ...prev, tlsEnabled: checked }))}
            label="Enable TLS"
          />
          
          <Checkbox
            checked={formData.authEnabled}
            onChange={(checked) =>
              setFormData((prev) => ({ 
                ...prev, 
                authEnabled: checked,
                authMiddleware: checked ? (middlewares?.filter(m => m.type === 'auth')[0]?.name || '') : ''
              }))
            }
            label="Enable Authentication"
          />
        </div>
      </div>

      {formData.authEnabled && (
        <div>
          <div className="relative">
            <select
              value={formData.authMiddleware}
              onChange={(e) => setFormData((prev) => ({ ...prev, authMiddleware: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-[#0d1b2a] border-2 border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-[#2aa2c1] text-white appearance-none cursor-pointer hover:border-[#2aa2c1]/50 transition-colors pr-10"
              required={formData.authEnabled}
              style={{
                backgroundImage: 'none',
              }}
            >
              <option value="" className="bg-[#1e2b39] text-white">Select middleware...</option>
              {middlewares?.filter(m => m.type === 'auth').map((middleware) => (
                <option key={middleware.name} value={middleware.name} className="bg-[#1e2b39] text-white">
                  {middleware.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <FiChevronDown className="w-4 h-4 text-[hsla(0,0%,100%,0.51)]" />
            </div>
          </div>
          <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">
            Choose your authentication middleware. Create one using Edit Components
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-3">
        <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
          {loading ? 'Saving...' : 'Save Router'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
