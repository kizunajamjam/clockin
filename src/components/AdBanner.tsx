'use client'
import { useEffect, useRef } from 'react'

// Google AdSense 広告バナー
// NEXT_PUBLIC_ADSENSE_CLIENT_ID に Publisher ID (ca-pub-XXXXXXXX) を設定してください
const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? ''
const SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID ?? ''

export function AdBanner({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!CLIENT_ID || !SLOT_ID) return
    try {
      // @ts-expect-error adsbygoogle global
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [])

  if (!CLIENT_ID || !SLOT_ID) {
    // 広告ID未設定時はプレースホルダを表示
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 min-h-[60px] ${className}`}>
        広告スペース
      </div>
    )
  }

  return (
    <div className={className}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
