import useSWR from 'swr'
import { FiCheckCircle, FiAlertTriangle, FiRefreshCw, FiSearch, FiX, FiEdit, FiTrash2 } from 'react-icons/fi'
import { getApiBase } from '../utils/config'

interface DiscoveryMiddleware {
  name: string
  type: string
  provider: string
  status: string
}

interface DiscoveryData {
  middlewares: DiscoveryMiddleware[]
  lastUpdated: string
}

interface MiddlewaresTableProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  onEdit: (name: string) => void
  onDelete: (name: string) => void
}

export const MiddlewaresTable = ({ searchQuery, onSearchChange, onRefresh, isRefreshing, onEdit, onDelete }: MiddlewaresTableProps) => {
  const apiBase = getApiBase()
  const { data: discovery, error, isLoading } = useSWR<DiscoveryData>(`${apiBase}/discovery`)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[hsla(0,0%,100%,0.51)]">Loading middlewares...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-400">Failed to load middlewares</div>
      </div>
    )
  }

  const middlewares = discovery?.middlewares || []

  // Filter middlewares based on search query
  const filteredMiddlewares = middlewares.filter((middleware) => {
    const query = searchQuery.toLowerCase()
    return (
      middleware.name.toLowerCase().includes(query) ||
      middleware.type.toLowerCase().includes(query) ||
      middleware.provider.toLowerCase().includes(query) ||
      middleware.status.toLowerCase().includes(query)
    )
  })

  const hasMiddlewares = middlewares.length > 0
  const hasFilteredResults = filteredMiddlewares.length > 0

  if (!hasMiddlewares && !isLoading) {
    return (
      <div className="bg-[#1e2b39] rounded-lg shadow-md p-8">
        <div className="text-center">
          <FiAlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Middlewares Discovered</h3>
          <p className="text-[hsla(0,0%,100%,0.51)] mb-4">
            No middlewares found in Traefik. Make sure the Traefik dashboard URL is configured correctly.
          </p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#2aa2c1] text-white rounded-lg hover:bg-[#1a7a96] transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh Discovery
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Search Bar & Actions */}
      <div className="mb-4 flex justify-end gap-3">
        <div className="flex gap-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-[#1e2b39] border border-[#2f3d4d] rounded-lg text-white hover:bg-[hsla(206,100%,50%,0.04)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh discovery"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative w-64">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsla(0,0%,100%,0.51)] w-4 h-4" />
            <input
              type="text"
              placeholder="Search middlewares..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-[#1e2b39] border border-[#2f3d4d] rounded-lg text-white placeholder-[hsla(0,0%,100%,0.51)] focus:ring-1 focus:ring-[#2aa2c1] focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[hsla(0,0%,100%,0.51)] hover:text-white transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table matching RoutersTable style */}
      <div className="rounded-lg shadow-md" style={{ display: 'table', width: '100%', backgroundColor: 'var(--colors-01dp)' }}>
        <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: 'Rubik, sans-serif', borderRadius: '8px', overflow: 'hidden' }}>
          <thead className="border-b border-[#2f3d4d]" style={{ backgroundColor: 'var(--colors-01dp)' }}>
            <tr>
              <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '25%' }}>
                Name
              </th>
              <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '15%' }}>
                Type
              </th>
              <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '15%' }}>
                Provider
              </th>
              <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '15%' }}>
                Actions
              </th>
              <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '30%' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#394b5e]">
            {hasFilteredResults ? (
              filteredMiddlewares.map((middleware, index) => {
                // Extract the base name without @file suffix
                const baseName = middleware.name.replace('@file', '')
                const isFileProvider = middleware.provider === 'file'
                
                return (
                  <tr
                    key={`${middleware.name}-${index}`}
                    className="hover:bg-[hsla(206,100%,50%,0.04)] transition-colors"
                  >
                    <td className="px-6 py-5" style={{ width: '25%' }}>
                      <div className="text-sm font-medium text-[hsla(0,0%,100%,0.74)] truncate" title={middleware.name}>
                        {middleware.name}
                      </div>
                    </td>
                    <td className="px-6 py-5" style={{ width: '15%' }}>
                      <span
                        className="px-2 py-1 text-xs rounded-full"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'rgba(255, 255, 255, 0.65)',
                          border: '1px solid rgba(255, 255, 255, 0.65)',
                        }}
                      >
                        {middleware.type}
                      </span>
                    </td>
                    <td className="px-6 py-5" style={{ width: '15%' }}>
                      <span
                        className="px-2 py-1 text-xs rounded-full"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'rgba(255, 255, 255, 0.65)',
                          border: '1px solid rgba(255, 255, 255, 0.65)',
                        }}
                      >
                        {middleware.provider}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium" style={{ width: '15%' }}>
                      {isFileProvider ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => onEdit(baseName)}
                            className="text-[#2aa2c1] hover:text-[#238a9f] inline-flex items-center transition-colors whitespace-nowrap"
                          >
                            <FiEdit className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(baseName)}
                            className="inline-flex items-center transition-colors whitespace-nowrap"
                            style={{ color: 'rgb(220, 53, 69)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(180, 43, 56)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(220, 53, 69)')}
                          >
                            <FiTrash2 className="w-4 h-4 mr-1" />
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[hsla(0,0%,100%,0.31)]" title="Non-file middlewares cannot be edited">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5" style={{ width: '30%' }}>
                      {middleware.status === 'enabled' ? (
                        <div title="Enabled">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(48, 164, 108)' }}>
                            <FiCheckCircle className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div title="Disabled">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(220, 53, 69)' }}>
                            <FiAlertTriangle className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
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
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
