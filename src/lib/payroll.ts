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

  const monthlyTransport = setting.transport_fee_type === 'monthly' ? setting.transport_fee : 0

  const totalBasePay = days.reduce((s, d) => s + d.base_pay, 0)
  const totalNightPremium = days.reduce((s, d) => s + d.night_premium, 0)
  const totalTransportFee = days.reduce((s, d) => s + d.transport_fee, 0) + monthlyTransport

  return {
    days,
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
