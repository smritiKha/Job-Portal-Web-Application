import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { broker } from '@/lib/events'
import { getAuthUser } from '@/lib/api-auth'

export interface InterviewDoc {
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

// GET /api/interviews -> list interviews (role-scoped)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req)
  const interviewsCol = await getCollection<InterviewDoc>('interviews')
  // Admin sees all
  if (auth?.role === 'admin') {
    const items = await interviewsCol.find({}).sort({ createdAt: -1 }).limit(50).toArray()
    return NextResponse.json({ ok: true, interviews: items })
  }
  // Employer: interviews for their jobs
  if (auth?.role === 'employer') {
    const items = await (interviewsCol as any).aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'applications',
          localField: 'applicationId',
          foreignField: '_id',
          as: 'app',
        },
      },
      { $unwind: '$app' },
      {
        $lookup: {
          from: 'jobs',
          localField: 'app.jobId',
          foreignField: '_id',
          as: 'job',
        },
      },
      { $unwind: '$job' },
      { $match: { 'job.createdBy': new ObjectId(auth.id) } },
      { $project: {
          _id: 1,
          applicationId: 1,
          interviewer: 1,
          scheduledAt: 1,
          mode: 1,
          notes: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          jobTitle: '$job.title',
          companyName: { $ifNull: ['$job.companyName', '$job.company'] },
          company: { $ifNull: ['$job.companyName', '$job.company'] },
          jobLocation: '$job.location',
        }
      },
    ]).toArray()
    return NextResponse.json({ ok: true, interviews: items })
  }
  // Job seeker: interviews for their applications
  if (auth?.role === 'job_seeker') {
    const items = await (interviewsCol as any).aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'applications',
          localField: 'applicationId',
          foreignField: '_id',
          as: 'app',
        },
      },
      { $unwind: '$app' },
      { $match: { 'app.userId': new ObjectId(auth.id) } },
      // Join job to expose company/job title for client display
      {
        $lookup: {
          from: 'jobs',
          localField: 'app.jobId',
          foreignField: '_id',
          as: 'job',
        },
      },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 1,
          applicationId: 1,
          interviewer: 1,
          scheduledAt: 1,
          mode: 1,
          notes: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          jobTitle: '$job.title',
          companyName: { $ifNull: ['$job.companyName', '$job.company'] },
          company: { $ifNull: ['$job.companyName', '$job.company'] },
          jobLocation: '$job.location',
        }
      },
    ]).toArray()
    return NextResponse.json({ ok: true, interviews: items })
  }
  // Unauth or unknown role -> empty
  return NextResponse.json({ ok: true, interviews: [] })
}

// POST /api/interviews -> create interview
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.applicationId || !body?.scheduledAt) {
      return NextResponse.json({ ok: false, error: 'applicationId and scheduledAt are required' }, { status: 400 })
    }
    const doc: InterviewDoc = {
      applicationId: new ObjectId(body.applicationId),
      interviewer: body.interviewer || '',
      scheduledAt: new Date(body.scheduledAt),
      mode: (body.mode as InterviewDoc['mode']) || 'remote',
      notes: body.notes || '',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const col = await getCollection<InterviewDoc>('interviews')
    const result = await col.insertOne(doc as any)
    const createdPayload = { id: String(result.insertedId), interview: { ...doc, _id: result.insertedId } }
    // Determine applicant and employer for scoping
    let applicantUserId: string | undefined
    let employerUserId: string | undefined
    try {
      const apps = await getCollection<any>('applications')
      const app = await apps.findOne({ _id: doc.applicationId })
      if (app?.userId) applicantUserId = String(app.userId)
      if (app?.jobId) {
        const jobs = await getCollection<any>('jobs')
        const job = await jobs.findOne({ _id: app.jobId })
        if (job?.createdBy) employerUserId = String(job.createdBy)
      }
    } catch {}
    // Emit real-time events for interview created
    broker.publish({ type: 'interview.created', payload: createdPayload, toRole: 'admin' })
    if (applicantUserId) broker.publish({ type: 'interview.created', payload: createdPayload, toUserId: applicantUserId })
    if (employerUserId) broker.publish({ type: 'interview.created', payload: createdPayload, toUserId: employerUserId })
    // Also emit interview.updated to unify client handling
    const updPayload = { id: String(result.insertedId), fields: ['applicationId','scheduledAt','interviewer','mode','notes','createdAt','updatedAt'] }
    broker.publish({ type: 'interview.updated', payload: updPayload, toRole: 'admin' })
    if (applicantUserId) broker.publish({ type: 'interview.updated', payload: updPayload, toUserId: applicantUserId })
    if (employerUserId) broker.publish({ type: 'interview.updated', payload: updPayload, toUserId: employerUserId })
    // In-app notifications for applicant and employer
    try {
      const notifs = await getCollection<any>('notifications')
      const ts = new Date()
      const humanWhen = doc.scheduledAt.toLocaleString()
      if (applicantUserId) {
        await (notifs as any).insertOne({
          userId: new ObjectId(applicantUserId),
          type: 'interview',
          title: 'Interview Scheduled',
          message: `Your interview is scheduled for ${humanWhen}.`,
          icon: 'calendar',
          url: '/dashboard/applications',
          read: false,
          createdAt: ts,
        })
      }
      if (employerUserId) {
        await (notifs as any).insertOne({
          userId: new ObjectId(employerUserId),
          type: 'interview',
          title: 'Interview Scheduled',
          message: `Interview created for application ${String(doc.applicationId)} at ${humanWhen}.`,
          icon: 'calendar',
          url: '/employer/interviews',
          read: false,
          createdAt: ts,
        })
      }
    } catch {}

    return NextResponse.json({ ok: true, id: result.insertedId, doc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
