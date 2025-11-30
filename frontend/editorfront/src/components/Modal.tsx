import { ReactNode } from 'react'
import { FiX } from 'react-icons/fi'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

export const Modal = ({ isOpen, onClose, title, description, children }: ModalProps) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div
        className="absolute inset-0 bg-black/30"
        style={{ backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div className="relative bg-[#1e2b39] rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="p-6 border-b border-[#2f3d4d]">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              {description && (
                <p className="text-sm text-[hsla(0,0%,100%,0.51)] mt-1">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
