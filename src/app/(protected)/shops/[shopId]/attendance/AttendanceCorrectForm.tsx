'use client'
import { useState, useActionState } from 'react'
import { correctAttendance } from './actions'

export function AttendanceCorrectForm({
  attendanceId, shopId, clockedInAt, clockedOutAt,
}: {
  attendanceId: string
  shopId: string
  clockedInAt: string
  clockedOutAt: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(correctAttendance, null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 w-full text-right">
        修正する
      </button>
    )
  }

  return (
    <form action={action} className="border-t border-gray-100 pt-3 space-y-2">
      <input type="hidden" name="attendance_id" value={attendanceId} />
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">出勤時刻</label>
          <input type="datetime-local" name="clocked_in_at" defaultValue={clockedInAt}
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
        </div>
        <div>
          <label className="text-xs text-gray-500">退勤時刻</label>
          <input type="datetime-local" name="clocked_out_at" defaultValue={clockedOutAt}
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">修正理由（必須）</label>
        <input type="text" name="note" required placeholder="例: 打刻漏れのため手動修正"
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
      </div>
      {'error' in (state ?? {}) && (
        <p className="text-xs text-red-600">{(state as { error: string }).error}</p>
      )}
      {'success' in (state ?? {}) && (
        <p className="text-xs text-green-600">{(state as { success: string }).success}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 py-1.5 bg-gray-900 text-white text-xs rounded disabled:opacity-50">
          {pending ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-gray-200 text-xs rounded text-gray-500">
          キャンセル
        </button>
      </div>
    </form>
  )
}
