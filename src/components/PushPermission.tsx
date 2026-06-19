'use client'
import { useState, useEffect } from 'react'

// NEXT_PUBLIC_VAPID_PUBLIC_KEY に VAPID公開鍵を設定してください
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

export function PushPermission() {
  const [status, setStatus] = useState<'idle' | 'asking' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'granted') setStatus('subscribed')
    else if (Notification.permission === 'denied') setStatus('denied')
  }, [])

  async function requestPermission() {
    if (!VAPID_PUBLIC_KEY) return
    setStatus('asking')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const key = sub.getKey('p256dh')
      const authKey = sub.getKey('auth')
      if (!key || !authKey) { setStatus('denied'); return }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
        }),
      })
      setStatus('subscribed')
    } catch {
      setStatus('denied')
    }
  }

  if (status === 'subscribed' || status === 'unsupported' || !VAPID_PUBLIC_KEY) return null
  if (status === 'denied') return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
      <span className="text-xl">🔔</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-800">出勤リマインダーを受け取る</p>
        <p className="text-xs text-blue-600 mt-0.5">シフト前に通知でお知らせします</p>
      </div>
      <button
        onClick={requestPermission}
        disabled={status === 'asking'}
        className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'asking' ? '...' : '許可する'}
      </button>
    </div>
  )
}
