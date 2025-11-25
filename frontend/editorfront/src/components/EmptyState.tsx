import { FiFileText, FiPlus } from 'react-icons/fi'
import { Button } from './Button'

interface EmptyStateProps {
  onAddClick: () => void
}

export const EmptyState = ({ onAddClick }: EmptyStateProps) => {
  return (
    <div className="text-center py-16">
      <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-[hsla(0,0%,100%,0.74)]">
        No routers configured
      </h3>
      <p className="mt-2 text-[hsla(0,0%,100%,0.51)]">
        Get started by adding your first router
      </p>
      <div className="mt-4 flex justify-center">
        <Button onClick={onAddClick} variant="primary">
          <div className="flex items-center gap-2">
            <FiPlus className="w-4 h-4" />
            Add Router
          </div>
        </Button>
      </div>
    </div>
  )
}
