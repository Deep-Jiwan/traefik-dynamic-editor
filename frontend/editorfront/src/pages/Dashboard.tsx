import { useState, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { FiPlus, FiAlertTriangle } from 'react-icons/fi'
import { Helmet } from 'react-helmet-async'
import { getApiBase } from '../utils/config'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../contexts/ToastContext'
import type { Router } from '../types/traefik'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { RouterForm } from '../components/RouterForm'
import { MiddlewareForm } from '../components/MiddlewareForm'
import { MiddlewaresTable } from '../components/MiddlewaresTable'
import { RoutersTableView } from '../components/RoutersTableView'
import { EmptyState } from '../components/EmptyState'

export const Dashboard = () => {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'routers' | 'middlewares'>('routers')
  const [isRouterModalOpen, setIsRouterModalOpen] = useState(false)
  const [isMiddlewareModalOpen, setIsMiddlewareModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleteMiddlewareModalOpen, setIsDeleteMiddlewareModalOpen] = useState(false)
  const [editingRouter, setEditingRouter] = useState<string | null>(null)
  const [editingMiddleware, setEditingMiddleware] = useState<string | null>(null)
  const [deletingRouter, setDeletingRouter] = useState<string | null>(null)
  const [deletingMiddleware, setDeletingMiddleware] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [middlewareSearchQuery, setMiddlewareSearchQuery] = useState('')
  const [routerViewMode, setRouterViewMode] = useState<'all' | 'files'>('all')
  const [middlewareViewMode, setMiddlewareViewMode] = useState<'all' | 'files'>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusTrigger, setStatusTrigger] = useState(0)

  const apiBase = getApiBase()

  // Fetch routers with optimized settings
  const {
    data: routers,
    mutate: mutateRouters,
    error: routersError,
  } = useSWR<Record<string, Router>>(`${apiBase}/routers`, {
    revalidateOnFocus: false,
  })

  // WebSocket for real-time updates
  const { status: wsStatus } = useWebSocket(
    useCallback(
      (message) => {
        if (message.type === 'config-updated') {
          mutateRouters()
          setStatusTrigger(prev => prev + 1)
          showToast('Configuration updated', 'info')
        } else if (message.type === 'discovery-updated') {
          // Revalidate discovery data when it updates
          mutate(`${apiBase}/discovery/auth`)
          mutate(`${apiBase}/middlewares`)
          mutate(`${apiBase}/middlewares/files`)
          mutate(`${apiBase}/middlewares/live`)
          mutate(`${apiBase}/discovery`)
          console.log('Discovery data updated via WebSocket')
        }
      },
      [mutateRouters, showToast, apiBase]
    )
  )

  const handleAddRouter = () => {
    setEditingRouter(null)
    setIsRouterModalOpen(true)
  }

  const handleAddMiddleware = () => {
    setEditingMiddleware(null)
    setIsMiddlewareModalOpen(true)
  }

  const handleAdd = () => {
    if (activeTab === 'routers') {
      handleAddRouter()
    } else {
      handleAddMiddleware()
    }
  }

  const handleEditRouter = (name: string) => {
    setEditingRouter(name)
    setIsRouterModalOpen(true)
  }

  const handleDeleteRouter = (name: string) => {
    setDeletingRouter(name)
    setIsDeleteModalOpen(true)
  }

  const handleEditMiddleware = (name: string) => {
    setEditingMiddleware(name)
    setIsMiddlewareModalOpen(true)
  }

  const handleDeleteMiddleware = (name: string) => {
    setDeletingMiddleware(name)
    setIsDeleteMiddlewareModalOpen(true)
  }

  const handleRouterSuccess = () => {
    setIsRouterModalOpen(false)
    setEditingRouter(null)
    mutateRouters()
    mutate(`${apiBase}/routers/files`)
    mutate(`${apiBase}/routers/live`)
    setStatusTrigger(prev => prev + 1)
    showToast('Router saved successfully', 'success')
  }

  const handleMiddlewareSuccess = () => {
    setIsMiddlewareModalOpen(false)
    setEditingMiddleware(null)
    mutate(`${apiBase}/middlewares`)
    mutate(`${apiBase}/middlewares/files`)
    mutate(`${apiBase}/middlewares/live`)
    mutate(`${apiBase}/discovery`)
    showToast('Middleware saved successfully', 'success')
  }

  const confirmDelete = async () => {
    if (!deletingRouter) return

    try {
      const response = await fetch(`${apiBase}/routers/${deletingRouter}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete router')

      setIsDeleteModalOpen(false)
      setDeletingRouter(null)
      mutateRouters()
      mutate(`${apiBase}/routers/files`)
      mutate(`${apiBase}/routers/live`)
      setStatusTrigger(prev => prev + 1)
      showToast('Router deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting router:', error)
      showToast('Failed to delete router', 'error')
    }
  }

  const confirmDeleteMiddleware = async () => {
    if (!deletingMiddleware) return

    try {
      const response = await fetch(`${apiBase}/middleware/${deletingMiddleware}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete middleware')

      setIsDeleteMiddlewareModalOpen(false)
      setDeletingMiddleware(null)
      mutate(`${apiBase}/middlewares`)
      mutate(`${apiBase}/middlewares/files`)
      mutate(`${apiBase}/middlewares/live`)
      mutate(`${apiBase}/discovery`)
      showToast('Middleware deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting middleware:', error)
      showToast('Failed to delete middleware', 'error')
    }
  }

  const handleRefreshStatus = async () => {
    setIsRefreshing(true)
    try {
      // Trigger manual discovery refresh first
      await fetch(`${apiBase}/discovery/refresh`, { method: 'POST' })
        .catch(err => console.warn('Discovery refresh trigger failed:', err))
      
      // Wait a moment for discovery to complete
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Revalidate all data sources in parallel
      await Promise.all([
        mutateRouters(), // Refresh routers
        mutate(`${apiBase}/routers/files`), // Refresh router files
        mutate(`${apiBase}/routers/live`), // Refresh live routers
        mutate(`${apiBase}/discovery`), // Refresh full discovery data (includes auth + middlewares)
        mutate(`${apiBase}/middlewares`), // Refresh middlewares
        mutate(`${apiBase}/middlewares/files`), // Refresh middleware files
        mutate(`${apiBase}/middlewares/live`), // Refresh live middlewares
      ])
      setStatusTrigger(prev => prev + 1) // Trigger service status refresh
      showToast('All data refreshed', 'success')
    } catch (error) {
      console.error('Error refreshing data:', error)
      showToast('Failed to refresh some data', 'error')
    } finally {
      setIsRefreshing(false)
    }
  }

  const hasRouters = routers && Object.keys(routers).length > 0

  return (
    <>
      <Helmet>
        <title>Traefik Config Editor</title>
      </Helmet>

      <div className="min-h-screen bg-[#081727]">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-white">Traefik Config Editor</h1>
                <p className="text-white mt-2">Manage your dynamic routing configuration</p>
              </div>
              <div className="flex items-center gap-3">
                <ConnectionStatus status={wsStatus} />
                <Button onClick={handleAdd} variant="primary" className="w-[180px]">
                  <div className="flex items-center justify-center gap-2">
                    <FiPlus className="w-4 h-4" />
                    {activeTab === 'routers' ? 'Add Router' : 'Add Middleware'}
                  </div>
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setActiveTab('routers')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors rounded-lg ${
                activeTab === 'routers'
                  ? 'text-white bg-[#2aa2c1]'
                  : 'text-[hsla(0,0%,100%,0.51)] bg-[#1e2b39] hover:text-white hover:bg-[#2aa2c1]/70'
              }`}
            >
              Routers
            </button>
            <button
              onClick={() => setActiveTab('middlewares')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors rounded-lg ${
                activeTab === 'middlewares'
                  ? 'text-white bg-[#2aa2c1]'
                  : 'text-[hsla(0,0%,100%,0.51)] bg-[#1e2b39] hover:text-white hover:bg-[#2aa2c1]/70'
              }`}
            >
              Middlewares
            </button>
          </div>


          {/* Routers Section */}
          {activeTab === 'routers' && (
            <>
              {routersError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
                  Failed to load routers
                </div>
              )}

              {!hasRouters && !routersError && <EmptyState onAddClick={handleAddRouter} />}

              {hasRouters && (
                <RoutersTableView
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onRefresh={handleRefreshStatus}
                  isRefreshing={isRefreshing}
                  onEdit={handleEditRouter}
                  onDelete={handleDeleteRouter}
                  viewMode={routerViewMode}
                  onViewModeChange={setRouterViewMode}
                  statusTrigger={statusTrigger}
                  routers={routers || {}}
                />
              )}
            </>
          )}

          {/* Middlewares Section */}
          {activeTab === 'middlewares' && (
            <MiddlewaresTable 
              searchQuery={middlewareSearchQuery}
              onSearchChange={setMiddlewareSearchQuery}
              onRefresh={handleRefreshStatus}
              isRefreshing={isRefreshing}
              onEdit={handleEditMiddleware}
              onDelete={handleDeleteMiddleware}
              viewMode={middlewareViewMode}
              onViewModeChange={setMiddlewareViewMode}
            />
          )}
        </div>
      </div>

      {/* Router Modal */}
      <Modal
        isOpen={isRouterModalOpen}
        onClose={() => {
          setIsRouterModalOpen(false)
          setEditingRouter(null)
        }}
        title={editingRouter ? 'Edit Router' : 'Add Router'}
        description="Add a new router to route a domain name to a service"
      >
        <RouterForm
          routerName={editingRouter}
          onSuccess={handleRouterSuccess}
          onCancel={() => {
            setIsRouterModalOpen(false)
            setEditingRouter(null)
          }}
        />
      </Modal>

      {/* Middleware Modal */}
      <Modal
        isOpen={isMiddlewareModalOpen}
        onClose={() => {
          setIsMiddlewareModalOpen(false)
          setEditingMiddleware(null)
        }}
        title={editingMiddleware ? 'Edit Middleware' : 'Add Middleware'}
        description="Create or edit a middleware configuration"
      >
        <MiddlewareForm
          middlewareName={editingMiddleware}
          onSuccess={handleMiddlewareSuccess}
          onCancel={() => {
            setIsMiddlewareModalOpen(false)
            setEditingMiddleware(null)
          }}
        />
      </Modal>

      {/* Delete Router Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setDeletingRouter(null)
        }}
        title="Delete Router"
      >
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-lg mb-4">
            <FiAlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-sm text-[hsla(0,0%,100%,0.51)] mb-6">
            Are you sure you want to delete router "
            <span className="font-semibold text-white">{deletingRouter}</span>"? This action cannot be
            undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeletingRouter(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Middleware Confirmation Modal */}
      <Modal
        isOpen={isDeleteMiddlewareModalOpen}
        onClose={() => {
          setIsDeleteMiddlewareModalOpen(false)
          setDeletingMiddleware(null)
        }}
        title="Delete Middleware"
      >
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-lg mb-4">
            <FiAlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-sm text-[hsla(0,0%,100%,0.51)] mb-6">
            Are you sure you want to delete middleware "
            <span className="font-semibold text-white">{deletingMiddleware}</span>"? This action cannot be
            undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsDeleteMiddlewareModalOpen(false)
                setDeletingMiddleware(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={confirmDeleteMiddleware}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Middleware Modal */}
      <Modal
        isOpen={isMiddlewareModalOpen}
        onClose={() => setIsMiddlewareModalOpen(false)}
        title={editingMiddleware ? `Edit Middleware: ${editingMiddleware}` : 'Create New Middleware'}
      >
        <MiddlewareForm
          middlewareName={editingMiddleware}
          onSuccess={handleMiddlewareSuccess}
          onCancel={() => setIsMiddlewareModalOpen(false)}
        />
      </Modal>
    </>
  )
}
