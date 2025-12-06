import { FiEdit, FiTrash2, FiExternalLink, FiLock, FiCopy } from 'react-icons/fi'
import type { Router, Middleware } from '../types/traefik'
import { StatusBadge } from './StatusBadge'
import { useServiceStatus } from '../hooks/useServiceStatus'
import { useToast } from '../contexts/ToastContext'
import useSWR from 'swr'
import { getApiBase } from '../utils/config'
import type { Config } from '../types/traefik'

interface RouterRowProps {
  name: string
  router: Router
  onEdit: (name: string) => void
  onDelete: (name: string) => void
  statusTrigger?: number
}

interface DiscoveryAuthInfo {
  router_name: string
  uses_auth: boolean
}

interface DiscoveryData {
  middlewares: Middleware[]
  uses_auth: DiscoveryAuthInfo[]
  lastUpdated: string
}

export const RouterRow = ({ name, router, onEdit, onDelete, statusTrigger = 0 }: RouterRowProps) => {
  const { showToast } = useToast()
  const apiBase = getApiBase()
  
  // Config is fetched with revalidation settings
  const { data: config } = useSWR<Config>(`${apiBase}/config`, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  
  // Get full discovery data to check middleware types
  const { data: discoveryData } = useSWR<DiscoveryData>(`${apiBase}/discovery`, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  
  const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || 'Unknown'
  const hasTLS = router.tls !== null && router.tls !== undefined
  
  // Check auth status from multiple sources:
  // 1. Check discovery auth list (from API inspection)
  const authInfo = discoveryData?.uses_auth?.find(a => a.router_name === name)
  const hasAuthFromDiscovery = authInfo?.uses_auth ?? false
  
  // 2. Check if router has any forwardAuth middleware directly
  const hasForwardAuthMiddleware = router.middlewares?.some(mw => {
    const middleware = discoveryData?.middlewares?.find(m => m.name === mw)
    return middleware?.type?.toLowerCase() === 'forwardauth'
  }) ?? false
  
  // Show padlock if either check is true
  const hasAuth = hasAuthFromDiscovery || hasForwardAuthMiddleware
  
  const scheme = hasTLS ? 'https' : 'http'
  const fullUrl = host !== 'Unknown' ? `${scheme}://${host}` : ''
  const backendUrl = config?.http?.services?.[router.service]?.loadBalancer?.servers?.[0]?.url || ''

  const serviceStatus = useServiceStatus(host !== 'Unknown' ? host : null, scheme, statusTrigger)

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message, 'info')
    }).catch((err) => {
      console.error('Failed to copy:', err)
      showToast('Failed to copy to clipboard', 'error')
    })
  }

  return (
    <tr className="hover:bg-[hsla(206,100%,50%,0.04)] transition-colors">
      <td className="px-6 py-5" style={{ width: '15%' }}>
        <div className="text-sm font-medium text-[hsla(0,0%,100%,0.74)] truncate" title={name}>{name}</div>
      </td>
      <td className="px-6 py-5" style={{ width: '22%' }}>
        {host !== 'Unknown' ? (
          <div className="flex items-center gap-2">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-[hsla(0,0%,100%,0.74)] hover:text-[#2aa2c1] no-underline transition-colors"
              title={`Open ${host}`}
            >
              <span className="truncate">{host}</span>
              <FiExternalLink className="ml-1 text-[#2aa2c1] flex-shrink-0" size={14} />
            </a>
            <button
              onClick={() => copyToClipboard(fullUrl, 'Copied to clipboard!')}
              className="text-[hsla(0,0%,100%,0.51)] hover:text-[#2aa2c1] transition-colors flex-shrink-0"
              title="Copy URL"
            >
              <FiCopy size={14} />
            </button>
          </div>
        ) : (
          <div className="text-sm text-[hsla(0,0%,100%,0.74)] truncate" title={host}>{host}</div>
        )}
      </td>
      <td className="px-6 py-5" style={{ width: '11%' }}>
        <button
          onClick={() => copyToClipboard(backendUrl, 'Backend URL Copied!')}
          className="text-sm text-[hsla(0,0%,100%,0.74)] hover:text-[#2aa2c1] transition-colors truncate cursor-pointer text-left"
          title={backendUrl || router.service}
          disabled={!backendUrl}
        >
          {router.service}
        </button>
      </td>
      <td className="px-6 py-5" style={{ width: '13%' }}>
        <div className="flex flex-wrap gap-1">
          {router.entryPoints.map((ep) => (
            <span
              key={ep}
              className="px-2 py-1 text-xs rounded-full"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
              }}
            >
              {ep}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-5" style={{ width: '7%' }}>
        {hasTLS && (
          <div title="TLS Enabled">
            <svg
              className="w-5 h-5"
              style={{ color: 'rgb(48, 164, 108)' }}
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        )}
      </td>
      <td className="px-6 py-5" style={{ width: '7%' }}>
        {hasAuth && (
          <div title="Authentication Enabled" className="flex justify-center">
            <FiLock className="w-5 h-5" style={{ color: '#2aa2c1' }} />
          </div>
        )}
      </td>
      <td className="px-6 py-5 text-sm font-medium" style={{ width: '13%' }}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onEdit(name)}
            className="text-[#2aa2c1] hover:text-[#238a9f] inline-flex items-center transition-colors whitespace-nowrap"
          >
            <FiEdit className="w-4 h-4 mr-1" />
            Edit
          </button>
          <button
            onClick={() => onDelete(name)}
            className="inline-flex items-center transition-colors whitespace-nowrap"
            style={{ color: 'rgb(220, 53, 69)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgb(180, 43, 56)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgb(220, 53, 69)')}
          >
            <FiTrash2 className="w-4 h-4 mr-1" />
            Delete
          </button>
        </div>
      </td>
      <td className="px-6 py-5" style={{ width: '12%' }}>
        <StatusBadge status={serviceStatus} />
      </td>
    </tr>
  )
}
