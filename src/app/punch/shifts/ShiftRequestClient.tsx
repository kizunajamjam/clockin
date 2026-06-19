'use client'
import { useState, useTransition } from 'react'
import { upsertShiftRequest, deleteShiftRequest } from './actions'

type Shop = { id: string; name: string }
type ShiftRequest = {
  id: string
  shop_id: string
  date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  status: string
}

function toDateStr(d: Date) { return d.toLocaleDateString('sv-SE') }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r }
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function ShiftRequestClient({
  shops,
  initialRequests,
  weekStart,
}: {
  shops: Shop[]
  initialRequests: ShiftRequest[]
  weekStart: 'mon' | 'sun'
}) {
  const [selectedShop, setSelectedShop] = useState<Shop>(shops[0])
  const [requests, setRequests] = useState(initialRequests)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [useTime, setUseTime] = useState(false)
  const [note, setNote] = useState('')
  const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set())
  const [saving, startSave] = useTransition()
  const [deleting, startDelete] = useTransition()

  // 今日から4週間
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i))

  // 週ごとにグループ化
  const weeks: Date[][] = []
  let week: Date[] = []
  days.forEach((d, i) => {
    week.push(d)
    const isLastOfWeek = weekStart === 'mon' ? d.getDay() === 0 : d.getDay() === 6
    if (isLastOfWeek || i === days.length - 1) { weeks.push(week); week = [] }
  })

  function toggleDate(dateStr: string) {
    setCheckedDates(prev => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })
  }

  function requestFor(dateStr: string) {
    return requests.find(r => r.date === dateStr && r.shop_id === selectedShop?.id)
  }

  function handleSave() {
    if (!selectedShop || checkedDates.size === 0) return
    startSave(async () => {
      for (const dateStr of Array.from(checkedDates).sort()) {
        const fd = new FormData()
        fd.set('shop_id', selectedShop.id)
        fd.set('date', dateStr)
        if (useTime) { fd.set('start_time', startTime); fd.set('end_time', endTime) }
        fd.set('note', note)
        const result = await upsertShiftRequest(fd)
        if (!result?.error) {
          setRequests(prev => {
            const filtered = prev.filter(r => !(r.date === dateStr && r.shop_id === selectedShop.id))
            return [...filtered, {
              id: crypto.randomUUID(),
              shop_id: selectedShop.id,
              date: dateStr,
              start_time: useTime ? startTime : null,
              end_time: useTime ? endTime : null,
              note: note || null,
              status: 'pending',
            }]
          })
        }
      }
      setCheckedDates(new Set())
      setNote('')
    })
  }

  function handleDelete(requestId: string, dateStr: string) {
    startDelete(async () => {
      const fd = new FormData()
      fd.set('request_id', requestId)
      await deleteShiftRequest(fd)
      setRequests(prev => prev.filter(r => r.id !== requestId))
    })
  }

  const statusLabel = (s: string) =>
    s === 'approved' ? '✅ 承認' : s === 'rejected' ? '❌ 却下' : '⏳ 確認中'
  const statusColor = (s: string) =>
    s === 'approved' ? 'text-green-600' : s === 'rejected' ? 'text-red-500' : 'text-amber-500'

  return (
    <div className="space-y-4">
      {/* 店舗選択（複数店舗の場合） */}
      {shops.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {shops.map(s => (
            <button key={s.id} onClick={() => setSelectedShop(s)}
              className={`px-3 py-1.5 rounded-full text-sm border ${selectedShop?.id === s.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* 時刻設定 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">希望時刻を指定する</p>
          <button onClick={() => setUseTime(v => !v)} type="button"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useTime ? 'bg-gray-900' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useTime ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        {useTime && (
          <div className="flex gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">開始</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">終了</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-gray-500">メモ（任意）</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="例：午前のみ希望"
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>

      {/* 日付選択（週ごとに区切り） */}
      <div className="space-y-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {week.map(day => {
              const dateStr = toDateStr(day)
              const isChecked = checkedDates.has(dateStr)
              const existing = requestFor(dateStr)
              const isToday = dateStr === toDateStr(new Date())
              const isSat = day.getDay() === 6, isSun = day.getDay() === 0

              return (
                <div key={dateStr}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors
                    ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  {/* チェック */}
                  <button onClick={() => toggleDate(dateStr)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-colors
                      ${isChecked ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'}`}>
                    {isChecked ? '✓' : ''}
                  </button>

                  {/* 日付 */}
                  <button onClick={() => toggleDate(dateStr)} className="flex items-center gap-1.5 flex-1 text-left">
                    <span className={`text-sm font-medium w-6 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                      {WEEKDAYS[day.getDay()]}
                    </span>
                    <span className={`text-sm ${isToday ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                      {day.getMonth() + 1}/{day.getDate()}{isToday ? ' 今日' : ''}
                    </span>
                  </button>

                  {/* 登録済みの希望 */}
                  {existing ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${statusColor(existing.status)}`}>
                        {statusLabel(existing.status)}
                      </span>
                      {existing.start_time && (
                        <span className="text-xs text-gray-500">{existing.start_time.slice(0,5)}〜{existing.end_time?.slice(0,5)}</span>
                      )}
                      {existing.status === 'pending' && (
                        <button onClick={() => handleDelete(existing.id, dateStr)}
                          disabled={deleting}
                          className="text-xs text-gray-400 hover:text-red-500">取消</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">未提出</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 保存ボタン */}
      {checkedDates.size > 0 && (
        <div className="sticky bottom-20 bg-white border border-gray-200 rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600">{checkedDates.size}日選択中</p>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {saving ? '送信中...' : '希望を提出する'}
          </button>
        </div>
      )}
    </div>
  )
}
