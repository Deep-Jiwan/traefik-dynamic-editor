import { useState, FormEvent, useEffect } from 'react'
import { Button } from './Button'
import type { RouterFormData, Router, Config } from '../types/traefik'
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
  })
  const [customEntryPoints, setCustomEntryPoints] = useState<string[]>([])
  const [newEntryPoint, setNewEntryPoint] = useState('')
  const [loading, setLoading] = useState(false)

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

      setFormData({
        name,
        host,
        serviceName: router.service,
        serviceUrl,
        entryPoints: router.entryPoints,
        tlsEnabled: router.tls !== null,
      })

      // Find custom entry points
      const standard = ['web', 'websecure']
      const custom = router.entryPoints.filter((ep) => !standard.includes(ep))
      setCustomEntryPoints(custom)
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

  const addCustomEntryPoint = () => {
    const ep = newEntryPoint.trim()
    if (!ep) return
    if (formData.entryPoints.includes(ep)) {
      alert('Entry point already exists')
      return
    }

    setCustomEntryPoints((prev) => [...prev, ep])
    setFormData((prev) => ({
      ...prev,
      entryPoints: [...prev.entryPoints, ep],
    }))
    setNewEntryPoint('')
  }

  const removeCustomEntryPoint = (ep: string) => {
    setCustomEntryPoints((prev) => prev.filter((e) => e !== ep))
    setFormData((prev) => ({
      ...prev,
      entryPoints: prev.entryPoints.filter((e) => e !== ep),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white mb-2">Router Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          disabled={!!routerName}
          className="w-full px-4 py-2 bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent text-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="my-service-router"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-1">Unique identifier for this router</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Host Rule</label>
        <input
          type="text"
          value={formData.host}
          onChange={(e) => setFormData((prev) => ({ ...prev, host: e.target.value }))}
          className="w-full px-4 py-2 bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="example.com"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-1">Domain name for this service</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Service Name</label>
        <input
          type="text"
          value={formData.serviceName}
          onChange={(e) => setFormData((prev) => ({ ...prev, serviceName: e.target.value }))}
          className="w-full px-4 py-2 bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="my-service"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-1">Name of the service to route to</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Backend URL</label>
        <input
          type="url"
          value={formData.serviceUrl}
          onChange={(e) => setFormData((prev) => ({ ...prev, serviceUrl: e.target.value }))}
          className="w-full px-4 py-2 bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent text-white"
          placeholder="http://192.168.1.100:8080"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-1">Internal service URL (http://ip:port)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Entry Points</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.entryPoints.includes('web')}
              onChange={() => toggleEntryPoint('web')}
              className="w-4 h-4 text-[#2aa2c1] border-[#2f3d4d] rounded focus:ring-[#2aa2c1]"
            />
            <span className="ml-2 text-sm text-white">HTTP (web)</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.entryPoints.includes('websecure')}
              onChange={() => toggleEntryPoint('websecure')}
              className="w-4 h-4 text-[#2aa2c1] border-[#2f3d4d] rounded focus:ring-[#2aa2c1]"
            />
            <span className="ml-2 text-sm text-white">HTTPS (websecure)</span>
          </label>
          {customEntryPoints.map((ep) => (
            <label key={ep} className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.entryPoints.includes(ep)}
                  onChange={() => toggleEntryPoint(ep)}
                  className="w-4 h-4 text-[#2aa2c1] border-[#2f3d4d] rounded focus:ring-[#2aa2c1]"
                />
                <span className="ml-2 text-sm text-white">{ep}</span>
              </div>
              <button
                type="button"
                onClick={() => removeCustomEntryPoint(ep)}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                Remove
              </button>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newEntryPoint}
            onChange={(e) => setNewEntryPoint(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent text-white"
            placeholder="custom-port"
          />
          <Button type="button" variant="secondary" onClick={addCustomEntryPoint}>
            + Add Custom
          </Button>
        </div>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.tlsEnabled}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, tlsEnabled: e.target.checked }))
            }
            className="w-4 h-4 text-[#2aa2c1] border-[#2f3d4d] rounded focus:ring-[#2aa2c1]"
          />
          <span className="ml-2 text-sm font-medium text-white">Enable TLS</span>
        </label>
      </div>

      <div className="flex gap-3 pt-4">
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
