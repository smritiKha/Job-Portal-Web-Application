import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

// POST /api/messages/typing { recipientId: string, typing: boolean }
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const recipientId = body?.recipientId ? String(body.recipientId) : ''
    const typing = Boolean(body?.typing)
    try { new ObjectId(recipientId) } catch { return NextResponse.json({ ok: false, error: 'invalid recipientId' }, { status: 400 }) }

    const payload = { senderId: String(auth.id), recipientId, typing }
    broker.publish({ type: 'message.typing', payload, toUserId: recipientId })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
