import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import type { useServiceStatus } from '../hooks/useServiceStatus'

interface StatusBadgeProps {
  status: ReturnType<typeof useServiceStatus>
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { status: state, latency, error, code } = status

  if (state === 'up') {
    return (
      <div className="inline-flex items-center gap-2" title={`Online — ${latency} ms`}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(48, 164, 108)' }}>
          <FiCheckCircle className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs text-white">{latency}ms</span>
      </div>
    )
  }

  const errorDisplay = code ? code.toString() : 'ERR'
  const errorMsg = error || `Status ${code || 'unknown'}`

  return (
    <div className="inline-flex items-center gap-2" title={errorMsg}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgb(220, 53, 69)' }}>
        <FiAlertTriangle className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs text-white">{errorDisplay}</span>
    </div>
  )
}
