'use client'

export function CsvExportButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function download() {
    const csv = rows.map(r => r.join(',')).join('\n')
    const bom = '﻿'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={download} type="button"
      className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
      CSVダウンロード
    </button>
  )
}
