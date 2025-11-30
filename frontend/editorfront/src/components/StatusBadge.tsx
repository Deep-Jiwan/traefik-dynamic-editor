import { FiCheckCircle, FiAlertTriangle, FiShield } from 'react-icons/fi'
import type { useServiceStatus } from '../hooks/useServiceStatus'

interface StatusBadgeProps {
  status: ReturnType<typeof useServiceStatus>
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { status: state, latency, error, code } = status

  if (state === 'up') {
    return (
      <div className="inline-flex items-center gap-2" title="Online">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(48, 164, 108)' }}>
          <FiCheckCircle className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs text-white">{latency}ms</span>
      </div>
    )
  }

  // Check if it's a 401 (auth required)
  if (code === 401) {
    return (
      <div className="inline-flex items-center gap-2" title="Auth required. Cannot verify Online status">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(42, 162, 193)' }}>
          <FiShield className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs text-white">AUTH</span>
      </div>
    )
  }

  const errorDisplay = code ? code.toString() : 'ERR'
  const errorMsg = error || `Status ${code || 'unknown'}`

  return (
    <div className="inline-flex items-center gap-2" title={`Offline - ${errorMsg}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(220, 53, 69)' }}>
        <FiAlertTriangle className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs text-white">{errorDisplay}</span>
    </div>
  )
}
