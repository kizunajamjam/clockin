'use client'
import { useState } from 'react'
import { MIN_WAGES, PREFECTURES } from '@/lib/minWage'

export function MinWageWarning({ shopPrefecture }: { shopPrefecture: string | null }) {
  const [prefecture, setPrefecture] = useState(shopPrefecture ?? '')
  const [hourlyRate, setHourlyRate] = useState('')

  const minWage = MIN_WAGES[prefecture] ?? null
  const rate = parseInt(hourlyRate, 10)
  const isBelowMin = minWage !== null && !isNaN(rate) && rate < minWage

  return (
    <div className="space-y-3">
      {!shopPrefecture && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
          <select
            value={prefecture}
            onChange={e => setPrefecture(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          時給（円）
          {minWage && (
            <span className="text-xs font-normal text-gray-400 ml-2">
              {prefecture}最低賃金: ¥{minWage.toLocaleString()}
            </span>
          )}
        </label>
        <input
          type="number"
          name="hourly_rate"
          required
          min={0}
          value={hourlyRate}
          onChange={e => setHourlyRate(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            isBelowMin
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:ring-gray-900'
          }`}
        />
        {isBelowMin && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ 設定時給（¥{rate}）が{prefecture}の最低賃金（¥{minWage}）を下回っています
          </p>
        )}
      </div>
    </div>
  )
}
