'use client'
import { useState, useTransition, useEffect } from 'react'
import { punchTablet, getAttendanceStatus, openDrinkCounter, incrementDrinkCount, decrementDrinkCount } from './actions'

type Staff = { id: string; name: string }
type DrinkItem = { id: string; name: string }
type Mode = 'punch' | 'drink'
type Screen = 'list' | 'pin' | 'result' | 'drinkCounter'
type PunchType = 'in' | 'out' | null

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export function KioskClient({ shopId, shopName, staffList, drinkItems }: {
  shopId: string
  shopName: string
  staffList: Staff[]
  drinkItems: DrinkItem[]
}) {
  const [mode, setMode] = useState<Mode>('punch')
  const [screen, setScreen] = useState<Screen>('list')
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [punchType, setPunchType] = useState<PunchType>(null)
  const [result, setResult] = useState<{ type: 'in' | 'out'; name: string } | null>(null)
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const time = useClock()

  function changeMode(m: Mode) {
    setMode(m)
    setScreen('list')
    setSelectedStaff(null)
    setPin('')
    setError('')
  }

  function selectStaff(staff: Staff) {
    setSelectedStaff(staff)
    setPin('')
    setError('')
    setPunchType(null)

    if (mode === 'drink') {
      startTransition(async () => {
        const res = await openDrinkCounter(staff.id, shopId)
        if (res.success) {
          setDrinkCounts(res.counts)
          setScreen('drinkCounter')
        } else {
          setError(res.error)
        }
      })
      return
    }

    setScreen('pin')
    startTransition(async () => {
      const status = await getAttendanceStatus(staff.id, shopId)
      setPunchType(status)
    })
  }

  function appendPin(digit: string) {
    if (pin.length >= 6) return
    setPin(prev => prev + digit)
  }

  function submitPin() {
    if (!selectedStaff || pin.length < 4 || pin.length > 6) return
    const fd = new FormData()
    fd.set('staff_id', selectedStaff.id)
    fd.set('shop_id', shopId)
    fd.set('pin', pin)

    startTransition(async () => {
      const res = await punchTablet(fd)
      if (res.success) {
        setResult({ type: res.type, name: res.staffName })
        setScreen('result')
        setTimeout(() => {
          setScreen('list')
          setResult(null)
          setPin('')
          setSelectedStaff(null)
          setPunchType(null)
        }, 3000)
      } else {
        setError(res.error)
        setPin('')
      }
    })
  }

  function adjustDrink(itemId: string, delta: number) {
    if (!selectedStaff) return
    const fd = new FormData()
    fd.set('staff_id', selectedStaff.id)
    fd.set('shop_id', shopId)
    fd.set('item_id', itemId)
    setError('')
    startTransition(async () => {
      const res = delta > 0 ? await incrementDrinkCount(fd) : await decrementDrinkCount(fd)
      if (res.success) setDrinkCounts(prev => ({ ...prev, [res.itemId]: res.count }))
      else setError(res.error)
    })
  }

  function finishDrinkCounter() {
    setScreen('list')
    setSelectedStaff(null)
    setDrinkCounts({})
  }

  // スタッフ一覧
  if (screen === 'list') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <header className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{mode === 'punch' ? '打刻' : 'ドリンクバックカウント'}</p>
            <h1 className="text-xl font-bold">{shopName}</h1>
          </div>
          <p className="text-2xl font-mono tabular-nums text-gray-300">{time}</p>
        </header>
        <div className="flex border-b border-gray-700">
          {([['punch', '打刻'], ['drink', 'ドリンクバック']] as [Mode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => changeMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === m ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <main className="flex-1 p-4">
          <p className="text-center text-gray-400 text-sm mb-4">名前をタップしてください</p>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            {staffList.map(staff => (
              <button
                key={staff.id}
                onClick={() => selectStaff(staff)}
                className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl py-6 text-center font-medium text-lg transition-colors"
              >
                {staff.name}
              </button>
            ))}
          </div>
          {staffList.length === 0 && (
            <p className="text-center text-gray-500 mt-8">スタッフが登録されていません</p>
          )}
        </main>
      </div>
    )
  }

  // PIN入力
  if (screen === 'pin') {
    const punchLabel = punchType === 'in' ? '出勤打刻' : punchType === 'out' ? '退勤打刻' : '確認中...'
    const punchColor = punchType === 'in' ? 'text-green-400' : punchType === 'out' ? 'text-blue-400' : 'text-gray-400'

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        {/* 現在時刻 */}
        <p className="text-4xl font-mono tabular-nums text-gray-200 mb-1">{time}</p>

        {/* 打刻種別バッジ */}
        <p className={`text-lg font-bold mb-4 ${punchColor}`}>{punchLabel}</p>

        <p className="text-gray-400 text-sm mb-1">PIN入力</p>
        <h2 className="text-2xl font-bold mb-6">{selectedStaff?.name}</h2>

        {/* PIN表示（4〜6桁。最低4マス、入力に応じて最大6マスまで増える） */}
        <div className="flex gap-3 mb-4">
          {Array.from({ length: Math.min(6, Math.max(4, pin.length)) }).map((_, i) => (
            <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
              pin.length > i ? 'border-white bg-white text-gray-900' : 'border-gray-600'
            }`}>
              {pin.length > i ? '●' : ''}
            </div>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {/* テンキー */}
        <div className="grid grid-cols-3 gap-3 w-56 mb-4">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            <button
              key={i}
              disabled={key === '' || isPending}
              onClick={() => key === '⌫' ? setPin(p => p.slice(0, -1)) : appendPin(key)}
              className={`h-14 rounded-xl text-xl font-medium transition-colors ${
                key === '' ? '' :
                key === '⌫' ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500' :
                'bg-gray-800 hover:bg-gray-700 active:bg-gray-600'
              } disabled:opacity-40`}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={submitPin}
          disabled={pin.length < 4 || pin.length > 6 || isPending}
          className="w-56 py-3 bg-white text-gray-900 font-bold rounded-xl disabled:opacity-40 hover:bg-gray-100 transition-colors"
        >
          {isPending ? '確認中...' : punchType === 'in' ? '出勤する' : '退勤する'}
        </button>

        <button onClick={() => { setScreen('list'); setError(''); setPin(''); setPunchType(null) }}
          className="mt-4 text-gray-500 text-sm hover:text-gray-300">
          ← 戻る
        </button>
      </div>
    )
  }

  // ドリンクバックカウンター
  if (screen === 'drinkCounter') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <p className="text-gray-400 text-sm mb-1">ドリンクバック・本日のカウント</p>
        <h2 className="text-2xl font-bold mb-4">{selectedStaff?.name}</h2>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {drinkItems.length === 0 ? (
          <p className="text-gray-400 text-sm mb-8">ジャンルが登録されていません。オーナーに設定を依頼してください</p>
        ) : (
          <div className="w-full max-w-xs space-y-4 mb-8">
            {drinkItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm text-gray-300">{item.name}</p>
                  <p className="text-3xl font-mono font-bold tabular-nums">{drinkCounts[item.id] ?? 0}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => adjustDrink(item.id, -1)} disabled={isPending || (drinkCounts[item.id] ?? 0) === 0}
                    className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-xl font-bold disabled:opacity-40 transition-colors">
                    −1
                  </button>
                  <button onClick={() => adjustDrink(item.id, 1)} disabled={isPending}
                    className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-xl font-bold text-gray-900 disabled:opacity-40 transition-colors">
                    +1
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={finishDrinkCounter}
          className="w-56 py-3 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors">
          完了
        </button>
      </div>
    )
  }

  // 完了画面
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className={`text-6xl mb-4 ${result?.type === 'in' ? 'text-green-400' : 'text-blue-400'}`}>✓</div>
      <h2 className="text-2xl font-bold mb-2">{result?.name}</h2>
      <p className="text-gray-300 text-lg">{result?.type === 'in' ? '出勤しました' : '退勤しました'}</p>
      <p className="text-3xl font-mono tabular-nums text-gray-300 mt-3">{time}</p>
      <p className="text-gray-500 text-sm mt-4">3秒後に戻ります...</p>
    </div>
  )
}
