import crypto from 'crypto'

// Key must be 32 bytes (256-bit) base64 in env MESSAGE_ENC_KEY
function getKey(): Buffer {
  const b64 = process.env.MESSAGE_ENC_KEY
  if (!b64) throw new Error('Missing MESSAGE_ENC_KEY')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error('MESSAGE_ENC_KEY must be 32 bytes base64 (256-bit)')
  return key
}

export function encryptText(plaintext: string) {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64')
  }
}

export function decryptText(ciphertextB64: string, ivB64: string, tagB64: string): string {
  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return dec.toString('utf8')
}

// Binary helpers for attachments
export function encryptBytes(data: Uint8Array | Buffer) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: enc, // Buffer
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
  }
}

export function decryptBytes(ciphertext: Uint8Array | Buffer, ivB64: string, tagB64: string): Buffer {
  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()])
  return dec
}
