import type { ReactNode } from 'react'

interface RoutersTableProps {
  children: ReactNode
}

export const RoutersTable = ({ children }: RoutersTableProps) => {
  return (
    <div className="rounded-lg shadow-md" style={{ display: 'table', width: '100%', backgroundColor: 'var(--colors-01dp)' }}>
      <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: 'Rubik, sans-serif', borderRadius: '8px', overflow: 'hidden' }}>
        <thead className="border-b border-[#2f3d4d]" style={{ backgroundColor: 'var(--colors-01dp)' }}>
          <tr>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '12%' }}>
              Router Name
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '20%' }}>
              Host
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '10%' }}>
              Service
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '13%' }}>
              Entry Points
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '7%' }}>
              TLS
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '7%' }}>
              AUTH
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '13%' }}>
              Actions
            </th>
            <th className="px-6 py-5 text-left text-xs font-medium text-[hsla(0,0%,100%,0.51)] uppercase tracking-wider" style={{ width: '12%' }}>
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#394b5e]">{children}</tbody>
      </table>
    </div>
  )
}
