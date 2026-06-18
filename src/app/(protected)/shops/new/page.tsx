'use client'
import { useActionState, useState } from 'react'
import { createShop } from './actions'

export default function NewShopPage() {
  const [state, action, isPending] = useActionState(createShop, null)
  const [gpsEnabled, setGpsEnabled] = useState(true)
  const [punchModes, setPunchModes] = useState<string[]>(['tablet', 'smartphone'])
  const [gpsLat, setGpsLat] = useState<string>('')
  const [gpsLng, setGpsLng] = useState<string>('')
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function togglePunchMode(mode: string) {
    setPunchModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    )
  }

  async function getLocation() {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude.toFixed(6))
        setGpsLng(pos.coords.longitude.toFixed(6))
        setGpsStatus('done')
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="font-bold text-lg">店舗を作成</h1>
      </header>

      <main className="max-w-lg mx-auto p-6">
        <form action={action} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {/* 店舗名 */}
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              店舗名 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="例：渋谷店"
            />
          </div>

          {/* 都道府県（最低賃金チェックに使用） */}
          <div className="space-y-1">
            <label htmlFor="prefecture" className="text-sm font-medium text-gray-700">
              都道府県 <span className="text-red-500">*</span>
            </label>
            <select
              id="prefecture"
              name="prefecture"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">選択してください</option>
              {['北海道','青森','岩手','宮城','秋田','山形','福島','茨城','栃木','群馬','埼玉','千葉','東京','神奈川','新潟','富山','石川','福井','山梨','長野','岐阜','静岡','愛知','三重','滋賀','京都','大阪','兵庫','奈良','和歌山','鳥取','島根','岡山','広島','山口','徳島','香川','愛媛','高知','福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">スタッフ登録時の最低賃金チェックに使用します</p>
          </div>

          {/* 打刻方式 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              打刻方式 <span className="text-red-500">*</span>
            </p>
            <div className="space-y-2">
              {[
                { value: 'tablet', label: '共有タブレット', desc: '店頭の端末でPIN入力して打刻' },
                { value: 'smartphone', label: '個人スマホ', desc: 'スタッフが自分のスマホで打刻' },
              ].map(({ value, label, desc }) => (
                <label key={value} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="punch_modes"
                    value={value}
                    checked={punchModes.includes(value)}
                    onChange={() => togglePunchMode(value)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* GPS設定（スマホ打刻が有効な場合のみ表示） */}
          {punchModes.includes('smartphone') && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">GPS位置確認</p>
                  <p className="text-xs text-gray-500">店舗の半径内のみ打刻を許可</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGpsEnabled(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    gpsEnabled ? 'bg-gray-900' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      gpsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {gpsEnabled && (
                <>
                  {/* 許可半径 */}
                  <div className="space-y-1">
                    <label htmlFor="gps_radius_m" className="text-sm font-medium text-gray-700">
                      許可半径（m）
                    </label>
                    <input
                      id="gps_radius_m"
                      name="gps_radius_m"
                      type="number"
                      min={50}
                      max={1000}
                      defaultValue={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400">50〜1000m。屋内は広めに設定推奨</p>
                  </div>

                  {/* 店舗位置 */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">店舗の位置</p>
                    <button
                      type="button"
                      onClick={getLocation}
                      disabled={gpsStatus === 'loading'}
                      className="w-full py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {gpsStatus === 'loading' ? '取得中...' : '現在地を取得'}
                    </button>
                    {gpsStatus === 'done' && (
                      <p className="text-xs text-green-600">
                        取得済み（{gpsLat}, {gpsLng}）
                      </p>
                    )}
                    {gpsStatus === 'error' && (
                      <p className="text-xs text-red-500">
                        位置情報を取得できませんでした。ブラウザの権限設定を確認してください
                      </p>
                    )}
                    <input type="hidden" name="gps_lat" value={gpsLat} />
                    <input type="hidden" name="gps_lng" value={gpsLng} />
                  </div>
                </>
              )}
            </div>
          )}

          <input type="hidden" name="gps_enabled" value={punchModes.includes('smartphone') ? String(gpsEnabled) : 'false'} />

          <button
            type="submit"
            disabled={isPending || punchModes.length === 0}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? '作成中...' : '店舗を作成'}
          </button>
        </form>
      </main>
    </div>
  )
}
