'use client'
import { useActionState } from 'react'
import { updateProfile } from './actions'

export function ProfileForm({ incomeAlertAmount }: { incomeAlertAmount?: number }) {
  const [state, action, pending] = useActionState(updateProfile, null)

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          年収アラート金額（円）
        </label>
        <input
          type="number"
          name="income_alert_amount"
          min={0}
          defaultValue={incomeAlertAmount ?? ''}
          placeholder="例: 1030000（103万円）"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <p className="text-xs text-gray-400 mt-1">
          累計収入がこの金額に達するとオーナーと自分に通知が届きます。掛け持ちの場合は他の仕事の収入も考慮して設定してください。
        </p>
      </div>

      {'error' in (state ?? {}) && <p className="text-sm text-red-600">{(state as { error: string }).error}</p>}
      {'success' in (state ?? {}) && <p className="text-sm text-green-600">{(state as { success: string }).success}</p>}

      <button type="submit" disabled={pending}
        className="w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors">
        {pending ? '保存中...' : '保存する'}
      </button>
    </form>
  )
}
