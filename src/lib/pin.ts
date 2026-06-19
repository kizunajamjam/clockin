// Edge Runtime 対応の PIN ハッシュ（Web Crypto API / PBKDF2）
// salt には staff.id（UUID）を使用して、同じPINでも異なるハッシュ値になる
//
// 保存形式（前方互換）:
//   - 新形式: `v2$<iterations>$<hexハッシュ>`
//   - 旧形式: `<hexハッシュ>`（'$'を含まない。反復10000回固定の v1 とみなす）
// verifyPin は両形式を検証でき、needsRehash() が true のとき打刻成功時に再ハッシュして昇格する。

const PBKDF2_ITERATIONS = 100000   // 新規ハッシュの反復回数
const LEGACY_ITERATIONS = 10000    // 旧形式（v1）の反復回数

async function deriveHex(pin: string, salt: string, iterations: number): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// 定数時間で文字列を比較（タイミング攻撃対策）
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function parseStored(stored: string): { iterations: number; hex: string } {
  if (stored.startsWith('v2$')) {
    const [, iterStr, hex] = stored.split('$')
    return { iterations: parseInt(iterStr, 10), hex }
  }
  return { iterations: LEGACY_ITERATIONS, hex: stored }
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const hex = await deriveHex(pin, salt, PBKDF2_ITERATIONS)
  return `v2$${PBKDF2_ITERATIONS}$${hex}`
}

export async function verifyPin(pin: string, salt: string, stored: string): Promise<boolean> {
  const { iterations, hex } = parseStored(stored)
  const computed = await deriveHex(pin, salt, iterations)
  return timingSafeEqual(computed, hex)
}

// 保存形式が旧式 or 反復回数が現行より少なければ true（成功時に再ハッシュして昇格する）
export function needsRehash(stored: string): boolean {
  return parseStored(stored).iterations < PBKDF2_ITERATIONS
}
