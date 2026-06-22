'use client'
import { useActionState } from 'react'
import { updateStaff } from './actions'

type DefaultValues = {
  name: string
  gender: string
  hourlyRate: number
  transportFee: number
  transportFeeType: string
  nightRateIncluded: boolean
  incomeAlertAmount?: number
  isActive: boolean
}

export function StaffEditForm({
  staffId, shopId, hasTablet, defaultValues: dv,
}: {
  staffId: string
  shopId: string
  hasTablet: boolean
  defaultValues: DefaultValues
}) {
  const [state, action, pending] = useActionState(updateStaff, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="shop_id" value={shopId} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
        <input type="text" name="name" required defaultValue={dv.name}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
        <select name="gender" defaultValue={dv.gender}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">未設定</option>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="other">その他</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">時給（円）</label>
          <input type="number" name="hourly_rate" required min={0} defaultValue={dv.hourlyRate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">交通費（円）</label>
          <input type="number" name="transport_fee" min={0} defaultValue={dv.transportFee}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">交通費タイプ</label>
        <select name="transport_fee_type" defaultValue={dv.transportFeeType}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="daily">日払い</option>
          <option value="monthly">月払い</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="night_rate_included" value="false" />
        <input type="checkbox" name="night_rate_included" value="true" defaultChecked={dv.nightRateIncluded} />
        深夜割増込み賃金（22:00〜5:00の割増を二重計算しない）
      </label>

      {hasTablet && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PIN変更（4〜6桁・空白で変更なし）</label>
          <input type="text" name="pin" inputMode="numeric" maxLength={6} pattern="\d{4,6}" placeholder="新しいPIN"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
        </div>
      )}

      {/* 年収アラートはMVPでは非表示。既存値を維持して送信 */}
      <input type="hidden" name="income_alert_amount" value={dv.incomeAlertAmount ?? ''} />

      <label className="flex items-center gap-2 text-sm">
        <input type="hidden" name="is_active" value="false" />
        <input type="checkbox" name="is_active" value="true" defaultChecked={dv.isActive} />
        在籍中（OFFにすると退職扱い・打刻不可）
      </label>

      {'error' in (state ?? {}) && (
        <p className="text-sm text-red-600">{(state as { error: string }).error}</p>
      )}
      {'success' in (state ?? {}) && (
        <p className="text-sm text-green-600">{(state as { success: string }).success}</p>
      )}

      <button type="submit" disabled={pending}
        className="w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors">
        {pending ? '保存中...' : '保存する'}
      </button>
    </form>
  )
}
