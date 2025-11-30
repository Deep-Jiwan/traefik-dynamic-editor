import { useState, useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { lineNumbers } from '@codemirror/view'
import { FiX } from 'react-icons/fi'
import { Button } from './Button'
import { getApiBase } from '../utils/config'

interface YAMLEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  title?: string
  description?: string
  endpoint?: string
}

export const YAMLEditor = ({ isOpen, onClose, onSave, title = 'Edit Configuration', description, endpoint = 'yaml' }: YAMLEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const [yaml_content, setYamlContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        handleClose()
      }
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Fetch YAML content when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset editor state when opening
      if (editorViewRef.current) {
        editorViewRef.current.destroy()
        editorViewRef.current = null
      }
      setYamlContent('')
      fetchYAMLContent()
    }
  }, [isOpen])

  // Initialize CodeMirror editor when content loads
  useEffect(() => {
    if (isOpen && yaml_content && editorRef.current && !editorViewRef.current) {
      initializeEditor()
    }
  }, [isOpen, yaml_content])

  const fetchYAMLContent = async () => {
    setLoading(true)
    setError('')
    try {
      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/${endpoint}`)
      if (!response.ok) throw new Error('Failed to fetch YAML content')
      const text = await response.text()
      setYamlContent(text)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error fetching YAML:', err)
    } finally {
      setLoading(false)
    }
  }

  const initializeEditor = () => {
    if (!editorRef.current) return

    const initialState = EditorState.create({
      doc: yaml_content,
      extensions: [
        basicSetup,
        yaml(),
        oneDark,
        lineNumbers(),
      ],
    })

    const view = new EditorView({
      state: initialState,
      parent: editorRef.current,
    })

    editorViewRef.current = view
  }

  const handleSave = async () => {
    if (!editorViewRef.current) return

    setSaving(true)
    setError('')

    try {
      const content = editorViewRef.current.state.doc.toString()
      
      // Parse YAML and validate it's valid JSON structure
      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/yaml' },
        body: content,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save YAML')
      }

      // Fetch updated config to pass to onSave
      const configResponse = await fetch(`${apiBase}/config`)
      if (!configResponse.ok) throw new Error('Failed to fetch updated config')

      onSave()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error saving YAML:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (editorViewRef.current) {
      editorViewRef.current.destroy()
      editorViewRef.current = null
    }
    setYamlContent('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the backdrop, not on the modal itself
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="absolute inset-0 bg-black/30"
        style={{ backdropFilter: 'blur(8px)' }}
        onClick={handleBackdropClick}
      />
      <div className="relative bg-[#1e2b39] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#2f3d4d]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2f3d4d]">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {description && (
              <p className="text-sm text-[hsla(0,0%,100%,0.51)] mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition ml-4"
            title="Close (or click outside)"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pt-4">
            <div className="bg-red-900/20 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          </div>
        )}

        {/* Editor Container with proper scrolling */}
        <div className="flex-1 p-6 flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center text-gray-400 flex-1">
              <p>Loading YAML configuration...</p>
            </div>
          ) : (
            <div
              ref={editorRef}
              className="flex-1 border border-[#2f3d4d] rounded overflow-auto bg-[#1a2332]"
              style={{ fontSize: '14px' }}
            />
          )}
        </div>

        {/* Footer with Actions */}
        <div className="flex gap-3 p-6 border-t border-[#2f3d4d]">
          <Button
            onClick={handleClose}
            variant="secondary"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            disabled={loading || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
