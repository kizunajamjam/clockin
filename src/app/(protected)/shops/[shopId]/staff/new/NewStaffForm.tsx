'use client'
import { useActionState } from 'react'
import { createStaff } from './actions'
import { MinWageWarning } from './MinWageWarning'

export function NewStaffForm({
  shopId, hasTablet, prefecture,
}: {
  shopId: string
  hasTablet: boolean
  prefecture: string | null
}) {
  const [state, action, isPending] = useActionState(createStaff, null)

  return (
    <form action={action} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <input type="hidden" name="shop_id" value={shopId} />

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}

      {/* 基本情報 */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">基本情報</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">氏名 <span className="text-red-500">*</span></label>
          <input name="name" type="text" required placeholder="例：山田 太郎"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">性別（任意）</label>
          <select name="gender"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">選択しない</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
        </div>
      </div>

      {/* 給与設定 */}
      <div className="space-y-4 border-t border-gray-100 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">給与設定</h2>
        <MinWageWarning shopPrefecture={prefecture} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">交通費（円）</label>
            <input name="transport_fee" type="number" min={0} defaultValue={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">交通費タイプ</label>
            <select name="transport_fee_type"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="daily">日払い</option>
              <option value="monthly">月払い</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="hidden" name="night_rate_included" value="false" />
          <input type="checkbox" name="night_rate_included" value="true" className="h-4 w-4 rounded border-gray-300" />
          <div>
            <p className="text-sm font-medium text-gray-800">深夜割増込み賃金</p>
            <p className="text-xs text-gray-500">時給に深夜割増（×1.25）が既に含まれている場合</p>
          </div>
        </label>
      </div>

      {/* PIN */}
      {hasTablet && (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">タブレット打刻設定</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">PIN（4〜6桁）<span className="text-red-500">*</span></label>
            <input name="pin" type="text" inputMode="numeric" pattern="\d{4,6}" maxLength={6} placeholder="例：1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            <p className="text-xs text-gray-400">4〜6桁の数字で設定できます（長いほど安全）</p>
          </div>
        </div>
      )}

      {/* 年収アラート */}
      <div className="space-y-4 border-t border-gray-100 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">年収アラート（任意）</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">アラート閾値（円）</label>
          <input name="income_alert_amount" type="number" min={0} placeholder="例：1030000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <p className="text-xs text-gray-400">掛け持ちを考慮した任意の金額を設定できます</p>
        </div>
      </div>

      <button type="submit" disabled={isPending}
        className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {isPending ? '追加中...' : 'スタッフを追加'}
      </button>
    </form>
  )
}
