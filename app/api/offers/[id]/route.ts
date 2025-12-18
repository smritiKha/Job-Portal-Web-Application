import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// GET /api/offers/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<any>('offers')
  const doc = await col.findOne({ _id })
  if (!doc) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, offer: doc })
}

// PUT /api/offers/[id] -> accept/decline (seeker) or edit (employer)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const col = await getCollection<any>('offers')
  const existing = await col.findOne({ _id })
  if (!existing) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  // Only the employer who created the offer or the seeker target can update
  if (auth.role !== 'admin') {
    const isSeeker = String(existing.seekerId) === auth.id
    const isEmployer = String(existing.employerId) === auth.id
    if (!isSeeker && !isEmployer) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const update: any = { updatedAt: new Date() }
  // Seeker may accept/decline and add a response message
  if (body.status === 'accepted' || body.status === 'declined') update.status = body.status
  if (typeof body.seekerResponse === 'string') update.seekerResponse = String(body.seekerResponse).slice(0, 5000)
  // Employer may edit title/message/salary/startDate while offer is sent
  if (auth.role !== 'job_seeker') {
    if (typeof body.title === 'string') update.title = String(body.title).slice(0, 200)
    if (typeof body.message === 'string') update.message = String(body.message).slice(0, 5000)
    if (typeof body.salary === 'string') update.salary = String(body.salary).slice(0, 200)
    if (typeof body.startDate === 'string') update.startDate = String(body.startDate).slice(0, 100)
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ ok: false, error: 'no valid fields' }, { status: 400 })

  const r = await (col as any).updateOne({ _id }, { $set: update })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  // If seeker accepted, mark application as hired
  try {
    if (update.status === 'accepted' && existing.applicationId) {
      const applications = await getCollection<any>('applications')
      await (applications as any).updateOne({ _id: existing.applicationId }, { $set: { status: 'hired', updatedAt: new Date() } })
      // Emit status change events
      broker.publish({ type: 'application.status_changed', payload: { id: String(existing.applicationId), from: 'offer', to: 'hired' } })
      broker.publish({ type: 'application.updated', payload: { id: String(existing.applicationId), fields: ['status','updatedAt'] } })
    }
  } catch {}

  // Notify both parties
  try {
    const payload = { id: String(_id), fields: Object.keys(update) }
    broker.publish({ type: 'offer.updated', payload, toUserId: String(existing.seekerId) })
    broker.publish({ type: 'offer.updated', payload, toUserId: String(existing.employerId) })
  } catch {}

  return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
}
