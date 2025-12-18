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

    const col = await getCollection('jobs')
    const r = await col.updateOne(
      { _id },
      { $set: { featured: true, updatedAt: new Date() } }
    )
    if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'job_featured',
      targetType: 'job',
      targetId: String(_id),
      meta: {}
    })
    broker.publish({ type: 'job.updated', payload: { id: String(_id), fields: ['featured','updatedAt'] } })

    return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
