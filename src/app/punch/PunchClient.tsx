'use client'
import { useState, useTransition } from 'react'
import { punchSmartphone } from './actions'
import { AdBanner } from '@/components/AdBanner'
import { PushPermission } from '@/components/PushPermission'

type Shop = { id: string; name: string; gps_enabled: boolean; gps_radius_m: number }
type Screen = 'select' | 'punching' | 'result' | 'error'

export function PunchClient({ staffName, shops }: { staffName: string; shops: Shop[] }) {
  const [screen, setScreen] = useState<Screen>(shops.length === 1 ? 'punching' : 'select')
  const [selectedShop, setSelectedShop] = useState<Shop | null>(shops.length === 1 ? shops[0] : null)
  const [result, setResult] = useState<{ type: 'in' | 'out'; shopName: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function startPunch(shop: Shop) {
    setSelectedShop(shop)
    setScreen('punching')
    doPunch(shop)
  }

  function doPunch(shop: Shop) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('shop_id', shop.id)

      if (shop.gps_enabled) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            })
          })
          fd.set('gps_lat', pos.coords.latitude.toString())
          fd.set('gps_lng', pos.coords.longitude.toString())
        } catch {
          setErrorMsg('GPS位置情報の取得に失敗しました。ブラウザの位置情報を許可してください')
          setScreen('error')
          return
        }
      }

      const res = await punchSmartphone(fd)
      if (res.success) {
        setResult({ type: res.type, shopName: res.shopName })
        setScreen('result')
      } else {
        setErrorMsg(res.error)
        setScreen('error')
      }
    })
  }

  // 店舗選択
  if (screen === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-sm text-gray-500 mb-2">{staffName}</p>
        <h1 className="text-xl font-bold mb-6">店舗を選択</h1>
        <div className="w-full max-w-xs space-y-3">
          {shops.map(shop => (
            <button
              key={shop.id}
              onClick={() => startPunch(shop)}
              className="w-full py-4 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              {shop.name}
            </button>
          ))}
          {shops.length === 0 && (
            <p className="text-sm text-gray-400 text-center">
              スマホ打刻が有効な店舗がありません
            </p>
          )}
        </div>
      </div>
    )
  }

  // GPS取得・打刻中
  if (screen === 'punching') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-4xl mb-4 animate-pulse">📍</div>
        <p className="text-gray-600">{selectedShop?.gps_enabled ? 'GPS取得中...' : '打刻中...'}</p>
      </div>
    )
  }

  // 完了
  if (screen === 'result' && result) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 space-y-4">
        <div className="flex flex-col items-center">
          <div className={`text-6xl mb-4 ${result.type === 'in' ? 'text-green-500' : 'text-blue-500'}`}>
            ✓
          </div>
          <h2 className="text-xl font-bold mb-1">{staffName}</h2>
          <p className="text-gray-600 mb-1">{result.shopName}</p>
          <p className="text-lg font-medium text-gray-800">
            {result.type === 'in' ? '出勤しました' : '退勤しました'}
          </p>
          <p className="text-sm text-gray-400 mt-1">{new Date().toLocaleTimeString('ja-JP')}</p>
          <button
            onClick={() => { setScreen(shops.length === 1 ? 'punching' : 'select'); setResult(null) }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            戻る
          </button>
        </div>
        {/* プッシュ通知許可（未設定のみ表示） */}
        <div className="w-full max-w-xs">
          <PushPermission />
        </div>
        {/* 広告（打刻ボタンから離れた確認画面のみ表示） */}
        <AdBanner className="w-full max-w-xs" />
      </div>
    )
  }

  // エラー
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-sm text-red-600 text-center mb-4 max-w-xs">{errorMsg}</p>
      <button
        onClick={() => {
          setErrorMsg('')
          setScreen(shops.length === 1 ? 'punching' : 'select')
          if (shops.length === 1 && selectedShop) doPunch(selectedShop)
        }}
        className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm"
      >
        もう一度試す
      </button>
    </div>
  )
}
