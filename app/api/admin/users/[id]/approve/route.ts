import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { broker } from '@/lib/events'

function oid(id: string) { try { return new ObjectId(id) } catch { return null } }

// POST /api/admin/users/[id]/approve -> set status to 'active'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const _id = oid(params.id)
    if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
    const users = await getCollection<any>('users')
    const existing = await users.findOne({ _id })
    if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    const r = await users.updateOne({ _id }, { $set: { status: 'active', updatedAt: new Date() } })
    if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    await logAudit({ actorId: auth.id, actorRole: auth.role, action: 'user_approve', targetType: 'user', targetId: String(_id) })
    broker.publish({ type: 'user.updated', payload: { id: String(_id), fields: ['status'] }, toUserId: String(_id) })
    broker.publish({ type: 'user.updated', payload: { id: String(_id), fields: ['status'] }, toRole: 'admin' })

    // Notify the user
    try {
      const notiCol = await getCollection<any>('notifications')
      await (notiCol as any).insertOne({
        userId: _id,
        type: 'account',
        title: 'Account approved',
        message: 'Your account has been approved by an admin. You can now sign in.',
        url: '/login',
        icon: null,
        read: false,
        createdAt: new Date(),
      })
    } catch {}

    return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
