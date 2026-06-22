'use client'
import { useState, useTransition, useEffect } from 'react'
import { createShift, deleteShift, updateShiftRequestStatus, createShiftFromRequest } from './actions'

type Staff = { id: string; name: string; hourly_rate: number; night_rate_included: boolean }
type Shift = { id: string; staff_id: string; starts_at: string; ends_at: string; note: string | null }
type ShiftRequest = { id: string; staff_id: string; date: string; start_time: string | null; end_time: string | null; note: string | null; status: string }
type ViewMode = 'week' | '2week' | 'month'
type WeekStart = 'mon' | 'sun'

// ── 日付ユーティリティ ──────────────────────────────────────
function getWeekStartDate(d: Date, startDay: WeekStart): Date {
  const r = new Date(d)
  const dow = d.getDay() // 0=日
  const offset = startDay === 'mon' ? (dow + 6) % 7 : dow
  r.setDate(d.getDate() - offset)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r
}
function toDateStr(d: Date): string { return d.toLocaleDateString('sv-SE') }
function fmtMD(d: Date): string { return `${d.getMonth() + 1}/${d.getDate()}` }
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
const WEEKDAYS_MON = ['月', '火', '水', '木', '金', '土', '日']
const WEEKDAYS_SUN = ['日', '月', '火', '水', '木', '金', '土']

function getWeekdays(startDay: WeekStart) {
  return startDay === 'mon' ? WEEKDAYS_MON : WEEKDAYS_SUN
}

// 表示上の曜日インデックス（列位置）を返す
function dowIndex(d: Date, startDay: WeekStart): number {
  const dow = d.getDay() // 0=日
  return startDay === 'mon' ? (dow + 6) % 7 : dow
}

// 1シフトの予定人件費を計算（深夜割増考慮）
// payroll.ts と同じ規約: night_rate_included=true は割増込み賃金なので加算しない
function calcShiftCost(shift: Shift, staff: Staff): number {
  const start = new Date(shift.starts_at)
  const end = new Date(shift.ends_at)
  const totalMins = Math.floor((end.getTime() - start.getTime()) / 60000)
  if (totalMins <= 0) return 0

  // 割増込み賃金なら一律時給
  if (staff.night_rate_included) {
    return Math.round((totalMins / 60) * staff.hourly_rate)
  }

  // 深夜時間帯（22:00〜翌5:00）を1分刻みで判定し1.25倍
  let nightMins = 0
  for (let i = 0; i < totalMins; i++) {
    const h = new Date(start.getTime() + i * 60000).getHours()
    if (h >= 22 || h < 5) nightMins++
  }
  const normalMins = totalMins - nightMins
  return Math.round((normalMins / 60 * staff.hourly_rate) + (nightMins / 60 * staff.hourly_rate * 1.25))
}

function fmtCost(yen: number): string {
  return yen === 0 ? '' : `¥${yen.toLocaleString()}`
}

function getDays(base: Date, mode: ViewMode, startDay: WeekStart): Date[] {
  const start = getWeekStartDate(base, startDay)
  if (mode === 'week') return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  if (mode === '2week') return Array.from({ length: 14 }, (_, i) => addDays(start, i))
  const y = base.getFullYear(), m = base.getMonth()
  const last = new Date(y, m + 1, 0)
  return Array.from({ length: last.getDate() }, (_, i) => new Date(y, m, i + 1))
}

