'use client'
import { useActionState, useState } from 'react'
import { updateShop } from './actions'
import { PREFECTURES } from '@/lib/minWage'

type DefaultValues = {
  name: string
  prefecture: string
  punchModes: string[]
  gpsEnabled: boolean
  gpsLat: string
  gpsLng: string
  gpsRadiusM: number
  weekStart: string
  eiRatePercent: string
}

export function ShopSettingsForm({ shopId, defaultValues: dv }: { shopId: string; defaultValues: DefaultValues }) {
  const [state, action, pending] = useActionState(updateShop, null)
  const [punchModes, setPunchModes] = useState<string[]>(dv.punchModes)
  const [gpsEnabled, setGpsEnabled] = useState(dv.gpsEnabled)
  const [gpsLat, setGpsLat] = useState(dv.gpsLat)
  const [gpsLng, setGpsLng] = useState(dv.gpsLng)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  function togglePunchMode(mode: string) {
    setPunchModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode])
  }

  async function getLocation() {
    if (!navigator.geolocation) { setGpsStatus('error'); return }
    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude.toFixed(6))
        setGpsLng(pos.coords.longitude.toFixed(6))
        setGpsStatus('done')
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <form action={action} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <input type="hidden" name="shop_id" value={shopId} />

      {/* 店舗名 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">店舗名 <span className="text-red-500">*</span></label>
        <input type="text" name="name" required defaultValue={dv.name}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      {/* 都道府県 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">都道府県 <span className="text-red-500">*</span></label>
        <select name="prefecture" required defaultValue={dv.prefecture}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="">選択してください</option>
          {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* シフト週始め */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">シフトの週始め</label>
        <select name="week_start" defaultValue={dv.weekStart}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="mon">月曜始まり</option>
          <option value="sun">日曜始まり</option>
        </select>
      </div>

      {/* 雇用保険料率（MVPでは非表示。既存値を維持して送信） */}
      <input type="hidden" name="ei_rate_percent" value={dv.eiRatePercent} />

      {/* 打刻方式 */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">打刻方式 <span className="text-red-500">*</span></p>
        {[
          { value: 'tablet', label: '共有タブレット', desc: '店頭の端末でPIN入力して打刻' },
          { value: 'smartphone', label: '個人スマホ', desc: 'スタッフが自分のスマホで打刻' },
        ].map(({ value, label, desc }) => (
          <label key={value} className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="punch_modes" value={value}
              checked={punchModes.includes(value)}
              onChange={() => togglePunchMode(value)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* GPS設定 */}
      {punchModes.includes('smartphone') && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">GPS位置確認</p>
              <p className="text-xs text-gray-500">店舗の半径内のみ打刻を許可</p>
            </div>
            <button type="button" onClick={() => setGpsEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gpsEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gpsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {gpsEnabled && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">許可半径（m）</label>
                <input type="number" name="gps_radius_m" min={50} max={1000} defaultValue={dv.gpsRadiusM}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <p className="text-xs text-gray-400">50〜1000m。屋内は広めに設定推奨</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">店舗の位置</p>
                {gpsLat && gpsLng && (
                  <p className="text-xs text-green-600">現在の設定: ({gpsLat}, {gpsLng})</p>
                )}
                <button type="button" onClick={getLocation} disabled={gpsStatus === 'loading'}
                  className="w-full py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  {gpsStatus === 'loading' ? '取得中...' : '現在地で更新'}
                </button>
                {gpsStatus === 'done' && <p className="text-xs text-green-600">取得済み（{gpsLat}, {gpsLng}）</p>}
                {gpsStatus === 'error' && <p className="text-xs text-red-500">位置情報を取得できませんでした</p>}
                <input type="hidden" name="gps_lat" value={gpsLat} />
                <input type="hidden" name="gps_lng" value={gpsLng} />
              </div>
            </>
          )}
        </div>
      )}

      <input type="hidden" name="gps_enabled" value={punchModes.includes('smartphone') ? String(gpsEnabled) : 'false'} />

      {'error' in (state ?? {}) && (
        <p className="text-sm text-red-600">{(state as { error: string }).error}</p>
      )}
      {'success' in (state ?? {}) && (
        <p className="text-sm text-green-600">{(state as { success: string }).success}</p>
      )}

      <button type="submit" disabled={pending || punchModes.length === 0}
        className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {pending ? '保存中...' : '保存する'}
      </button>
    </form>
  )
}
