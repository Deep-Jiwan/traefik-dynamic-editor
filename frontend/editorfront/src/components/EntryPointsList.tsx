import { FiPlus } from 'react-icons/fi'
import type { EntryPoint } from '../types/traefik'

interface EntryPointsListProps {
  entryPoints: Record<string, EntryPoint>
  onAddClick: () => void
}

export const EntryPointsList = ({ entryPoints, onAddClick }: EntryPointsListProps) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4">Entry Points</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(entryPoints).map(([name, config], idx) => (
          <div
            key={`entrypoint-${name}-${idx}`}
            className="rounded-xl flex flex-col justify-center items-center min-h-[125px] p-2"
            style={{ backgroundColor: 'var(--colors-01dp)' }}
          >
            <div className="flex flex-col items-center justify-center gap-3 h-full">
              <span
                className="text-[hsla(0,0%,100%,0.51)] text-xs font-normal uppercase break-all text-center"
                style={{ letterSpacing: '3px' }}
              >
                {name.toUpperCase()}
              </span>
              <span className="text-xl font-medium text-white break-words text-center">
                {config.address}
              </span>
            </div>
          </div>
        ))}

        {/* Add Entry Point Button */}
        <button
          onClick={onAddClick}
          className="bg-[#081727] rounded-xl p-6 border-2 border-dashed border-[#2f3d4d] hover:border-[#2aa2c1] hover:bg-[#1e2b39] transition-colors duration-200 min-h-[125px]"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <FiPlus className="w-8 h-8 text-white" />
            <span className="text-sm font-medium text-white">Add Entry Point</span>
          </div>
        </button>
      </div>
    </div>
  )
}
