import { useState, FormEvent, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { FiX, FiPlus, FiCode } from 'react-icons/fi'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml as yamlMode } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { lineNumbers, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showYAMLEditor, setShowYAMLEditor] = useState(false)
  const [yamlContent, setYamlContent] = useState('')
  const [yamlError, setYamlError] = useState('')
  const yamlEditorRef = useRef<HTMLDivElement>(null)
  const yamlViewRef = useRef<EditorView | null>(null)

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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newMiddlewares = [...formData.middlewares]
      const [draggedItem] = newMiddlewares.splice(draggedIndex, 1)
      newMiddlewares.splice(dragOverIndex, 0, draggedItem)
      
      setFormData((prev) => ({
        ...prev,
        middlewares: newMiddlewares,
      }))
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const formDataToYAML = (): string => {
    const router: Router = {
      rule: `Host(\`${formData.host}\`)`,
      entryPoints: formData.entryPoints,
      service: formData.serviceName,
      middlewares: formData.middlewares.length > 0 ? formData.middlewares : undefined,
      tls: formData.tlsEnabled ? { certResolver: 'cloudflare' } : null,
    }

    const name = routerName || formData.name
    let yaml = 'http:\n'
    yaml += '  routers:\n'
    yaml += `    ${name}:\n`
    yaml += `      rule: ${router.rule}\n`
    yaml += `      entryPoints:\n`
    router.entryPoints.forEach(ep => {
      yaml += `        - ${ep}\n`
    })
    yaml += `      service: ${router.service}\n`
    
    if (router.middlewares && router.middlewares.length > 0) {
      yaml += `      middlewares:\n`
      router.middlewares.forEach(mw => {
        yaml += `        - ${mw}\n`
      })
    }
    
    if (router.tls) {
      yaml += `      tls:\n`
      yaml += `        certResolver: ${router.tls.certResolver}\n`
    }
    
    yaml += '  services:\n'
    yaml += `    ${formData.serviceName}:\n`
    yaml += `      loadBalancer:\n`
    yaml += `        servers:\n`
    yaml += `          - url: ${formData.serviceUrl}\n`
    
    return yaml
  }

  const yamlToFormData = (yaml: string): boolean => {
    try {
      setYamlError('')
      
      // Simple YAML parser for our specific structure
      const lines = yaml.split('\n')
      const newFormData: RouterFormData = {
        name: routerName || formData.name,
        host: '',
        serviceName: '',
        serviceUrl: '',
        entryPoints: [],
        tlsEnabled: false,
        middlewares: [],
      }
      
      let currentRouter = ''
      let inRouters = false
      let inServices = false
      let inMiddlewares = false
      let inEntryPoints = false
      
      for (const line of lines) {
        const trimmed = line.trim()
        
        if (trimmed.startsWith('routers:')) {
          inRouters = true
          inServices = false
          continue
        }
        if (trimmed.startsWith('services:')) {
          inServices = true
          inRouters = false
          continue
        }
        
        if (inRouters) {
          if (trimmed.includes(':') && !trimmed.startsWith('-') && !trimmed.startsWith('rule:') && 
              !trimmed.startsWith('service:') && !trimmed.startsWith('entryPoints:') && 
              !trimmed.startsWith('middlewares:') && !trimmed.startsWith('tls:') &&
              !trimmed.startsWith('certResolver:')) {
            currentRouter = trimmed.replace(':', '')
            newFormData.name = currentRouter
          }
          
          if (trimmed.startsWith('rule:')) {
            const match = trimmed.match(/Host\(\`([^`]+)\`\)/)
            if (match) newFormData.host = match[1]
          }
          
          if (trimmed.startsWith('service:')) {
            newFormData.serviceName = trimmed.split(':')[1].trim()
          }
          
          if (trimmed.startsWith('entryPoints:')) {
            inEntryPoints = true
            inMiddlewares = false
            continue
          }
          
          if (trimmed.startsWith('middlewares:')) {
            inMiddlewares = true
            inEntryPoints = false
            continue
          }
          
          if (trimmed.startsWith('tls:')) {
            inMiddlewares = false
            inEntryPoints = false
            newFormData.tlsEnabled = true
            continue
          }
          
          if (inEntryPoints && trimmed.startsWith('-')) {
            newFormData.entryPoints.push(trimmed.substring(1).trim())
          }
          
          if (inMiddlewares && trimmed.startsWith('-')) {
            newFormData.middlewares.push(trimmed.substring(1).trim())
          }
        }
        
        if (inServices) {
          if (trimmed.includes(':') && !trimmed.startsWith('-') && !trimmed.startsWith('loadBalancer:') && 
              !trimmed.startsWith('servers:') && !trimmed.startsWith('url:')) {
            // Service name detected (not needed in current logic but kept for structure)
          }
          
          if (trimmed.startsWith('- url:') || trimmed.startsWith('url:')) {
            newFormData.serviceUrl = trimmed.replace('- url:', '').replace('url:', '').trim()
          }
        }
      }
      
      setFormData(newFormData)
      return true
    } catch (error) {
      setYamlError('Invalid YAML format: ' + (error instanceof Error ? error.message : 'Unknown error'))
      return false
    }
  }

  const handleToggleYAML = () => {
    if (!showYAMLEditor) {
      // Switching to YAML view - generate YAML from form
      const yaml = formDataToYAML()
      setYamlContent(yaml)
      setShowYAMLEditor(true)
      
      // Initialize CodeMirror after state update
      setTimeout(() => {
        if (yamlEditorRef.current && !yamlViewRef.current) {
          const initialState = EditorState.create({
            doc: yaml,
            extensions: [
              basicSetup,
              yamlMode(),
              oneDark,
              lineNumbers(),
              keymap.of([indentWithTab]),
              EditorState.tabSize.of(4),
            ],
          })

          const view = new EditorView({
            state: initialState,
            parent: yamlEditorRef.current,
          })

          yamlViewRef.current = view
        }
      }, 100)
    } else {
      // Switching back to form view - destroy editor
      if (yamlViewRef.current) {
        yamlViewRef.current.destroy()
        yamlViewRef.current = null
      }
      setShowYAMLEditor(false)
    }
  }

  const handleSaveFromYAML = () => {
    // Get content from CodeMirror editor
    const content = yamlViewRef.current ? yamlViewRef.current.state.doc.toString() : yamlContent
    
    // Parse YAML and update form data (doesn't save, just updates form)
    if (yamlToFormData(content)) {
      // Destroy editor and switch back to form view
      if (yamlViewRef.current) {
        yamlViewRef.current.destroy()
        yamlViewRef.current = null
      }
      setShowYAMLEditor(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!showMiddlewareSelector && !showYAMLEditor && (
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
            formData.middlewares.map((middleware, index) => (
              <div
                key={`${middleware}-${index}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                className={`inline-flex items-center gap-2 bg-[#2aa2c1] text-white px-3 py-1 rounded-full text-sm cursor-move transition-all ${
                  draggedIndex === index ? 'opacity-50 scale-95' : ''
                } ${
                  dragOverIndex === index && draggedIndex !== index ? 'scale-105 ring-2 ring-[#2aa2c1] ring-offset-2 ring-offset-[#081727]' : ''
                }`}
              >
                <span className="select-none">{middleware}</span>
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
          Selected middlewares will be applied to this router. Drag pills to re-order
        </p>
      </div>
        </>
      )}

      {/* YAML Editor View */}
      {showYAMLEditor && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">YAML Editor</h3>
            <button
              type="button"
              onClick={handleToggleYAML}
              className="text-xs text-[hsla(0,0%,100%,0.51)] hover:text-white transition-colors"
            >
              ← Back to Form
            </button>
          </div>
          
          {yamlError && (
            <div className="bg-red-900/20 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
              {yamlError}
            </div>
          )}

          <div
            ref={yamlEditorRef}
            className="w-full h-[400px] border border-[#2f3d4d] rounded-lg overflow-auto bg-[#1a2332]"
            style={{ fontSize: '14px' }}
          />
          
          <p className="text-xs text-[hsla(0,0%,100%,0.51)]">
            Edit the YAML configuration directly. Click "Apply YAML" to update the form fields.
          </p>
        </div>
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
        {showYAMLEditor ? (
          <>
            <Button 
              type="button" 
              variant="primary" 
              className="flex-[0.6]" 
              onClick={handleSaveFromYAML}
            >
              Apply YAML
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel}
              className="flex-[0.2]"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleToggleYAML}
              className="flex items-center justify-center gap-2 flex-[0.2]"
            >
              <FiCode className="w-4 h-4" />
              Edit YAML
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              className="flex-[0.6]" 
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Router'}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onCancel}
              className="flex-[0.2]"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
