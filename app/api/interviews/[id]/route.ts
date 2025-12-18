import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

interface InterviewDoc {
  _id?: ObjectId
  applicationId: ObjectId
  interviewer?: string
  scheduledAt: Date
  mode?: 'onsite' | 'remote'
  notes?: string
  status?: 'scheduled' | 'completed'
  createdAt?: Date
  updatedAt?: Date
}

// GET /api/interviews/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<InterviewDoc>('interviews')
  const doc = await col.findOne({ _id })
  if (!doc) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, interview: doc })
}

// PUT /api/interviews/[id] -> update interview (employer who owns the job or admin)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const update: any = { updatedAt: new Date() }
  if (typeof body.interviewer === 'string') update.interviewer = body.interviewer
  if (typeof body.mode === 'string' && (body.mode === 'onsite' || body.mode === 'remote')) update.mode = body.mode
  if (typeof body.notes === 'string') update.notes = body.notes
  if (typeof body.status === 'string' && (body.status === 'scheduled' || body.status === 'completed')) update.status = body.status
  if (body.scheduledAt) {
    const dt = new Date(body.scheduledAt)
    if (!isNaN(dt.getTime())) update.scheduledAt = dt
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: 'no valid fields' }, { status: 400 })
  }

  // Ownership check: interview -> application -> job -> createdBy
  const interviews = await getCollection<InterviewDoc>('interviews')
  const existing = await interviews.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  if (auth.role !== 'admin') {
    try {
      const applications = await getCollection<any>('applications')
      const app = await applications.findOne({ _id: existing.applicationId })
      if (!app) return NextResponse.json({ ok: false, error: 'application not found' }, { status: 404 })
      const jobs = await getCollection<any>('jobs')
      const job = await jobs.findOne({ _id: app.jobId })
      if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 })
      if (String(job.createdBy || '') !== auth.id) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const r = await (interviews as any).updateOne({ _id }, { $set: update })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  // Emit realtime interview.updated (broadcast to admin; targeted to applicant and employer)
  const payload = { id: String(_id), fields: Object.keys(update) }
  broker.publish({ type: 'interview.updated', payload, toRole: 'admin' })
  // Notify applicant
  try {
    const applications = await getCollection<any>('applications')
    const app = await applications.findOne({ _id: existing.applicationId })
    if (app?.userId) broker.publish({ type: 'interview.updated', payload, toUserId: String(app.userId) })
    if (app?.jobId) {
      const jobs = await getCollection<any>('jobs')
      const job = await jobs.findOne({ _id: app.jobId })
      if (job?.createdBy) broker.publish({ type: 'interview.updated', payload, toUserId: String(job.createdBy) })
    }
    // On completion status, create in-app notifications
    if (update.status === 'completed') {
      const notifs = await getCollection<any>('notifications')
      const ts = new Date()
      if (app?.userId) await (notifs as any).insertOne({ userId: new ObjectId(String(app.userId)), type: 'interview', title: 'Interview Completed', message: 'Thank you for attending the interview.', icon: 'check', url: '/dashboard/applications', read: false, createdAt: ts })
      if (app?.jobId) {
        const jobs = await getCollection<any>('jobs')
        const job = await jobs.findOne({ _id: app.jobId })
        if (job?.createdBy) await (notifs as any).insertOne({ userId: new ObjectId(String(job.createdBy)), type: 'interview', title: 'Interview Marked Completed', message: `Interview for application ${String(existing.applicationId)} marked completed.`, icon: 'check', url: '/employer/interviews', read: false, createdAt: ts })
      }
      // Also update application status to 'interview_completed' and emit events/notifications
      try {
        const appsCol = await getCollection<any>('applications')
        await (appsCol as any).updateOne({ _id: existing.applicationId }, { $set: { status: 'interview_completed', updatedAt: new Date() } })
        // Emit to general channel
        broker.publish({ type: 'application.status_changed', payload: { id: String(existing.applicationId), from: 'interview', to: 'interview_completed' } })
        // Emit targeted events for reliable client refresh
        if (app?.userId) {
          broker.publish({ type: 'application.status_changed', payload: { id: String(existing.applicationId), from: 'interview', to: 'interview_completed' }, toUserId: String(app.userId) })
          broker.publish({ type: 'application.updated', payload: { id: String(existing.applicationId), fields: ['status','updatedAt'] }, toUserId: String(app.userId) })
        }
        if (app?.jobId) {
          const jobs = await getCollection<any>('jobs')
          const job = await jobs.findOne({ _id: app.jobId })
          if (job?.createdBy) {
            broker.publish({ type: 'application.status_changed', payload: { id: String(existing.applicationId), from: 'interview', to: 'interview_completed' }, toUserId: String(job.createdBy) })
            broker.publish({ type: 'application.updated', payload: { id: String(existing.applicationId), fields: ['status','updatedAt'] }, toUserId: String(job.createdBy) })
          }
        }
        try {
          await (notifs as any).insertOne({ userId: app.userId, type: 'application', title: 'Interview Completed', message: 'Your interview status is now completed.', icon: 'check', url: `/dashboard/applications?open=${String(existing.applicationId)}` , read: false, createdAt: new Date() })
        } catch {}
      } catch {}
    }
  } catch {}

  return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
}

// DELETE /api/interviews/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const interviews = await getCollection<InterviewDoc>('interviews')
  const existing = await interviews.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  if (auth.role !== 'admin') {
    try {
      const applications = await getCollection<any>('applications')
      const app = await applications.findOne({ _id: existing.applicationId })
      if (!app) return NextResponse.json({ ok: false, error: 'application not found' }, { status: 404 })
      const jobs = await getCollection<any>('jobs')
      const job = await jobs.findOne({ _id: app.jobId })
      if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 })
      if (String(job.createdBy || '') !== auth.id) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const r = await (interviews as any).deleteOne({ _id })
  if (!r.deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  const payload = { id: String(_id) }
  broker.publish({ type: 'interview.deleted', payload, toRole: 'admin' })
  try {
    const applications = await getCollection<any>('applications')
    const app = await applications.findOne({ _id: existing.applicationId })
    if (app?.userId) broker.publish({ type: 'interview.deleted', payload, toUserId: String(app.userId) })
    if (app?.jobId) {
      const jobs = await getCollection<any>('jobs')
      const job = await jobs.findOne({ _id: app.jobId })
      if (job?.createdBy) broker.publish({ type: 'interview.deleted', payload, toUserId: String(job.createdBy) })
    }
  } catch {}

  return NextResponse.json({ ok: true, deletedCount: r.deletedCount })
}
