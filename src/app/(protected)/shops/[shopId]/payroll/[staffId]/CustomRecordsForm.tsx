'use client'
import { useState, useTransition } from 'react'
import { upsertCustomRecords } from './actions'
import { customItemAmount, CUSTOM_TYPE_LABEL, type CustomLine } from '@/lib/payroll'

const INPUT_LABEL: Record<CustomLine['type'], string> = {
  count_unit: '件数',
  time_unit: '時間数',
  percentage: '売上額（円）',
  fixed: '金額（円）',
  expense: '金額（円）',
}

export function CustomRecordsForm({
  shopId, staffId, yearMonth, initialLines,
}: {
  shopId: string
  staffId: string
  yearMonth: string
  initialLines: CustomLine[]
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initialLines.map(l => [l.itemId, l.value ? String(l.value) : '']))
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  if (initialLines.length === 0) return null

  const lines = initialLines.map(l => {
    const v = parseFloat(values[l.itemId] ?? '')
    const value = Number.isFinite(v) ? v : 0
    return { ...l, value, amount: customItemAmount({ type: l.type, unit_price: l.unitPrice }, value) }
  })
  const total = lines.reduce((s, l) => s + l.amount, 0)

  function save() {
    setError(''); setSaved(false)
    start(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('staff_id', staffId)
      fd.set('year_month', yearMonth)
      for (const l of initialLines) fd.set(`value_${l.itemId}`, values[l.itemId] ?? '0')
      const result = await upsertCustomRecords(null, fd)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="text-sm font-medium">カスタム項目（{yearMonth}）</h2>
      <div className="space-y-2">
        {lines.map(l => (
          <div key={l.itemId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{l.name}</p>
              <p className="text-xs text-gray-400">
                {CUSTOM_TYPE_LABEL[l.type]}
                {l.unitPrice != null && (l.type === 'percentage' ? ` ${l.unitPrice}%` : ` ¥${l.unitPrice}`)}
              </p>
            </div>
            <div className="w-28">
              <input type="number" min={0} step="any" value={values[l.itemId] ?? ''}
                onChange={e => { setValues(v => ({ ...v, [l.itemId]: e.target.value })); setSaved(false) }}
                placeholder={INPUT_LABEL[l.type]}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right" />
            </div>
            <div className="w-20 text-right text-sm font-medium text-gray-700">¥{l.amount.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-sm text-gray-500">カスタム項目合計</span>
        <span className="text-sm font-bold">¥{total.toLocaleString()}</span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button onClick={save} disabled={pending}
        className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
        {pending ? '保存中...' : saved ? '✓ 保存しました' : '入力を保存'}
      </button>
      <p className="text-xs text-gray-400">保存後、上の支給合計に反映するにはページを再読み込みしてください。</p>
    </div>
  )
}
