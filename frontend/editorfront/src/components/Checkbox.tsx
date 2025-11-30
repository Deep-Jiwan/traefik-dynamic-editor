import { FiCheck } from 'react-icons/fi'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export const Checkbox = ({ checked, onChange, label, disabled = false }: CheckboxProps) => {
  return (
    <label className="flex items-center cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`
            w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center
            ${checked 
              ? 'bg-[#2aa2c1] border-[#2aa2c1]' 
              : 'bg-[#081727] border-[#2f3d4d] group-hover:border-[#2aa2c1]/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {checked && <FiCheck className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </div>
      </div>
      {label && (
        <span className={`ml-2 text-sm text-white select-none ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </label>
  )
}
