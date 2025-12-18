import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import type { ApplicationDoc } from '../route'
import { getAuthUser } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { broker } from '@/lib/events'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// GET /api/applications/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<ApplicationDoc>('applications')
  const doc = await col.findOne({ _id })
  if (!doc) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, application: doc })
}

// PUT /api/applications/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const col = await getCollection<ApplicationDoc>('applications')
  const existing = await col.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  // Only admin, the applicant, or the employer who owns the job can update
  if (auth.role !== 'admin') {
    const isApplicant = String(existing.userId) === auth.id
    let isEmployerOwner = false
    try {
      if (existing.jobId) {
        const jobsCol = await getCollection<any>('jobs')
        const job = await jobsCol.findOne({ _id: new ObjectId(String(existing.jobId)) })
        if (job && String(job.createdBy) === auth.id) isEmployerOwner = true
      }
    } catch {}
    if (!isApplicant && !isEmployerOwner) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }
  const body = await req.json()
  const update: any = { updatedAt: new Date() }
  const statusTo = typeof body.status === 'string' ? body.status : undefined
  if (statusTo) update.status = statusTo
  if (typeof body.resumeUrl === 'string') update.resumeUrl = body.resumeUrl
  if (typeof body.coverLetterUrl === 'string') update.coverLetterUrl = body.coverLetterUrl
  // Accept both 'notes' and legacy 'reason' from clients
  const reasonNotes = typeof body.notes === 'string' ? body.notes : (typeof body.reason === 'string' ? body.reason : undefined)
  if (reasonNotes) update.notes = reasonNotes
  // Persist optional interview metadata if provided
  if (typeof body.interviewDate === 'string') update.interviewDate = body.interviewDate
  if (typeof body.interviewMode === 'string') update.interviewMode = body.interviewMode
  if (typeof body.interviewLocation === 'string') update.interviewLocation = body.interviewLocation
  // Only admin can rebind userId/jobId
  if (auth.role === 'admin') {
    if (body.userId) {
      const u = oid(body.userId)
      if (u) update.userId = u
    }
    if (body.jobId) {
      const j = oid(body.jobId)
      if (j) update.jobId = j
    }
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: 'no valid fields' }, { status: 400 })
  }
  const r = await col.updateOne({ _id }, { $set: update })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  // Non-blocking audit log
  const updatedFields = Object.keys(update).filter(k => k !== 'updatedAt')
  await logAudit({
    actorId: auth.id,
    actorRole: auth.role,
    action: 'application_update',
    targetType: 'application',
    targetId: String(_id),
    meta: { updatedFields }
  })
  // Emit real-time update event
  broker.publish({ type: 'application.updated', payload: { id: String(_id), fields: updatedFields } })
  // If status changed, log a dedicated status change event with from -> to and optional reason
  if (statusTo && existing?.status !== statusTo) {
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'application_status_changed',
      targetType: 'application',
      targetId: String(_id),
      meta: { from: existing?.status, to: statusTo, reason: reasonNotes }
    })
    // Also emit status-changed event
    broker.publish({ type: 'application.status_changed', payload: { id: String(_id), from: existing?.status, to: statusTo } })
    // Create an in-app notification for the application owner
    try {
      const notiCol = await getCollection<any>('notifications')
      const isHired = statusTo === 'hired'
      await (notiCol as any).insertOne({
        userId: existing.userId,
        type: 'application',
        title: isHired ? 'Offer Received' : 'Application status updated',
        message: isHired ? 'Congratulations! You have received an offer.' : `Your application status changed from ${existing?.status || 'unknown'} to ${statusTo}.`,
        url: `/dashboard/applications?open=${String(_id)}`,
        icon: isHired ? 'star' : null,
        read: false,
        createdAt: new Date(),
      })
    } catch {}
  }
  return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
}

// DELETE /api/applications/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const col = await getCollection<ApplicationDoc>('applications')
  const existing = await col.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  if (auth.role !== 'admin') {
    const isApplicant = String(existing.userId) === auth.id
    let isEmployerOwner = false
    try {
      if (existing.jobId) {
        const jobsCol = await getCollection<any>('jobs')
        const job = await jobsCol.findOne({ _id: new ObjectId(String(existing.jobId)) })
        if (job && String(job.createdBy) === auth.id) isEmployerOwner = true
      }
    } catch {}
    if (!isApplicant && !isEmployerOwner) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }
  const r = await col.deleteOne({ _id })
  if (!r.deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  broker.publish({ type: 'application.deleted', payload: { id: String(_id) } })
  return NextResponse.json({ ok: true, deletedCount: r.deletedCount })
}
