import { useEffect, useState } from 'react'
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi'
import { useToast } from '../contexts/ToastContext'

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div
      className="fixed top-32 right-10 z-[9999] flex flex-col gap-3 items-end pointer-events-none w-auto max-w-xs"
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

  const toastStyles = {
    success: {
      bg: 'bg-[#1e2b39]',
      border: 'border-[#30a46c]/40',
      text: 'text-[#30a46c]',
      icon: <FiCheckCircle className="w-4 h-4 flex-shrink-0" />,
    },
    error: {
      bg: 'bg-[#1e2b39]',
      border: 'border-[#dc3545]/40',
      text: 'text-[#ff6b6b]',
      icon: <FiAlertCircle className="w-4 h-4 flex-shrink-0" />,
    },
    info: {
      bg: 'bg-[#1e2b39]',
      border: 'border-[#2aa2c1]/40',
      text: 'text-[#2aa2c1]',
      icon: <FiInfo className="w-4 h-4 flex-shrink-0" />,
    },
  }

  const style = toastStyles[type]

  return (
    <div
      className={`pointer-events-auto w-64 ${style.bg} border ${style.border} text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-sm transition-all duration-200 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
      }`}
    >
      <div className={style.text}>{style.icon}</div>
      <div className="flex-1">{message}</div>
      <button
        onClick={handleClose}
        className="text-white/60 hover:text-white transition-colors flex-shrink-0"
        aria-label="Close notification"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
