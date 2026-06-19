'use client'
import { useState, useTransition } from 'react'
import { createSalaryItem, updateSalaryItem, deleteSalaryItem } from './actions'
import { CUSTOM_TYPE_LABEL, type CustomItem, type CustomItemType } from '@/lib/payroll'

const TYPE_OPTIONS: { value: CustomItemType; label: string; hint: string; unit: 'price' | 'percent' | null }[] = [
  { value: 'count_unit', label: '件数×単価', hint: '例：ドリンク¥50/杯。単価を設定し、月次で件数を入力', unit: 'price' },
  { value: 'time_unit', label: '時間×単価', hint: '例：特定時間帯手当。単価を設定し、月次で時間数を入力', unit: 'price' },
  { value: 'percentage', label: '売上×歩合', hint: '例：売上3%。率(%)を設定し、月次で売上額を入力', unit: 'percent' },
  { value: 'fixed', label: '固定額', hint: '例：皆勤手当。月次で金額を入力', unit: null },
  { value: 'expense', label: '実費', hint: '例：立替交通費。月次で金額を入力', unit: null },
]

function typeMeta(t: CustomItemType) {
  return TYPE_OPTIONS.find(o => o.value === t)!
}

function ItemForm({ shopId, item, onDone }: { shopId: string; item?: CustomItem; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState<CustomItemType>(item?.type ?? 'count_unit')
  const [unitPrice, setUnitPrice] = useState(item?.unit_price?.toString() ?? '')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const meta = typeMeta(type)

  function submit() {
    setError('')
    start(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      if (item) fd.set('item_id', item.id)
      fd.set('name', name)
      fd.set('type', type)
      if (meta.unit) fd.set('unit_price', unitPrice)
      const result = item ? await updateSalaryItem(null, fd) : await createSalaryItem(null, fd)
      if (result?.error) setError(result.error)
      else onDone()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-500">項目名</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="例：ドリンク手当"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">種類</label>
        <select value={type} onChange={e => setType(e.target.value as CustomItemType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-gray-400">{meta.hint}</p>
      </div>
      {meta.unit && (
        <div className="space-y-1">
          <label className="text-xs text-gray-500">{meta.unit === 'percent' ? '率（%）' : '単価（円）'}</label>
          <input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={pending}
          className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
          {pending ? '保存中...' : item ? '更新' : '追加'}
        </button>
        <button onClick={onDone} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">キャンセル</button>
      </div>
    </div>
  )
}

export function SalaryItemsClient({ shopId, initialItems }: { shopId: string; initialItems: CustomItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [, startDelete] = useTransition()

  // server action後の最新化は revalidatePath に任せ、ローカルでは編集UIを閉じるだけ
  function refresh() {
    setAdding(false)
    setEditingId(null)
    // 反映のためページをリロード（revalidatePath済みのサーバーデータを取得）
    window.location.reload()
  }

  function handleDelete(id: string) {
    if (!confirm('この項目を削除します。各スタッフの月次入力も削除されます。よろしいですか？')) return
    startDelete(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('item_id', id)
      await deleteSalaryItem(fd)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
          カスタム項目はまだありません
        </div>
      )}

      {items.map(item => (
        editingId === item.id ? (
          <ItemForm key={item.id} shopId={shopId} item={item} onDone={refresh} />
        ) : (
          <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-gray-400">
                {CUSTOM_TYPE_LABEL[item.type]}
                {item.unit_price != null && (item.type === 'percentage' ? ` ・ ${item.unit_price}%` : ` ・ ¥${item.unit_price}`)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button onClick={() => setEditingId(item.id)} className="text-gray-500 hover:text-gray-900">編集</button>
              <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500">削除</button>
            </div>
          </div>
        )
      ))}

      {adding ? (
        <ItemForm shopId={shopId} onDone={refresh} />
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          + 項目を追加
        </button>
      )}
    </div>
  )
}
