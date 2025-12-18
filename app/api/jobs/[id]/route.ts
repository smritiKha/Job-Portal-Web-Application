import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

interface JobDoc {
  _id?: ObjectId
  title: string
  description?: string
  companyId?: ObjectId
  location?: string
  salaryMin?: number
  salaryMax?: number
  status?: 'open' | 'closed'
  createdAt?: Date
}

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// GET /api/jobs/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<JobDoc>('jobs')
  const items = await (col as any).aggregate([
    { $match: { _id } },
    {
      $lookup: {
        from: 'users',
        localField: 'moderatedBy',
        foreignField: '_id',
        as: 'moderator',
      },
    },
    { $unwind: { path: '$moderator', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        moderatedByUser: {
          _id: '$moderator._id',
          name: '$moderator.name',
          email: '$moderator.email',
        },
      },
    },
    { $project: { moderator: 0 } },
  ]).toArray()
  const job = items[0]
  if (!job) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, job })
}

// PUT /api/jobs/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  // Verify ownership unless admin
  const col = await getCollection<JobDoc>('jobs')
  const existing = await col.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  if (auth.role !== 'admin' && (existing as any).createdBy && String((existing as any).createdBy) !== auth.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const update: any = {}
  if (typeof body.title === 'string') update.title = body.title
  if (typeof body.description === 'string') update.description = body.description
  if (typeof body.location === 'string') update.location = body.location
  if (typeof body.salaryMin === 'number') update.salaryMin = body.salaryMin
  if (typeof body.salaryMax === 'number') update.salaryMax = body.salaryMax
  if (body.companyId) {
    const cid = oid(body.companyId)
    if (cid) update.companyId = cid
  }
  if (body.status === 'open' || body.status === 'closed') update.status = body.status
  if (Array.isArray(body.skills)) {
    const skills = (body.skills as any[])
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 20)
    update.skills = skills
  }
  // Normalize screening questions updates
  if (Array.isArray((body as any).screeningQuestions)) {
    const arr = ((body as any).screeningQuestions as any[])
      .map((q) => String(q || '').trim())
      .filter(Boolean)
      .slice(0, 10)
    update.screeningQuestions = arr
  } else if (typeof (body as any).questions === 'string') {
    const arr = String((body as any).questions)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)
    update.screeningQuestions = arr
  }
  update.updatedAt = new Date()
  if (!Object.keys(update).length) return NextResponse.json({ ok: false, error: 'no valid fields' }, { status: 400 })
  const r = await col.updateOne({ _id }, { $set: update })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  // Emit job updated event (include minimal info to keep payload small)
  const fields = Object.keys(update)
  const payload = { id: String(_id), fields }
  // Notify job seekers (for listing changes), admin (oversight), and the job owner
  broker.publish({ type: 'job.updated', payload, toRole: 'job_seeker' })
  broker.publish({ type: 'job.updated', payload, toRole: 'admin' })
  if ((existing as any)?.createdBy) broker.publish({ type: 'job.updated', payload, toUserId: String((existing as any).createdBy) })
  return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
}

// DELETE /api/jobs/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const col = await getCollection<JobDoc>('jobs')
  const existing = await col.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  if (auth.role !== 'admin' && (existing as any).createdBy && String((existing as any).createdBy) !== auth.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const r = await col.deleteOne({ _id })
  if (!r.deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  const delPayload = { id: String(_id) }
  broker.publish({ type: 'job.deleted', payload: delPayload, toRole: 'job_seeker' })
  broker.publish({ type: 'job.deleted', payload: delPayload, toRole: 'admin' })
  if ((existing as any)?.createdBy) broker.publish({ type: 'job.deleted', payload: delPayload, toUserId: String((existing as any).createdBy) })
  return NextResponse.json({ ok: true, deletedCount: r.deletedCount })
}
