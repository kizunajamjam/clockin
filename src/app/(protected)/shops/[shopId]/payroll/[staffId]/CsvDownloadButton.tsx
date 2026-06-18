'use client'
import type { MonthlyPayroll } from '@/lib/payroll'

export function CsvDownloadButton({
  payroll, staffName, ym,
}: {
  payroll: MonthlyPayroll
  staffName: string
  ym: string
}) {
  function download() {
    const rows = [
      ['日付', '勤務時間(分)', '基本給', '深夜割増', '交通費', '合計'],
      ...payroll.days.map(d => [
        d.date,
        d.work_minutes,
        d.base_pay,
        d.night_premium,
        d.transport_fee,
        d.total,
      ]),
      ['合計', payroll.total_work_minutes, payroll.total_base_pay, payroll.total_night_premium, payroll.total_transport_fee, payroll.grand_total],
    ]

    const csv = rows.map(r => r.join(',')).join('\n')
    const bom = '﻿'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${staffName}_${ym}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={download}
      className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
      CSVダウンロード
    </button>
  )
}
