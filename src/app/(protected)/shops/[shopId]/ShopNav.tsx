'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function ShopNav({ shopId }: { shopId: string }) {
  const pathname = usePathname()
  const base = `/shops/${shopId}`

  const items: { href: string; label: string; icon: string; exact?: boolean }[] = [
    { href: base, label: '店舗', icon: '🏠', exact: true },
    { href: `${base}/attendance`, label: '勤怠', icon: '🕐' },
    { href: `${base}/shifts`, label: 'シフト', icon: '📅' },
    { href: `${base}/payroll`, label: '給与', icon: '💰' },
    { href: `${base}/settings`, label: '設定', icon: '⚙️' },
  ]

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-5 max-w-2xl mx-auto">
      {items.map(it => {
        const active = isActive(it.href, it.exact)
        return (
          <Link key={it.href} href={it.href}
            className={`flex flex-col items-center justify-center py-2 text-[11px] gap-0.5 transition-colors
              ${active ? 'text-gray-900 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
            <span className="text-base leading-none">{it.icon}</span>
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