// ── メインコンポーネント ──────────────────────────────────────
export function ShiftCalendar({ shopId, staffList, initialShifts, shiftRequests = [], weekStart }: {
  shopId: string
  staffList: Staff[]
  initialShifts: Shift[]
  shiftRequests?: ShiftRequest[]
  weekStart: WeekStart
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [base, setBase] = useState(() => new Date())
  const [shifts, setShifts] = useState(initialShifts)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const savedView = localStorage.getItem(`shift-view-${shopId}`) as ViewMode | null
    if (savedView) setViewMode(savedView)
  }, [shopId])

  function changeViewMode(m: ViewMode) {
    setViewMode(m)
    localStorage.setItem(`shift-view-${shopId}`, m)
  }

  const days = getDays(base, viewMode, weekStart)
  const today = toDateStr(new Date())

  function shiftsFor(staffId: string, day: Date) {
    return shifts.filter(s => s.staff_id === staffId && s.starts_at.startsWith(toDateStr(day)))
  }

  function staffById(staffId: string) {
    return staffList.find(s => s.id === staffId)
  }

  // 日別合計人件費
  function dailyCost(day: Date): number {
    return shifts
      .filter(s => s.starts_at.startsWith(toDateStr(day)))
      .reduce((sum, s) => {
        const staff = staffById(s.staff_id)
        return sum + (staff ? calcShiftCost(s, staff) : 0)
      }, 0)
  }

  const totalCost = days.reduce((sum, d) => sum + dailyCost(d), 0)

  function handleDelete(shiftId: string) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId); fd.set('shift_id', shiftId)
      await deleteShift(fd)
      setShifts(prev => prev.filter(s => s.id !== shiftId))
    })
  }

  function handleCreated(newShifts: Shift[]) {
    setShifts(prev => [...prev, ...newShifts])
  }

  // ナビゲーション
  function prev() {
    if (viewMode === 'month') setBase(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (viewMode === '2week') setBase(d => addDays(d, -14))
    else setBase(d => addDays(d, -7))
  }
  function next() {
    if (viewMode === 'month') setBase(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (viewMode === '2week') setBase(d => addDays(d, 14))
    else setBase(d => addDays(d, 7))
  }
  function goToday() { setBase(new Date()) }

  const rangeLabel = viewMode === 'month'
    ? `${base.getFullYear()}年${base.getMonth() + 1}月`
    : `${fmtMD(days[0])} 〜 ${fmtMD(days[days.length - 1])}`

  function requestsFor(staffId: string, day: Date) {
    return shiftRequests.filter(r => r.staff_id === staffId && r.date === toDateStr(day))
  }

  // スタッフ詳細画面
  if (selectedStaff) {
    return (
      <StaffShiftEditor
        shopId={shopId}
        staff={selectedStaff}
        days={days}
        weekStart={weekStart}
        rangeLabel={rangeLabel}
        shifts={shifts.filter(s => s.staff_id === selectedStaff.id)}
        shiftRequests={shiftRequests.filter(r => r.staff_id === selectedStaff.id)}
        onBack={() => setSelectedStaff(null)}
        onDelete={handleDelete}
        onCreated={handleCreated}
        isPending={isPending}
        onPrev={prev}
        onNext={next}
        onToday={goToday}
        today={today}
      />
    )
  }

  // ── 一覧カレンダー ──
  return (
    <div className="space-y-3">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-2">
        {/* ビュー切替 */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {([['week', '週'], ['2week', '2週'], ['month', '月']] as [ViewMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => changeViewMode(m)}
              className={`px-3 py-1.5 ${viewMode === m ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* ナビ */}
        <button onClick={prev} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">‹</button>
        <button onClick={goToday} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">今日</button>
        <button onClick={next} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">›</button>
        <span className="text-sm font-medium text-gray-700">{rangeLabel}</span>
        {totalCost > 0 && (
          <span className="ml-auto text-sm font-semibold text-gray-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1">
            予定人件費 {fmtCost(totalCost)}
          </span>
        )}
      </div>

      {/* カレンダーグリッド */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="bg-gray-50 border border-gray-200 px-3 py-2 text-left font-medium text-gray-600 min-w-[90px] sticky left-0 z-10">
                スタッフ
              </th>
              {days.map((d, i) => {
                const isToday = toDateStr(d) === today
                const colIdx = dowIndex(d, weekStart)
                const weekdays = getWeekdays(weekStart)
                const isSat = d.getDay() === 6, isSun = d.getDay() === 0
                return (
                  <th key={i} className={`border border-gray-200 px-1 py-1.5 text-center min-w-[72px]
                    ${isToday ? 'bg-blue-50' : 'bg-gray-50'}
                    ${isSat ? 'text-blue-600' : isSun ? 'text-red-600' : 'text-gray-600'}`}>
                    <div className="text-[10px]">{weekdays[colIdx]}</div>
                    <div className={`text-sm font-medium ${isToday ? 'text-blue-700 font-bold' : ''}`}>{d.getDate()}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => (
              <tr key={staff.id}>
                <td className="border border-gray-200 px-2 py-1 bg-white sticky left-0 z-10">
                  <button
                    onClick={() => setSelectedStaff(staff)}
                    className="font-medium text-gray-800 hover:text-blue-600 hover:underline text-left w-full"
                  >
                    {staff.name}
                  </button>
                </td>
                {days.map((day, i) => {
                  const dayShifts = shiftsFor(staff.id, day)
                  const dayRequests = requestsFor(staff.id, day)
                  return (
                    <td key={i} className="border border-gray-200 px-0.5 py-0.5 bg-white align-top">
                      {dayShifts.map(s => (
                        <div key={s.id}
                          className="bg-blue-100 text-blue-800 rounded px-1 py-0.5 mb-0.5 flex items-center justify-between gap-0.5 text-[10px]">
                          <span className="truncate">{fmtTime(s.starts_at)}〜{fmtTime(s.ends_at)}</span>
                          <button onClick={() => handleDelete(s.id)}
                            className="text-blue-400 hover:text-red-500 shrink-0 leading-none">×</button>
                        </div>
                      ))}
                      {dayRequests.map(r => (
                        <div key={r.id} title={`希望: ${r.start_time ? `${r.start_time.slice(0,5)}〜${r.end_time?.slice(0,5)}` : '時間未定'}${r.note ? ` / ${r.note}` : ''}`}
                          className={`rounded px-1 py-0.5 mb-0.5 text-[10px] truncate
                            ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-gray-100 text-gray-400 line-through' : 'bg-amber-100 text-amber-700'}`}>
                          {r.status === 'approved' ? '✓' : r.status === 'rejected' ? '✕' : '?'} 希望
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* 日別人件費合計行 */}
            <tr className="bg-yellow-50">
              <td className="border border-gray-200 px-2 py-1 sticky left-0 z-10 bg-yellow-50">
                <span className="text-xs font-medium text-yellow-800">予定人件費</span>
              </td>
              {days.map((day, i) => {
                const cost = dailyCost(day)
                return (
                  <td key={i} className="border border-gray-200 px-1 py-1 text-center">
                    {cost > 0 && (
                      <span className="text-[10px] font-medium text-yellow-800">{fmtCost(cost)}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">スタッフ名をクリックするとシフト入力画面に移動します</p>
    </div>
  )
}

// ── スタッフ別シフト入力画面 ──────────────────────────────────
function StaffShiftEditor({ shopId, staff, days, weekStart, rangeLabel, shifts, shiftRequests, onBack, onDelete, onCreated, isPending, onPrev, onNext, onToday, today }: {
  shopId: string
  staff: Staff
  days: Date[]
  weekStart: WeekStart
  rangeLabel: string
  shifts: Shift[]
  shiftRequests: ShiftRequest[]
  onBack: () => void
  onDelete: (id: string) => void
  onCreated: (shifts: Shift[]) => void
  isPending: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  today: string
}) {
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [breakMins, setBreakMins] = useState('60')
  const [note, setNote] = useState('')
  const [bulkDow, setBulkDow] = useState<number>(weekStart === 'mon' ? 1 : 0)
  const [checkedDays, setCheckedDays] = useState<Set<string>>(new Set())
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [requests, setRequests] = useState(shiftRequests)
  const [updatingRequest, startUpdateRequest] = useTransition()
  const [reflected, setReflected] = useState<Set<string>>(new Set())
  const [reqError, setReqError] = useState('')

  function handleRequestStatus(requestId: string, status: 'approved' | 'rejected') {
    startUpdateRequest(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('request_id', requestId)
      fd.set('status', status)
      const result = await updateShiftRequestStatus(fd)
      if (!result?.error) {
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r))
      } else {
        setReqError(result.error)
      }
    })
  }

  function handleReflect(requestId: string) {
    setReqError('')
    startUpdateRequest(async () => {
      const fd = new FormData()
      fd.set('shop_id', shopId)
      fd.set('request_id', requestId)
      const result = await createShiftFromRequest(fd)
      if (result && 'shift' in result && result.shift) {
        onCreated([{
          id: crypto.randomUUID(),
          staff_id: result.shift.staff_id,
          starts_at: result.shift.starts_at,
          ends_at: result.shift.ends_at,
          note: result.shift.note,
        }])
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r))
        setReflected(prev => new Set(prev).add(requestId))
      } else if (result && 'error' in result) {
        setReqError(result.error)
      }
    })
  }

  const requestsForDay = (dateStr: string) => requests.filter(r => r.date === dateStr)

  function toggleDay(dateStr: string) {
    setCheckedDays(prev => {
      const next = new Set(prev)
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr)
      return next
    })
  }

  function addWeekday(dow: number) {
    // dow は 0=日〜6=土 の実際の曜日番号。該当曜日を選択に追加する
    const targets = days.filter(d => d.getDay() === dow).map(toDateStr)
    setCheckedDays(prev => {
      const next = new Set(prev)
      targets.forEach(d => next.add(d))
      return next
    })
  }

  function clearSelection() {
    setCheckedDays(new Set())
  }

  function handleSave() {
    if (checkedDays.size === 0) { setSaveError('日付を選択してください'); return }
    if (!startTime || !endTime) { setSaveError('時刻を入力してください'); return }
    setSaveError('')

    startSave(async () => {
      const created: Shift[] = []
      for (const dateStr of Array.from(checkedDays).sort()) {
        const endDate = endTime <= startTime
          ? (() => { const d = new Date(dateStr); d.setDate(d.getDate() + 1); return toDateStr(d) })()
          : dateStr
        const fd = new FormData()
        fd.set('shop_id', shopId)
        fd.set('staff_id', staff.id)
        fd.set('date', dateStr)
        fd.set('starts_at', startTime)
        fd.set('ends_at', endTime)
        fd.set('break_minutes', breakMins)
        fd.set('note', note)
        const result = await createShift(null, fd)
        if (!result?.error) {
          created.push({
            id: crypto.randomUUID(),
            staff_id: staff.id,
            starts_at: `${dateStr}T${startTime}:00+09:00`,
            ends_at: `${endDate}T${endTime}:00+09:00`,
            note: note || null,
          })
        }
      }
      if (created.length > 0) {
        onCreated(created)
        setCheckedDays(new Set())
      }
    })
  }

  const shiftsForDay = (dateStr: string) => shifts.filter(s => s.starts_at.startsWith(dateStr))

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← 一覧に戻る</button>
        <h2 className="font-bold text-base">{staff.name} のシフト</h2>
      </div>

      {/* ナビ */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onPrev} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">‹ 前</button>
        <button onClick={onToday} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">今日</button>
        <button onClick={onNext} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">次 ›</button>
        <span className="text-sm font-medium text-gray-700">{rangeLabel}</span>
      </div>

      {/* シフト入力フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">シフトを追加</p>

        {/* 時刻 */}
        <div className="flex flex-wrap gap-3">
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
          <div className="space-y-1">
            <label className="text-xs text-gray-500">休憩（分）</label>
            <input type="number" value={breakMins} onChange={e => setBreakMins(e.target.value)} min={0}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="space-y-1 flex-1 min-w-[120px]">
            <label className="text-xs text-gray-500">メモ（任意）</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="例：レジ担当"
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        {/* 曜日プルダウン + 反映 */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">曜日でまとめて</label>
          <select value={bulkDow} onChange={e => setBulkDow(Number(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
            {getWeekdays(weekStart).map((w, i) => {
              const dow = weekStart === 'mon' ? (i + 1) % 7 : i
              return <option key={i} value={dow}>{w}曜</option>
            })}
          </select>
          <button onClick={() => addWeekday(bulkDow)} type="button"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">反映</button>
          {checkedDays.size > 0 && (
            <button onClick={clearSelection} type="button" className="ml-auto text-xs text-gray-400 hover:text-gray-600">クリア</button>
          )}
        </div>

        {/* カレンダー（タップで選択） */}
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {getWeekdays(weekStart).map((w, i) => (
              <div key={i} className="text-center text-[10px] text-gray-400">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: dowIndex(days[0], weekStart) }).map((_, i) => <div key={`blank-${i}`} />)}
            {days.map(day => {
              const dateStr = toDateStr(day)
              const isChecked = checkedDays.has(dateStr)
              const isToday = dateStr === today
              const isSat = day.getDay() === 6, isSun = day.getDay() === 0
              const existing = shiftsForDay(dateStr)
              const hasReq = requestsForDay(dateStr).length > 0
              return (
                <button key={dateStr} type="button" onClick={() => toggleDay(dateStr)}
                  className={`relative aspect-square rounded-md border flex items-center justify-center text-sm transition-colors
                    ${isChecked
                      ? 'border-blue-500 bg-blue-500 text-white font-semibold'
                      : `bg-white hover:border-gray-400 ${isToday ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}`}>
                  <span className={isChecked ? '' : isSat ? 'text-blue-600' : isSun ? 'text-red-600' : 'text-gray-700'}>
                    {day.getDate()}
                  </span>
                  <span className="absolute bottom-1 flex gap-0.5">
                    {existing.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-white' : 'bg-blue-500'}`} />}
                    {hasReq && <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-amber-200' : 'bg-amber-400'}`} />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5"><span className="text-blue-500">●</span> 登録済み　<span className="text-amber-500">●</span> 希望あり</p>
        </div>

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}

        {/* 確定（右下） */}
        <div className="flex items-center justify-end gap-3">
          {checkedDays.size > 0 && <span className="text-xs text-blue-600 mr-auto">{checkedDays.size}日選択中</span>}
          <button onClick={handleSave} disabled={saving || checkedDays.size === 0}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {saving ? '保存中...' : '確定'}
          </button>
        </div>
      </div>

      {/* 希望シフト一覧 */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">希望シフト</p>
          {reqError && <p className="text-xs text-red-500">{reqError}</p>}
          {requests.map(r => {
            const day = new Date(r.date + 'T00:00:00')
            const isSat = day.getDay() === 6, isSun = day.getDay() === 0
            const colIdx = dowIndex(day, weekStart)
            return (
              <div key={r.id} className={`rounded-lg border px-4 py-2 flex items-start gap-3
                ${r.status === 'approved' ? 'bg-green-50 border-green-200' : r.status === 'rejected' ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`text-sm font-medium w-20 shrink-0 ${isSat ? 'text-blue-600' : isSun ? 'text-red-600' : 'text-gray-700'}`}>
                  {getWeekdays(weekStart)[colIdx]} {fmtMD(day)}
                </span>
                <div className="flex-1 text-sm">
                  {r.start_time ? <span className="text-gray-700">{r.start_time.slice(0,5)} 〜 {r.end_time?.slice(0,5)}</span> : <span className="text-gray-400">時間未定</span>}
                  {r.note && <span className="ml-2 text-gray-400 text-xs">{r.note}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'pending' ? (
                    <>
                      <button onClick={() => handleRequestStatus(r.id, 'approved')} disabled={updatingRequest}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">承認</button>
                      <button onClick={() => handleRequestStatus(r.id, 'rejected')} disabled={updatingRequest}
                        className="text-xs px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50">却下</button>
                    </>
                  ) : (
                    <span className={`text-xs font-medium ${r.status === 'approved' ? 'text-green-600' : 'text-gray-400'}`}>
                      {r.status === 'approved' ? '✓ 承認済み' : '✕ 却下'}
                    </span>
                  )}
                  {r.status === 'approved' && r.start_time && !reflected.has(r.id) && (
                    <button onClick={() => handleReflect(r.id)} disabled={updatingRequest}
                      className="text-xs px-2 py-1 border border-blue-400 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50">
                      シフトに反映
                    </button>
                  )}
                  {reflected.has(r.id) && <span className="text-xs text-blue-500">反映済み</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 既存シフト一覧 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">登録済みシフト</p>
        {days.map(day => {
          const dateStr = toDateStr(day)
          const dayShifts = shiftsForDay(dateStr)
          if (dayShifts.length === 0) return null
          const isSat = day.getDay() === 6, isSun = day.getDay() === 0
          const colIdx = dowIndex(day, weekStart)
          return (
            <div key={dateStr} className="bg-white rounded-lg border border-gray-200 px-4 py-2 flex items-start gap-3">
              <span className={`text-sm font-medium w-20 shrink-0 ${isSat ? 'text-blue-600' : isSun ? 'text-red-600' : 'text-gray-700'}`}>
                {getWeekdays(weekStart)[colIdx]} {fmtMD(day)}
              </span>
              <div className="flex flex-col gap-1">
                {dayShifts.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-700">{fmtTime(s.starts_at)} 〜 {fmtTime(s.ends_at)}</span>
                    {s.note && <span className="text-gray-400 text-xs">{s.note}</span>}
                    <button onClick={() => onDelete(s.id)}
                      className="text-gray-300 hover:text-red-500 text-xs ml-1">削除</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
