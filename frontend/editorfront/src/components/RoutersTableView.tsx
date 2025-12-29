import useSWR from 'swr'
import { FiRefreshCw, FiSearch, FiX, FiEdit, FiTrash2 } from 'react-icons/fi'
import { getApiBase } from '../utils/config'
import { RouterRow } from './RouterRow'
import { RoutersTable } from './RoutersTable'
import type { Router } from '../types/traefik'

interface LiveRouter {
  name: string
  rule: string
  service: string
  entryPoints: string[]
  middlewares?: string[]
  tls?: {
    certResolver?: string
  }
  provider: string
  status: string
  using?: string[]
}

interface RouterFile {
  fileName: string
  routerName: string
}

interface RoutersTableViewProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  onEdit: (name: string) => void
  onDelete: (name: string) => void
  viewMode: 'all' | 'files'
  onViewModeChange: (mode: 'all' | 'files') => void
  statusTrigger: number
  routers: Record<string, Router>
}

export const RoutersTableView = ({ 
  searchQuery, 
  onSearchChange, 
  onRefresh,
  isRefreshing, 
  onEdit, 
  onDelete,
  viewMode,
  onViewModeChange,
  statusTrigger,
  routers
}: RoutersTableViewProps) => {
  const apiBase = getApiBase()
  
  // Fetch based on view mode
  const { mutate: mutateLive } = useSWR<LiveRouter[]>(
    viewMode === 'all' ? `${apiBase}/routers/live` : null
  )
  
  const { data: routerFiles, mutate: mutateFiles } = useSWR<RouterFile[]>(
    viewMode === 'files' ? `${apiBase}/routers/files` : null
  )

  const handleRefreshClick = () => {
    if (viewMode === 'all') {
      mutateLive()
    } else {
      mutateFiles()
    }
    onRefresh()
  }

  const routersArray = routers ? Object.entries(routers) : []
  const files = viewMode === 'files' ? (routerFiles || []) : []

  // Filter based on view mode
  const filteredItems = viewMode === 'files' 
    ? files.filter((file) => {
        if (!file || !file.fileName) return false
        const query = searchQuery.toLowerCase()
        return (
          file.fileName.toLowerCase().includes(query) ||
          (file.routerName && file.routerName.toLowerCase().includes(query))
        )
      })
    : routersArray.filter(([name, router]) => {
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

  const hasFilteredResults = filteredItems.length > 0

  return (
    <>
      {/* Toggle and Search Bar */}
      <div className="mb-4 flex justify-between items-center">
        {/* Toggle */}
        <div className="flex gap-1 bg-[#1e2b39] rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'all'
                ? 'bg-[#2aa2c1] text-white'
                : 'text-[hsla(0,0%,100%,0.51)] hover:text-white'
            }`}
          >
            All Routers
          </button>
          <button
            onClick={() => onViewModeChange('files')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'files'
                ? 'bg-[#2aa2c1] text-white'
                : 'text-[hsla(0,0%,100%,0.51)] hover:text-white'
            }`}
          >
            Files
          </button>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="px-4 py-2 bg-[#1e2b39] border border-[#2f3d4d] rounded-lg text-white hover:bg-[hsla(206,100%,50%,0.04)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={viewMode === 'all' ? 'Refresh routers' : 'Refresh router files'}
          >
            <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative w-64">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsla(0,0%,100%,0.51)] w-4 h-4" />
            <input
              type="text"
              placeholder="Search routers..."
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

      {/* Table */}
      {hasFilteredResults ? (
        viewMode === 'all' ? (
          <RoutersTable>
            {(filteredItems as [string, Router][]).map(([name, router]) => (
              <RouterRow
                key={name}
                name={name}
                router={router}
                onEdit={onEdit}
                onDelete={onDelete}
                statusTrigger={statusTrigger}
              />
            ))}
          </RoutersTable>
        ) : (
          <div className="rounded-lg shadow-md" style={{ display: 'table', width: '100%', backgroundColor: 'var(--colors-01dp)' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: 'Rubik, sans-serif', borderRadius: '8px', overflow: 'hidden' }}>
              <thead className="border-b border-[#2f3d4d]" style={{ backgroundColor: 'var(--colors-01dp)' }}>
                <tr>
                  <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '40%' }}>
                    File Name
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '40%' }}>
                    Router Name
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '20%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#394b5e]">
                {(filteredItems as RouterFile[]).map((file, index) => {
                  const fileNameWithoutExt = file.fileName.replace(/\.yml$/, '')
                  const routerName = file.routerName || fileNameWithoutExt.replace(/^router-/, '')
                  
                  return (
                    <tr
                      key={`${file.fileName}-${index}`}
                      className="hover:bg-[hsla(206,100%,50%,0.04)] transition-colors"
                    >
                      <td className="px-6 py-5" style={{ width: '40%' }}>
                        <div className="text-sm font-medium text-[hsla(0,0%,100%,0.74)] truncate" title={file.fileName}>
                          {file.fileName}
                        </div>
                      </td>
                      <td className="px-6 py-5" style={{ width: '40%' }}>
                        <div className="text-sm text-[hsla(0,0%,100%,0.74)] truncate" title={routerName}>
                          {routerName}
                        </div>
                      </td>
                      <td className="px-6 py-5" style={{ width: '20%' }}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEdit(routerName)}
                            className="text-[#2aa2c1] hover:text-[#238a9f] inline-flex items-center transition-colors"
                          >
                            <FiEdit className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(routerName)}
                            className="inline-flex items-center transition-colors"
                            style={{ color: 'rgb(220, 53, 69)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(180, 43, 56)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(220, 53, 69)')}
                          >
                            <FiTrash2 className="w-4 h-4 mr-1" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="bg-[#1e2b39] rounded-lg shadow-md p-8 text-center">
          <p className="text-[hsla(0,0%,100%,0.51)]">
            {searchQuery ? 'No routers found matching your search' : 'No routers found'}
          </p>
        </div>
      )}
    </>
  )
}
