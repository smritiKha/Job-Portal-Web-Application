import { ObjectId } from 'mongodb'
import { encryptText, decryptText } from '@/lib/crypto'

export type Conversation = {
  _id: ObjectId
  participantIds: ObjectId[] // exactly 2 users: employer and job_seeker (admin could be extended later)
  jobId?: ObjectId | null
  // denormalized preview for quick listing
  lastMessageAt?: Date
  lastMessagePreview?: string
  lastSenderId?: ObjectId
  unreadCountByUser?: Record<string, number> // { userId: count }
  createdAt: Date
  updatedAt: Date
}

export type MessageRecord = {
  _id: ObjectId
  conversationId: ObjectId
  senderId: ObjectId
  recipientId: ObjectId
  // encrypted payload
  ciphertext: string
  iv: string
  tag: string
  // optional attachments in future
  createdAt: Date
  readAt?: Date | null
}

export function packMessage(plaintext: string) {
  const { ciphertext, iv, tag } = encryptText(plaintext)
  return { ciphertext, iv, tag }
}

export function unpackMessage(m: Pick<MessageRecord, 'ciphertext' | 'iv' | 'tag'>): string {
  return decryptText(m.ciphertext, m.iv, m.tag)
}

export function sanitizePreview(text: string, limit = 120) {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > limit ? t.slice(0, limit - 1) + '…' : t
}
