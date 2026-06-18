'use client'
import { useState, useTransition } from 'react'
import { punchTablet } from './actions'

type Staff = { id: string; name: string }
type Screen = 'list' | 'pin' | 'result'

export function KioskClient({ shopId, shopName, staffList }: {
  shopId: string
  shopName: string
  staffList: Staff[]
}) {
  const [screen, setScreen] = useState<Screen>('list')
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [pin, setPin] = useState('')
  const [result, setResult] = useState<{ type: 'in' | 'out'; name: string } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function selectStaff(staff: Staff) {
    setSelectedStaff(staff)
    setPin('')
    setError('')
    setScreen('pin')
  }

  function appendPin(digit: string) {
    if (pin.length >= 4) return
    setPin(prev => prev + digit)
  }

  function submitPin() {
    if (!selectedStaff || pin.length !== 4) return
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
        }, 3000)
      } else {
        setError(res.error)
        setPin('')
      }
    })
  }

  // スタッフ一覧
  if (screen === 'list') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <header className="px-6 py-5 border-b border-gray-700">
          <p className="text-gray-400 text-sm">打刻</p>
          <h1 className="text-xl font-bold">{shopName}</h1>
        </header>
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
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
        <p className="text-gray-400 text-sm mb-1">PIN入力</p>
        <h2 className="text-2xl font-bold mb-6">{selectedStaff?.name}</h2>

        {/* PIN表示 */}
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
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
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={submitPin}
          disabled={pin.length !== 4 || isPending}
          className="w-56 py-3 bg-white text-gray-900 font-bold rounded-xl disabled:opacity-40 hover:bg-gray-100 transition-colors"
        >
          {isPending ? '確認中...' : '打刻する'}
        </button>

        <button onClick={() => { setScreen('list'); setError(''); setPin('') }}
          className="mt-4 text-gray-500 text-sm hover:text-gray-300">
          ← 戻る
        </button>
      </div>
    )
  }

  // 完了画面
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className={`text-6xl mb-4 ${result?.type === 'in' ? 'text-green-400' : 'text-blue-400'}`}>
        {result?.type === 'in' ? '✓' : '✓'}
      </div>
      <h2 className="text-2xl font-bold mb-2">{result?.name}</h2>
      <p className="text-gray-300 text-lg">
        {result?.type === 'in' ? '出勤しました' : '退勤しました'}
      </p>
      <p className="text-gray-500 text-sm mt-4">3秒後に戻ります...</p>
    </div>
  )
}
