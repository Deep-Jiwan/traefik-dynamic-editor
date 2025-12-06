import { useState, FormEvent, useEffect } from 'react'
import useSWR from 'swr'
import { FiX, FiPlus } from 'react-icons/fi'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { MiddlewareSelector } from './MiddlewareSelector'
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
    middlewares: [],
  })
  const [showMiddlewareSelector, setShowMiddlewareSelector] = useState(false)
  const [loading, setLoading] = useState(false)

  const apiBase = getApiBase()
  
  // Fetch available middlewares with optimized revalidation
  const { data: middlewares } = useSWR<Middleware[]>(`${apiBase}/middlewares`, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel (or close modal)
      if (e.key === 'Escape') {
        if (showMiddlewareSelector) {
          setShowMiddlewareSelector(false)
        } else {
          onCancel()
        }
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
  }, [onCancel, showMiddlewareSelector])

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
      
      // Get the service and backend URL
      let serviceUrl = ''
      if (config.http?.services?.[router.service]) {
        const service = config.http.services[router.service]
        serviceUrl = service?.loadBalancer?.servers?.[0]?.url || ''
      }

      console.log('Router Data:', { name, host, service: router.service, config: config.http?.services })

      setFormData({
        name,
        host,
        serviceName: router.service,
        serviceUrl,
        entryPoints: router.entryPoints,
        tlsEnabled: router.tls !== null,
        middlewares: router.middlewares || [],
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
        middlewares: formData.middlewares.length > 0 ? formData.middlewares : undefined,
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
      {!showMiddlewareSelector && (
        <>
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
        <label className="block text-xs font-medium text-white mb-1.5">TLS</label>
        <Checkbox
          checked={formData.tlsEnabled}
          onChange={(checked) => setFormData((prev) => ({ ...prev, tlsEnabled: checked }))}
          label="Enable TLS"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-2">Middlewares</label>
        
        {/* Middleware Pills Display */}
        <div className="bg-[#081727] border border-[#2f3d4d] rounded-lg p-3 mb-3 min-h-[2.5rem] flex flex-wrap gap-2 items-center">
          {formData.middlewares.length === 0 ? (
            <span className="text-xs text-[hsla(0,0%,100%,0.51)]">No middlewares selected</span>
          ) : (
            formData.middlewares.map((middleware) => (
              <div
                key={middleware}
                className="inline-flex items-center gap-2 bg-[#2aa2c1] text-white px-3 py-1 rounded-full text-sm"
              >
                <span>{middleware}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      middlewares: prev.middlewares.filter((m) => m !== middleware),
                    }))
                  }
                  className="hover:bg-[#1a7a96] rounded-full p-0.5 transition-colors"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Open Middleware Selector Modal Button */}
        <Button
          type="button"
          onClick={() => setShowMiddlewareSelector(true)}
          variant="primary"
          className="w-full flex items-center justify-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          Manage Middlewares
        </Button>

        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-2">
          Selected middlewares will be applied to this router
        </p>
      </div>
        </>
      )}

      {/* Middleware Selector Modal */}
      {showMiddlewareSelector && middlewares && (
        <MiddlewareSelector
          available={middlewares}
          selected={formData.middlewares}
          onSelect={(selected) =>
            setFormData((prev) => ({
              ...prev,
              middlewares: selected,
            }))
          }
          onClose={() => setShowMiddlewareSelector(false)}
        />
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
