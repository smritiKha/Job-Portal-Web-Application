import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { broker } from '@/lib/events'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

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
    const col = await getCollection('jobs')
    const update = {
      $set: { 
        status: 'open',
        approvalStatus: 'approved',
        moderatedAt: new Date(), 
        moderatedBy: new ObjectId(auth.id), 
        moderationNote: note, 
        updatedAt: new Date() 
      }
    }
    const r = await col.updateOne({ _id }, update)
    if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'job_approve',
      targetType: 'job',
      targetId: String(_id),
      meta: { note }
    })
    // Emit realtime update for job
    broker.publish({ type: 'job.updated', payload: { id: String(_id), fields: ['status','moderatedAt','moderatedBy','moderationNote','updatedAt'] } })
    return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
