import { FiEdit, FiTrash2, FiExternalLink } from 'react-icons/fi'
import type { Router } from '../types/traefik'
import { StatusBadge } from './StatusBadge'
import { useServiceStatus } from '../hooks/useServiceStatus'

interface RouterRowProps {
  name: string
  router: Router
  onEdit: (name: string) => void
  onDelete: (name: string) => void
}

export const RouterRow = ({ name, router, onEdit, onDelete }: RouterRowProps) => {
  const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || 'Unknown'
  const hasTLS = router.tls !== null && router.tls !== undefined
  const scheme = hasTLS ? 'https' : 'http'

  const serviceStatus = useServiceStatus(host !== 'Unknown' ? host : null, scheme)

  return (
    <tr className="hover:bg-[hsla(206,100%,50%,0.04)] transition-colors">
      <td className="px-6 py-5" style={{ width: '25%' }}>
        <div className="text-sm font-medium text-[hsla(0,0%,100%,0.74)] truncate" title={name}>{name}</div>
      </td>
      <td className="px-6 py-5" style={{ width: '24%' }}>
        {host !== 'Unknown' ? (
          <a
            href={`${scheme}://${host}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-[hsla(0,0%,100%,0.74)] hover:text-[#2aa2c1] no-underline transition-colors max-w-full"
            title={`Open ${host}`}
          >
            <span className="truncate">{host}</span>
            <FiExternalLink className="ml-2 text-[#2aa2c1] flex-shrink-0" size={14} />
          </a>
        ) : (
          <div className="text-sm text-[hsla(0,0%,100%,0.74)] truncate" title={host}>{host}</div>
        )}
      </td>
      <td className="px-6 py-5" style={{ width: '12%' }}>
        <div className="text-sm text-[hsla(0,0%,100%,0.74)] truncate" title={router.service}>{router.service}</div>
      </td>
      <td className="px-6 py-5" style={{ width: '15%' }}>
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
      <td className="px-6 py-5" style={{ width: '8%' }}>
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
      <td className="px-6 py-5 text-sm font-medium" style={{ width: '14%' }}>
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
