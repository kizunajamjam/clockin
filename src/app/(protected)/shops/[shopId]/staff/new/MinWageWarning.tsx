'use client'
import { useState } from 'react'
import { MIN_WAGES } from '@/lib/minWage'

export function MinWageWarning({ shopPrefecture }: { shopPrefecture: string | null }) {
  const [hourlyRate, setHourlyRate] = useState('')

  const minWage = shopPrefecture ? (MIN_WAGES[shopPrefecture] ?? null) : null
  const rate = parseInt(hourlyRate, 10)
  const isBelowMin = minWage !== null && !isNaN(rate) && rate < minWage

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        時給（円）<span className="text-red-500">*</span>
        {minWage && shopPrefecture && (
          <span className="text-xs font-normal text-gray-400 ml-2">
            {shopPrefecture}最低賃金: ¥{minWage.toLocaleString()}
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
        placeholder="例：1100"
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
          isBelowMin
            ? 'border-red-400 focus:ring-red-400'
            : 'border-gray-300 focus:ring-gray-900'
        }`}
      />
      {isBelowMin && (
        <p className="text-xs text-red-600 mt-1">
          ⚠️ 設定時給（¥{rate}）が{shopPrefecture}の最低賃金（¥{minWage}）を下回っています
        </p>
      )}
    </div>
  )
}
