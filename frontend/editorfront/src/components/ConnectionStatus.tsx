interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export const ConnectionStatus = ({ status }: ConnectionStatusProps) => {
  const dotColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
    connecting: 'bg-gray-400',
  }

  const statusText = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    connecting: 'Connecting...',
  }

  const containerClass = status === 'connected' 
    ? 'bg-[#1e2b39] text-white' 
    : status === 'error'
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-600'

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${containerClass}`}>
      <div className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
      <span className="text-sm">{statusText[status]}</span>
    </div>
  )
}
