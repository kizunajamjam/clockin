'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function BillingClient({ staffCount }: { staffCount: number }) {
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [seats, setSeats] = useState(Math.max(staffCount, 1))
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const unitPrice = interval === 'year' ? 1500 : 150
  const total = unitPrice * seats

  async function handleUpgrade() {
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval, seatCount: seats }),
    })
    const { url, error } = await res.json()
    if (error) { alert(error); setLoading(false); return }
    router.push(url)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold">プロプランにアップグレード</h2>

      <div className="flex gap-2">
        <button
          onClick={() => setInterval('month')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
            interval === 'month' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'
          }`}
        >
          月払い ¥150/人
        </button>
        <button
          onClick={() => setInterval('year')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
            interval === 'year' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'
          }`}
        >
          年払い ¥1,500/人
          <span className="ml-1 text-xs text-green-500">2ヶ月お得</span>
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          スタッフ数（シート数）
        </label>
        <div className="flex items-center gap-3">
          <button onClick={() => setSeats(s => Math.max(1, s - 1))}
            className="w-8 h-8 rounded-lg border border-gray-200 text-lg font-medium hover:bg-gray-50">−</button>
          <span className="text-xl font-bold w-8 text-center">{seats}</span>
          <button onClick={() => setSeats(s => s + 1)}
            className="w-8 h-8 rounded-lg border border-gray-200 text-lg font-medium hover:bg-gray-50">+</button>
          <span className="text-sm text-gray-400">名</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">現在のスタッフ数: {staffCount}名</p>
      </div>

      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">合計</span>
        <span className="text-xl font-bold">
          ¥{total.toLocaleString()}<span className="text-sm font-normal text-gray-400">/{interval === 'year' ? '年' : '月'}</span>
        </span>
      </div>

      <button onClick={handleUpgrade} disabled={loading}
        className="w-full py-3 bg-gray-900 text-white font-medium rounded-lg disabled:opacity-50 hover:bg-gray-700 transition-colors">
        {loading ? '処理中...' : 'Stripeで支払いに進む'}
      </button>
    </div>
  )
}
