import { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'
import { useToast } from '../contexts/ToastContext'

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div
      className="fixed top-32 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none w-auto max-w-[360px]"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

interface ToastItemProps {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const ToastItem = ({ message, type, onClose }: ToastItemProps) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      setShow(true)
    })
  }, [])

  const handleClose = () => {
    setShow(false)
    setTimeout(onClose, 250)
  }

  const bgColors = {
    success: 'bg-green-600',
    error: 'bg-[#b91c1c]',
    info: 'bg-[#2aa2c1]',
  }

  return (
    <div
      className={`pointer-events-auto w-80 ${bgColors[type]} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm transition-all duration-200 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
      }`}
    >
      <div className="flex-1">{message}</div>
      <button
        onClick={handleClose}
        className="text-white/90 hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
