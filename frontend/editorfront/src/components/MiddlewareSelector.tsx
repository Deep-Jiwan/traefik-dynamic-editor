import { useState, useMemo } from 'react'
import { FiX, FiSearch } from 'react-icons/fi'
import { Button } from './Button'
import type { Middleware } from '../types/traefik'

interface MiddlewareSelectorProps {
  available: Middleware[]
  selected: string[]
  onSelect: (middlewares: string[]) => void
  onClose: () => void
}

export const MiddlewareSelector = ({
  available,
  selected,
  onSelect,
  onClose,
}: MiddlewareSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(selected))

  const filteredMiddlewares = useMemo(() => {
    if (!searchQuery.trim()) return available

    const query = searchQuery.toLowerCase()
    return available.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.type.toLowerCase().includes(query) ||
        m.provider?.toLowerCase().includes(query)
    )
  }, [available, searchQuery])

  const handleToggle = (name: string) => {
    const newSelected = new Set(tempSelected)
    if (newSelected.has(name)) {
      newSelected.delete(name)
    } else {
      newSelected.add(name)
    }
    setTempSelected(newSelected)
  }

  const handleApply = () => {
    onSelect(Array.from(tempSelected))
    onClose()
  }

  const groupedMiddlewares = useMemo(() => {
    const groups: Record<string, Middleware[]> = {}
    filteredMiddlewares.forEach((m) => {
      const type = m.type || 'other'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(m)
    })
    return groups
  }, [filteredMiddlewares])

  const sortedTypes = Object.keys(groupedMiddlewares).sort()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2b39] border border-[#2f3d4d] rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2f3d4d]">
          <h2 className="text-lg font-semibold text-white">Select Middlewares</h2>
          <button
            onClick={onClose}
            className="text-[hsla(0,0%,100%,0.51)] hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2f3d4d] bg-[#1e2b39]">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsla(0,0%,100%,0.51)]" />
            <input
              type="text"
              placeholder="Search by name, type, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#081727] border border-[#2f3d4d] rounded-lg focus:ring-1 focus:ring-[#2aa2c1] focus:border-[#2aa2c1] text-white"
            />
          </div>
        </div>

        {/* Middleware List */}
        <div className="flex-1 overflow-y-auto">
          {sortedTypes.length === 0 ? (
            <div className="p-8 text-center text-[hsla(0,0%,100%,0.51)]">
              No middlewares found
            </div>
          ) : (
            <div className="space-y-0">
              {sortedTypes.map((type) => (
                <div key={type}>
                  {/* Type Header */}
                  <div className="sticky top-0 px-6 py-2 bg-[#1e2b39] border-b border-[#2f3d4d]/50">
                    <h3 className="text-xs font-semibold text-[#2aa2c1] uppercase tracking-wider">
                      {type}
                    </h3>
                  </div>

                  {/* Middlewares in Type */}
                  <div className="divide-y divide-[#2f3d4d]/30">
                    {groupedMiddlewares[type]!.map((middleware) => {
                      const isSelected = tempSelected.has(middleware.name)
                      return (
                        <div
                          key={middleware.name}
                          onClick={() => handleToggle(middleware.name)}
                          className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#1a3a4a] border-l-2 border-l-[#2aa2c1]'
                              : 'hover:bg-[#0f2636]'
                          }`}
                        >
                          {/* Animated Checkbox */}
                          <div className="relative flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="sr-only"
                            />
                            <div
                              className={`
                                w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center
                                ${isSelected 
                                  ? 'bg-[#2aa2c1] border-[#2aa2c1]' 
                                  : 'bg-[#081727] border-[#2f3d4d] hover:border-[#2aa2c1]/50'
                                }
                              `}
                            >
                              {isSelected && (
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">
                              {middleware.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs bg-[#081727] text-[#2aa2c1] px-2 py-0.5 rounded">
                                {middleware.type}
                              </span>
                              {middleware.provider && (
                                <span className="text-xs text-[hsla(0,0%,100%,0.51)]">
                                  {middleware.provider}
                                </span>
                              )}
                              {middleware.status && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    middleware.status === 'enabled'
                                      ? 'bg-green-900/30 text-green-400'
                                      : 'bg-red-900/30 text-red-400'
                                  }`}
                                >
                                  {middleware.status}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {isSelected && (
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#2aa2c1]" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#2f3d4d] bg-[#1e2b39]">
          <div className="text-sm text-[hsla(0,0%,100%,0.51)]">
            {tempSelected.size} selected
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleApply}>
              Apply ({tempSelected.size})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
