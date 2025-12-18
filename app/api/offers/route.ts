import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

export interface OfferDoc {
  _id?: ObjectId
  applicationId: ObjectId
  employerId: ObjectId
  seekerId: ObjectId
  title?: string
  message?: string
  salary?: string
  startDate?: string
  status?: 'sent' | 'accepted' | 'declined'
  seekerResponse?: string
  createdAt?: Date
  updatedAt?: Date
}

// GET /api/offers -> list offers scoped by role/query
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const applicationId = searchParams.get('applicationId')
    const seekerId = searchParams.get('seekerId')
    const employerId = searchParams.get('employerId')

    const col = await getCollection<OfferDoc>('offers')
    const match: any = {}
    if (applicationId) {
      try { match.applicationId = new ObjectId(applicationId) } catch {}
    }
    if (seekerId) {
      try { match.seekerId = new ObjectId(seekerId) } catch {}
    }
    if (employerId) {
      try { match.employerId = new ObjectId(employerId) } catch {}
    }
    // Scope by role if no explicit filter provided
    if (!applicationId && !seekerId && !employerId) {
      if (auth.role === 'job_seeker') match.seekerId = new ObjectId(auth.id)
      if (auth.role === 'employer') match.employerId = new ObjectId(auth.id)
    }
    const items = await (col as any).find(match).sort({ createdAt: -1 }).limit(50).toArray()
    return NextResponse.json({ ok: true, offers: items })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

// POST /api/offers -> create offer
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    if (!body?.applicationId) return NextResponse.json({ ok: false, error: 'applicationId is required' }, { status: 400 })
    const appId = new ObjectId(String(body.applicationId))
    const applications = await getCollection<any>('applications')
    const app = await applications.findOne({ _id: appId })
    if (!app) return NextResponse.json({ ok: false, error: 'application not found' }, { status: 404 })

    // Find seeker and employer
    const seekerId = new ObjectId(String(app.userId))
    let employerId: ObjectId | null = null
    if (app.jobId) {
      const jobs = await getCollection<any>('jobs')
      const job = await jobs.findOne({ _id: new ObjectId(String(app.jobId)) })
      if (job?.createdBy) employerId = new ObjectId(String(job.createdBy))
    }
    if (!employerId) employerId = new ObjectId(String(auth.id))

    const doc: OfferDoc = {
      applicationId: appId,
      employerId,
      seekerId,
      title: (body.title || '').toString().slice(0, 200),
      message: (body.message || '').toString().slice(0, 5000),
      salary: (body.salary || '').toString().slice(0, 200),
      startDate: (body.startDate || '').toString().slice(0, 100),
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const col = await getCollection<OfferDoc>('offers')
    const r = await (col as any).insertOne(doc as any)

    // Emit events and notification
    const payload = { id: String(r.insertedId), offer: { ...doc, _id: r.insertedId } }
    broker.publish({ type: 'offer.created', payload, toUserId: String(seekerId) })
    try {
      const notiCol = await getCollection<any>('notifications')
      await (notiCol as any).insertOne({
        userId: seekerId,
        type: 'offer',
        title: 'Job Offer',
        message: 'You have received a job offer. View and respond in Applications.',
        url: `/dashboard/applications?open=${String(appId)}`,
        icon: 'star',
        read: false,
        createdAt: new Date(),
      })
    } catch {}

    return NextResponse.json({ ok: true, id: r.insertedId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
