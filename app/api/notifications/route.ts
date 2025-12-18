import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

// POST /api/notifications - admin-only create (internal)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const auth = await getAuthUser(req).catch(() => null)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
    // Optionally store a notification for a target user
    const userId = body?.userId ? new ObjectId(String(body.userId)) : null
    if (userId) {
      const col = await getCollection<any>('notifications')
      await (col as any).insertOne({
        userId,
        type: body?.type || 'info',
        title: body?.title || 'Notification',
        message: body?.message || '',
        icon: body?.icon || null,
        read: false,
        createdAt: new Date(),
      })
    }
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'notification_event',
      targetType: body?.type || 'notification',
      targetId: body?.applicationId ? String(body.applicationId) : undefined,
      meta: body || {},
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 400 })
  }
}

// GET /api/notifications - list current user's notifications
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) {
      // Return empty notifications for unauthenticated clients to avoid noisy 401s in polling UIs
      return NextResponse.json({ ok: true, notifications: [], unread: 0 }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const col = await getCollection<any>('notifications')
    const items = await (col as any)
      .find({ userId: new ObjectId(auth.id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
    const unread = items.filter((n: any) => !n.read).length
    return NextResponse.json({ ok: true, notifications: items.map((n: any) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      createdAt: n.createdAt,
      read: !!n.read,
      icon: n.icon || null,
      url: n.url || null,
    })), unread }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 400 })
  }
}

// PATCH /api/notifications - mark all as read for current user
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const col = await getCollection<any>('notifications')
    await (col as any).updateMany({ userId: new ObjectId(auth.id), read: { $ne: true } }, { $set: { read: true, updatedAt: new Date() } })
    await logAudit({ actorId: auth.id, actorRole: auth.role, action: 'notifications_mark_all_read', targetType: 'user', targetId: auth.id })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 400 })
  }
}
