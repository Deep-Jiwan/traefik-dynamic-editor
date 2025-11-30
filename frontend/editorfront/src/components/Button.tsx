import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
  disabled?: boolean
}

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  className = '',
  disabled = false,
}: ButtonProps) => {
  const baseClass =
    'px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses = {
    primary: 'bg-[#2aa2c1] hover:bg-[#238a9f] text-white focus:ring-[#2aa2c1]',
    secondary: 'border border-[#2f3d4d] text-white hover:bg-[hsla(206,100%,50%,0.04)] focus:ring-[#2aa2c1]',
    danger: 'bg-[#b91c1c] hover:bg-[#991b1b] text-white focus:ring-[#b91c1c]',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
