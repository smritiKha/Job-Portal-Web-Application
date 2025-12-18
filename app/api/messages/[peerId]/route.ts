import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { packMessage } from '@/lib/messages'
import { decryptText } from '@/lib/crypto'
import { broker } from '@/lib/events'

// Ensure this route is treated as dynamic and runs on Node.js
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

interface MessageDoc {
  _id?: ObjectId
  conversationId?: ObjectId | null
  senderId: ObjectId
  recipientId: ObjectId
  ciphertext: string
  iv: string
  tag: string
  createdAt: Date
  readAt?: Date | null
}

// GET /api/messages/[peerId]?limit=50&before=<iso>
export async function GET(req: NextRequest, ctx: { params: Promise<{ peerId: string }> | { peerId: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const me = new ObjectId(auth.id)
    const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ peerId: string }>) : (ctx.params as { peerId: string })
    const peer = oid(p.peerId)
    if (!peer) return NextResponse.json({ ok: false, error: 'invalid peer id' }, { status: 400 })

    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)))
    const beforeStr = url.searchParams.get('before')
    const before = beforeStr ? new Date(beforeStr) : null

    const col = await getCollection<MessageDoc>('messages')
    const query: any = {
      $or: [ { senderId: me, recipientId: peer }, { senderId: peer, recipientId: me } ]
    }
    if (before && !isNaN(before.getTime())) {
      query.createdAt = { $lt: before }
    }

    const docs = await (col as any).find(query).sort({ createdAt: -1 }).limit(limit).toArray()
    const items = docs.reverse().map((d: any) => ({
      id: String(d._id),
      senderId: String(d.senderId),
      recipientId: String(d.recipientId),
      content: safeDecrypt(d.ciphertext, d.iv, d.tag),
      createdAt: d.createdAt,
      readAt: d.readAt || null,
    }))

    return NextResponse.json({ ok: true, messages: items })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// POST /api/messages/[peerId] { content: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ peerId: string }> | { peerId: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const me = new ObjectId(auth.id)
    const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ peerId: string }>) : (ctx.params as { peerId: string })
    const peer = oid(p.peerId)
    if (!peer) return NextResponse.json({ ok: false, error: 'invalid peer id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const content = String(body?.content || '').trim()
    if (!content) return NextResponse.json({ ok: false, error: 'content required' }, { status: 400 })

    const { ciphertext, iv, tag } = packMessage(content)

    const col = await getCollection<MessageDoc>('messages')
    const now = new Date()
    const doc: MessageDoc = {
      senderId: me,
      recipientId: peer,
      ciphertext, iv, tag,
      createdAt: now,
      readAt: null,
    }
    const r = await (col as any).insertOne(doc)

    // Create a notification for recipient
    try {
      const notifications = await getCollection<any>('notifications')
      await (notifications as any).insertOne({
        userId: peer,
        type: 'message',
        title: 'New message',
        message: content.slice(0, 140),
        url: `/messages?open=${String(me)}`,
        icon: null,
        read: false,
        createdAt: now,
        updatedAt: now,
      })
    } catch {}

    // Realtime events
    try {
      broker.publish({ type: 'message.created', payload: { senderId: String(me), recipientId: String(peer) }, toUserId: String(peer) })
      broker.publish({ type: 'message.created', payload: { senderId: String(me), recipientId: String(peer) }, toUserId: String(me) })
    } catch {}

    return NextResponse.json({ ok: true, id: String(r.insertedId) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// PATCH /api/messages/[peerId] -> mark all from peer to me as read
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ peerId: string }> | { peerId: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const me = new ObjectId(auth.id)
    const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ peerId: string }>) : (ctx.params as { peerId: string })
    const peer = oid(p.peerId)
    if (!peer) return NextResponse.json({ ok: false, error: 'invalid peer id' }, { status: 400 })

    const col = await getCollection<MessageDoc>('messages')
    const r = await (col as any).updateMany({ senderId: peer, recipientId: me, readAt: null }, { $set: { readAt: new Date() } })

    try { broker.publish({ type: 'message.read', payload: { readerId: String(me), peerId: String(peer) }, toUserId: String(peer) }) } catch {}

    return NextResponse.json({ ok: true, modified: r.modifiedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

function safeDecrypt(ciphertext: string, iv: string, tag: string) {
  try { return decryptText(ciphertext, iv, tag) } catch { return '[unreadable]' }
}
