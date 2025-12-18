import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { broker } from '@/lib/events'

function oid(id: string) { try { return new ObjectId(id) } catch { return null } }

// POST /api/admin/applications/[id]/reject -> set status to 'rejected'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const _id = oid(params.id)
    if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
    const body = await req.json().catch(() => ({}))
    const note = typeof body?.note === 'string' ? body.note : undefined

    const col = await getCollection<any>('applications')
    const existing = await col.findOne({ _id })
    if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    const r = await col.updateOne({ _id }, { $set: { status: 'rejected', updatedAt: new Date(), notes: note } })
    if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    // Audit and realtime
    await logAudit({ actorId: auth.id, actorRole: auth.role, action: 'application_reject', targetType: 'application', targetId: String(_id), meta: { from: existing.status, to: 'rejected', note } })
    broker.publish({ type: 'application.status_changed', payload: { id: String(_id), from: existing.status, to: 'rejected' } })

    // Notify applicant
    try {
      const notiCol = await getCollection<any>('notifications')
      await (notiCol as any).insertOne({
        userId: existing.userId,
        type: 'application',
        title: 'Application rejected',
        message: 'Your application has been rejected by admin.',
        url: `/dashboard/applications?open=${String(_id)}`,
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
