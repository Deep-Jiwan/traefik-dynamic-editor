import { useState, FormEvent, useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml as yamlMode } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { lineNumbers } from '@codemirror/view'
import { Button } from './Button'
import { getApiBase } from '../utils/config'

interface MiddlewareFormProps {
  middlewareName: string | null
  onSuccess: () => void
  onCancel: () => void
}

export const MiddlewareForm = ({ middlewareName, onSuccess, onCancel }: MiddlewareFormProps) => {
  const [name, setName] = useState('')
  const [yamlContent, setYamlContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const yamlEditorRef = useRef<HTMLDivElement>(null)
  const yamlViewRef = useRef<EditorView | null>(null)

  const apiBase = getApiBase()

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
        handleSubmit(e as unknown as FormEvent)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // Initialize CodeMirror editor
  useEffect(() => {
    if (yamlEditorRef.current && !yamlViewRef.current) {
      const defaultYaml = `# Add your middleware here
http:
  middlewares:
`
      setYamlContent(defaultYaml)

      const initialState = EditorState.create({
        doc: defaultYaml,
        extensions: [
          basicSetup,
          yamlMode(),
          oneDark,
          lineNumbers(),
        ],
      })

      const view = new EditorView({
        state: initialState,
        parent: yamlEditorRef.current,
      })

      yamlViewRef.current = view
    }

    return () => {
      if (yamlViewRef.current) {
        yamlViewRef.current.destroy()
        yamlViewRef.current = null
      }
    }
  }, [])

  // Load existing middleware if editing
  useEffect(() => {
    if (middlewareName) {
      loadMiddlewareData(middlewareName)
    }
  }, [middlewareName])

  const loadMiddlewareData = async (middlewareName: string) => {
    try {
      const response = await fetch(`${apiBase}/yaml?file=middleware-${middlewareName}.yml`)
      if (response.ok) {
        const yamlText = await response.text()
        setName(middlewareName)
        setYamlContent(yamlText)
        
        // Update editor if it exists
        if (yamlViewRef.current) {
          yamlViewRef.current.dispatch({
            changes: {
              from: 0,
              to: yamlViewRef.current.state.doc.length,
              insert: yamlText,
            },
          })
        }
      }
    } catch (error) {
      console.error('Error loading middleware:', error)
      setError('Failed to load middleware')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!name.trim()) {
        throw new Error('Middleware name is required')
      }

      // Get content from CodeMirror editor
      const content = yamlViewRef.current ? yamlViewRef.current.state.doc.toString() : yamlContent

      // Save middleware file
      const response = await fetch(`${apiBase}/middleware/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/yaml' },
        body: content,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to save middleware')
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving middleware:', error)
      setError(error instanceof Error ? error.message : 'Failed to save middleware')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-white mb-1">Middleware Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!!middlewareName}
          className="w-full px-3 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent text-white disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="my-middleware"
          required
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-0.5">
          Unique identifier for this middleware
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-white mb-1">Configuration</label>
        <div
          ref={yamlEditorRef}
          className="w-full h-[400px] border border-[#2f3d4d] rounded-lg overflow-auto bg-[#1a2332]"
          style={{ fontSize: '14px' }}
        />
        <p className="text-xs text-[hsla(0,0%,100%,0.51)] mt-2">
          Edit the YAML configuration for this middleware
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-3">
        <Button type="submit" variant="primary" className="flex-[0.8]" disabled={loading}>
          {loading ? 'Saving...' : 'Save Middleware'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-[0.2]">
          Cancel
        </Button>
      </div>
    </form>
  )
}
