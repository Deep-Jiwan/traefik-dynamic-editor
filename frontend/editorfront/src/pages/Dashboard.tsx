import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { FiPlus, FiAlertTriangle, FiSearch, FiX, FiRefreshCw } from 'react-icons/fi'
import { Helmet } from 'react-helmet-async'
import { getApiBase } from '../utils/config'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../contexts/ToastContext'
import type { Router, EntryPoint } from '../types/traefik'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { RouterForm } from '../components/RouterForm'
import { RoutersTable } from '../components/RoutersTable'
import { RouterRow } from '../components/RouterRow'
import { EntryPointsList } from '../components/EntryPointsList'
import { EmptyState } from '../components/EmptyState'

export const Dashboard = () => {
  const { showToast } = useToast()
  const [isRouterModalOpen, setIsRouterModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [editingRouter, setEditingRouter] = useState<string | null>(null)
  const [deletingRouter, setDeletingRouter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const apiBase = getApiBase()

  // Fetch routers
  const {
    data: routers,
    mutate: mutateRouters,
    error: routersError,
  } = useSWR<Record<string, Router>>(`${apiBase}/routers`)

  // Fetch entry points
  const {
    data: entryPoints,
    mutate: mutateEntryPoints,
    error: entryPointsError,
  } = useSWR<Record<string, EntryPoint>>(`${apiBase}/entrypoints`)

  // WebSocket for real-time updates
  const { status: wsStatus } = useWebSocket(
    useCallback(
      (message) => {
        if (message.type === 'config-updated') {
          mutateRouters()
          mutateEntryPoints()
          showToast('Configuration updated', 'info')
        }
      },
      [mutateRouters, mutateEntryPoints, showToast]
    )
  )

  const handleAddRouter = () => {
    setEditingRouter(null)
    setIsRouterModalOpen(true)
  }

  const handleEditRouter = (name: string) => {
    setEditingRouter(name)
    setIsRouterModalOpen(true)
  }

  const handleDeleteRouter = (name: string) => {
    setDeletingRouter(name)
    setIsDeleteModalOpen(true)
  }

  const handleRouterSuccess = () => {
    setIsRouterModalOpen(false)
    setEditingRouter(null)
    mutateRouters()
    mutateEntryPoints()
    showToast('Router saved successfully', 'success')
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
      mutateEntryPoints()
      showToast('Router deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting router:', error)
      showToast('Failed to delete router', 'error')
    }
  }

  const handleAddEntryPoint = () => {
    showToast('Entry points are defined in traefik.yml config file', 'info')
  }

  const handleRefreshStatus = () => {
    setIsRefreshing(true)
    // Force refresh by triggering a re-render with a key change
    mutateRouters()
    setTimeout(() => {
      setIsRefreshing(false)
      showToast('Service status refreshed', 'info')
    }, 500)
  }

  const filteredRouters = routers
    ? Object.entries(routers).filter(([name, router]) => {
        const query = searchQuery.toLowerCase()
        const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || ''
        const entryPointsStr = router.entryPoints.join(' ')
        const tlsStr = router.tls ? 'tls enabled' : 'tls disabled'
        
        return (
          name.toLowerCase().includes(query) ||
          host.toLowerCase().includes(query) ||
          router.service.toLowerCase().includes(query) ||
          entryPointsStr.toLowerCase().includes(query) ||
          tlsStr.includes(query)
        )
      })
    : []

  const hasRouters = routers && Object.keys(routers).length > 0
  const hasFilteredResults = filteredRouters.length > 0

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
                <Button onClick={handleAddRouter} variant="primary">
                  <div className="flex items-center gap-2">
                    <FiPlus className="w-4 h-4" />
                    Add Router
                  </div>
                </Button>
              </div>
            </div>
          </div>

          {/* Entry Points Section */}
          {entryPoints && (
            <EntryPointsList entryPoints={entryPoints} onAddClick={handleAddEntryPoint} />
          )}

          {entryPointsError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
              Failed to load entry points
            </div>
          )}

          {/* Routers Section */}
          {routersError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
              Failed to load routers
            </div>
          )}

          {!hasRouters && !routersError && <EmptyState onAddClick={handleAddRouter} />}

          {hasRouters && (
            <>
              {/* Search Bar */}
              <div className="mb-4 flex justify-end gap-3">
                <button
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-[#1e2b39] border border-[#2f3d4d] rounded-lg text-white hover:bg-[hsla(206,100%,50%,0.04)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh service status"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative w-64">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsla(0,0%,100%,0.51)] w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search routers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-[#1e2b39] border border-[#2f3d4d] rounded-lg text-white placeholder-[hsla(0,0%,100%,0.51)] focus:ring-2 focus:ring-[#2aa2c1] focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[hsla(0,0%,100%,0.51)] hover:text-white transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {hasFilteredResults ? (
                <RoutersTable>
                  {filteredRouters.map(([name, router]) => (
                    <RouterRow
                      key={name}
                      name={name}
                      router={router}
                      onEdit={handleEditRouter}
                      onDelete={handleDeleteRouter}
                    />
                  ))}
                </RoutersTable>
              ) : (
                <div className="bg-[#1e2b39] rounded-lg shadow-md overflow-x-auto">
                  <table className="w-full min-w-max">
                    <thead className="bg-[#1e2b39] border-b border-[#2f3d4d]">
                      <tr>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[150px]">
                          Router Name
                        </th>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[180px]">
                          Host
                        </th>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[120px]">
                          Service
                        </th>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[120px]">
                          Entry Points
                        </th>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[100px]">
                          TLS
                        </th>
                        <th className="px-6 py-5 text-right text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[150px]">
                          Actions
                        </th>
                        <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider min-w-[100px]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <svg
                              stroke="currentColor"
                              fill="none"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              height="16"
                              width="16"
                              xmlns="http://www.w3.org/2000/svg"
                              style={{ color: '#2aa2c1' }}
                            >
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span className="text-white">No data available</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
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

      {/* Delete Confirmation Modal */}
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
    </>
  )
}
