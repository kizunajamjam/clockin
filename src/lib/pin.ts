// Edge Runtime 対応の PIN ハッシュ（Web Crypto API / PBKDF2）
// salt には staff.id（UUID）を使用して、同じPINでも異なるハッシュ値になる

export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin, salt)
  return computed === hash
}
