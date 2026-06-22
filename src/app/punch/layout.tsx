import Link from 'next/link'

export default function PunchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 pb-16">
        {children}
      </div>
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex h-16 z-40">
        {[
          { href: '/punch', label: '打刻', icon: '⏱' },
          { href: '/profile', label: '設定', icon: '👤' },
        ].map(({ href, label, icon }) => (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-gray-900 transition-colors">
            <span className="text-xl">{icon}</span>
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
