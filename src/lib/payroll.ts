// 給与計算ロジック
// 労基法第37条: 深夜（22:00〜翌5:00）は25%割増

export type AttendanceRecord = {
  date: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  break_minutes: number
}

export type ShopStaffSetting = {
  hourly_rate: number
  transport_fee: number
  transport_fee_type: 'daily' | 'monthly'
  night_rate_included: boolean
}

export type DailyPayroll = {
  date: string
  work_minutes: number
  regular_minutes: number
  night_minutes: number
  base_pay: number
  night_premium: number
  transport_fee: number
  total: number
}

export type MonthlyPayroll = {
  days: DailyPayroll[]
  work_days: number          // 実出勤日数（同日複数打刻は1日として数える）
  total_work_minutes: number
  total_base_pay: number
  total_night_premium: number
  total_transport_fee: number
  grand_total: number
}

const NIGHT_START = 22 // 22:00
const NIGHT_END = 5   // 05:00 (翌日)
const NIGHT_RATE = 0.25 // 25%割増

function minutesInNight(start: Date, end: Date): number {
  let nightMins = 0
  const ms = end.getTime() - start.getTime()
  const totalMins = ms / 60000

  for (let i = 0; i < totalMins; i++) {
    const t = new Date(start.getTime() + i * 60000)
    const h = t.getHours()
    if (h >= NIGHT_START || h < NIGHT_END) nightMins++
  }
  return nightMins
}

export function calcDailyPayroll(
  record: AttendanceRecord,
  setting: ShopStaffSetting,
): DailyPayroll | null {
  if (!record.clocked_in_at || !record.clocked_out_at) return null

  const inAt = new Date(record.clocked_in_at)
  const outAt = new Date(record.clocked_out_at)
  const totalMins = Math.floor((outAt.getTime() - inAt.getTime()) / 60000) - record.break_minutes
  if (totalMins <= 0) return null

  const nightMins = setting.night_rate_included ? 0 : minutesInNight(inAt, outAt)
  const regularMins = totalMins - nightMins

  const hourlyRate = setting.hourly_rate
  const basePay = Math.floor((hourlyRate / 60) * regularMins)
  const nightPremium = setting.night_rate_included
    ? 0
    : Math.floor((hourlyRate / 60) * nightMins * (1 + NIGHT_RATE))
  const transportFee = setting.transport_fee_type === 'daily' ? setting.transport_fee : 0

  return {
    date: record.date,
    work_minutes: totalMins,
    regular_minutes: regularMins,
    night_minutes: nightMins,
    base_pay: basePay,
    night_premium: nightPremium,
    transport_fee: transportFee,
    total: basePay + nightPremium + transportFee,
  }
}

export function calcMonthlyPayroll(
  records: AttendanceRecord[],
  setting: ShopStaffSetting,
): MonthlyPayroll {
  const days = records
    .map(r => calcDailyPayroll(r, setting))
    .filter((d): d is DailyPayroll => d !== null)

  // 日払い交通費は「日付」単位。同日に複数回打刻があっても1日分のみ計上する
  // （attendances の UNIQUE 制約撤廃で同日複数レコードが発生しうるため二重計上を防止）
  if (setting.transport_fee_type === 'daily') {
    const seen = new Set<string>()
    for (const d of days) {
      if (seen.has(d.date)) {
        d.total -= d.transport_fee
        d.transport_fee = 0
      } else {
        seen.add(d.date)
      }
    }
  }

  const monthlyTransport = setting.transport_fee_type === 'monthly' ? setting.transport_fee : 0
  const workDays = new Set(days.map(d => d.date)).size

  const totalBasePay = days.reduce((s, d) => s + d.base_pay, 0)
  const totalNightPremium = days.reduce((s, d) => s + d.night_premium, 0)
  const totalTransportFee = days.reduce((s, d) => s + d.transport_fee, 0) + monthlyTransport

  return {
    days,
    work_days: workDays,
    total_work_minutes: days.reduce((s, d) => s + d.work_minutes, 0),
    total_base_pay: totalBasePay,
    total_night_premium: totalNightPremium,
    total_transport_fee: totalTransportFee,
    grand_total: totalBasePay + totalNightPremium + totalTransportFee,
  }
}

export function formatMinutes(mins: number): string {
  return `${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, '0')}m`
}

// ── 期間集計（日/週/月） ─────────────────────────────────────
export type PeriodUnit = 'day' | 'week' | 'month'

// dateStr (YYYY-MM-DD) が属する集計バケットのキーと表示ラベルを返す
// week は月曜始まりで、その週の月曜日の日付をキーにする
export function periodBucket(dateStr: string, unit: PeriodUnit): { key: string; label: string } {
  if (unit === 'day') return { key: dateStr, label: dateStr }
  if (unit === 'month') {
    const ym = dateStr.slice(0, 7)
    return { key: ym, label: `${ym.slice(0, 4)}年${ym.slice(5, 7)}月` }
  }
  const d = new Date(`${dateStr}T00:00:00`)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  const monday = d.toLocaleDateString('sv-SE')
  return { key: monday, label: `${monday}の週` }
}

// 雇用保険料（労働者負担分）= 賃金総額 × 料率。円未満切り捨て。
// rate は小数（例: 0.006 = 0.6%）。賃金総額は交通費・カスタム項目を含む支給総額。
export function employmentInsurance(grossTotal: number, rate: number): number {
  if (!rate || rate <= 0) return 0
  return Math.floor(grossTotal * rate)
}

// ── カスタム給与項目 ─────────────────────────────────────────
export type CustomItemType = 'count_unit' | 'fixed' | 'percentage' | 'expense' | 'time_unit'

export type CustomItem = {
  id: string
  name: string
  type: CustomItemType
  unit_price: number | null
}

export type CustomRecord = { item_id: string; value: number }

export const CUSTOM_TYPE_LABEL: Record<CustomItemType, string> = {
  count_unit: '件数×単価',
  fixed: '固定額',
  percentage: '売上×歩合',
  expense: '実費',
  time_unit: '時間×単価',
}

// 「入力値(value)」と項目定義から支給額を算出する
export function customItemAmount(item: Pick<CustomItem, 'type' | 'unit_price'>, value: number): number {
  const up = item.unit_price ?? 0
  switch (item.type) {
    case 'count_unit': return Math.round(value * up)   // 件数 × 単価
    case 'time_unit':  return Math.round(value * up)   // 時間数 × 単価
    case 'percentage': return Math.round(value * up / 100) // 売上 × 率(%)
    case 'fixed':      return Math.round(value)         // value=金額
    case 'expense':    return Math.round(value)         // value=金額
    default:           return 0
  }
}

export type CustomLine = {
  itemId: string
  name: string
  type: CustomItemType
  unitPrice: number | null
  value: number
  amount: number
}

// 店舗の項目定義 × スタッフの月次実績 → 行ごとの金額と合計
export function calcCustomLines(items: CustomItem[], records: CustomRecord[]): { lines: CustomLine[]; total: number } {
  const recMap = new Map(records.map(r => [r.item_id, r.value]))
  const lines: CustomLine[] = items.map(it => {
    const value = recMap.get(it.id) ?? 0
    return { itemId: it.id, name: it.name, type: it.type, unitPrice: it.unit_price, value, amount: customItemAmount(it, value) }
  })
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) }
}
