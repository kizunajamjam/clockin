'use client'
import { useState, useTransition } from 'react'
import { createDrinkItem, deleteDrinkItem } from './actions'

type DrinkItem = { id: string; name: string }

function ItemForm({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function submit() {
    setError('')
    start(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('name', name)
      const result = await createDrinkItem(null, fd)
      if (result?.error) setError(result.error)
      else onDone()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-500">項目名</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="例：ドリンク、シャンパン、テキーラ"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={pending}
          className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
          {pending ? '保存中...' : '追加'}
        </button>
        <button onClick={onDone} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">キャンセル</button>
      </div>
    </div>
  )
}

export function DrinkItemsClient({ shopId, initialItems }: { shopId: string; initialItems: DrinkItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [adding, setAdding] = useState(false)
  const [, startDelete] = useTransition()

  function refresh() {
    setAdding(false)
    window.location.reload()
  }

  function handleDelete(id: string) {
    if (!confirm('この項目を削除します。記録済みのカウントも削除されます。よろしいですか？')) return
    startDelete(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('item_id', id)
      await deleteDrinkItem(fd)
      setItems(prev => prev.filter(i => i.id !== id))
    })
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
          ジャンルはまだありません
        </div>
      )}

      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-medium">{item.name}</p>
          <button onClick={() => handleDelete(item.id)} className="text-xs text-gray-300 hover:text-red-500">削除</button>
        </div>
      ))}

      {adding ? (
        <ItemForm shopId={shopId} onDone={refresh} />
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          + ジャンルを追加
        </button>
      )}
    </div>
  )
}
