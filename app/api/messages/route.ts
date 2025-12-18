import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { encryptText, decryptText } from '@/lib/crypto'
import { broker } from '@/lib/events'

interface MessageDoc {
  _id?: ObjectId
  senderId: ObjectId
  recipientId: ObjectId
  ciphertext: string
  iv: string
  tag: string
  createdAt: Date
  readAt?: Date | null
  attachment?: {
    url: string
    name?: string
    mime?: string
    size?: number
    iv: string
    tag: string
    encrypted: boolean
    clientEncrypted?: boolean
    wrapAlg?: string
    wrappedKeyB64?: string
    cipherAlg?: string
  }
}

// GET /api/messages?peerId=<id>&limit=&before=
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const peerId = searchParams.get('peerId')
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const before = searchParams.get('before')

    if (!peerId) return NextResponse.json({ ok: false, error: 'peerId is required' }, { status: 400 })
    let peer: ObjectId
    try { peer = new ObjectId(peerId) } catch { return NextResponse.json({ ok: false, error: 'invalid peerId' }, { status: 400 }) }

    const me = new ObjectId(auth.id)
    const col = await getCollection<MessageDoc>('messages')

    const query: any = {
      $or: [
        { senderId: me, recipientId: peer },
        { senderId: peer, recipientId: me },
      ]
    }
    if (before) {
      try {
        query.createdAt = { $lt: new Date(before) }
      } catch {}
    }

    const docs = await col.find(query).sort({ createdAt: -1 }).limit(limit).toArray()
    const messages = docs.map((d) => ({
      id: String(d._id),
      senderId: String(d.senderId),
      recipientId: String(d.recipientId),
      content: safeDecrypt(d.ciphertext, d.iv, d.tag),
      createdAt: d.createdAt,
      readAt: d.readAt || null,
      attachment: d.attachment ? {
        name: d.attachment.name || '',
        size: d.attachment.size || 0,
        mime: d.attachment.mime || '',
        clientEncrypted: Boolean(d.attachment.clientEncrypted),
        wrapAlg: d.attachment.wrapAlg || undefined,
        wrappedKeyB64: d.attachment.wrappedKeyB64 || undefined,
        cipherAlg: d.attachment.cipherAlg || undefined,
        iv: d.attachment.iv || undefined,
      } : undefined,
    })).reverse()

    // Mark as read for messages where I'm the recipient
    const toMark = docs.filter(d => String(d.recipientId) === auth.id && !d.readAt)
    if (toMark.length) {
      const now = new Date()
      await col.updateMany({ _id: { $in: toMark.map(d => d._id!) } }, { $set: { readAt: now } })
      // Publish read events to original senders
      for (const m of toMark) {
        broker.publish({ type: 'message.read', payload: { id: String(m._id), senderId: String(m.senderId), recipientId: String(m.recipientId), readAt: now }, toUserId: String(m.senderId) })
      }
    }

    return NextResponse.json({ ok: true, messages })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// POST /api/messages { recipientId, content }
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body?.recipientId || (!body?.content && !body?.attachment)) {
      return NextResponse.json({ ok: false, error: 'recipientId and content or attachment required' }, { status: 400 })
    }
    let recipient: ObjectId
    try { recipient = new ObjectId(String(body.recipientId)) } catch { return NextResponse.json({ ok: false, error: 'invalid recipientId' }, { status: 400 }) }

    // role enforcement: only job_seekers and employers can chat with each other
    try {
      const usersCol = await getCollection<any>('users')
      const recUser = await usersCol.findOne({ _id: recipient }, { projection: { role: 1 } })
      const senderRole = auth.role
      const recipientRole = recUser?.role
      const allowed = (senderRole === 'job_seeker' && recipientRole === 'employer') || (senderRole === 'employer' && recipientRole === 'job_seeker')
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Messaging is restricted to job seekers and employers only.' }, { status: 403 })
      }
    } catch {}

    const enc = encryptText(String(body.content || ''))
    const doc: MessageDoc = {
      senderId: new ObjectId(auth.id),
      recipientId: recipient,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      tag: enc.tag,
      createdAt: new Date(),
      readAt: null,
      attachment: body.attachment && body.attachment.url && body.attachment.iv ? {
        url: String(body.attachment.url),
        name: body.attachment.name ? String(body.attachment.name) : undefined,
        mime: body.attachment.mime ? String(body.attachment.mime) : undefined,
        size: typeof body.attachment.size === 'number' ? body.attachment.size : undefined,
        iv: String(body.attachment.iv),
        tag: body.attachment.tag ? String(body.attachment.tag) : '',
        encrypted: true,
        clientEncrypted: Boolean(body.attachment.clientEncrypted),
        wrapAlg: body.attachment.wrapAlg ? String(body.attachment.wrapAlg) : undefined,
        wrappedKeyB64: body.attachment.wrappedKeyB64 ? String(body.attachment.wrappedKeyB64) : undefined,
        cipherAlg: body.attachment.cipherAlg ? String(body.attachment.cipherAlg) : undefined,
      } : undefined,
    }

    const col = await getCollection<MessageDoc>('messages')
    const r = await col.insertOne(doc as any)

    // If client provided an attachmentId, link it to this message for auditing/management
    if (body?.attachment?.attachmentId) {
      try {
        const attachments = await getCollection<any>('attachments')
        await attachments.updateOne(
          { _id: new ObjectId(String(body.attachment.attachmentId)), ownerId: String(auth.id) },
          { $set: { messageId: String(r.insertedId) } }
        )
      } catch {}
    }

    // Realtime notifications to recipient and sender
    const payload = { id: String(r.insertedId), senderId: String(doc.senderId), recipientId: String(doc.recipientId) }
    broker.publish({ type: 'message.created', payload, toUserId: String(doc.recipientId) })
    broker.publish({ type: 'message.created', payload, toUserId: String(doc.senderId) })

    // Create notification for recipient
    try {
      const notiCol = await getCollection<any>('notifications')
      const note = {
        userId: recipient,
        type: 'message',
        title: 'New message',
        message: 'You have a new message',
        url: '/messages',
        icon: 'message',
        read: false,
        createdAt: new Date(),
      }
      await notiCol.insertOne(note)
      broker.publish({ type: 'notification.created', payload: { type: 'message' }, toUserId: String(recipient) })
    } catch {}

    return NextResponse.json({ ok: true, id: String(r.insertedId) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

function safeDecrypt(ciphertext: string, iv: string, tag: string) {
  try {
    return decryptText(ciphertext, iv, tag)
  } catch {
    return '[unreadable]'
  }
}
