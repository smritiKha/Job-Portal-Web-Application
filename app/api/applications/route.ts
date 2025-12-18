import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

export interface ApplicationDoc {
  _id?: ObjectId
  userId: ObjectId
  jobId: ObjectId
  status?: 'submitted' | 'reviewed' | 'interview' | 'rejected' | 'hired'
  resumeUrl?: string
  coverLetterUrl?: string
  notes?: string
  attachments?: string[]
  screeningAnswers?: Array<{ question: string; answer: string }>
  // Optional interview metadata (set by employer when scheduling)
  interviewDate?: string
  interviewMode?: 'onsite' | 'remote'
  interviewLocation?: string
  createdAt?: Date
  updatedAt?: Date
}

// GET /api/applications -> list applications (limit 50)
export async function GET(req: NextRequest) {
  const col = await getCollection<ApplicationDoc>('applications')
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const jobId = searchParams.get('jobId')
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  const skip = (page - 1) * limit

  const match: any = {}
  if (userId) {
    try { match.userId = new ObjectId(userId) } catch {}
  }
  if (jobId) {
    try { match.jobId = new ObjectId(jobId) } catch {}
  }
  if (status) {
    match.status = status
  }

  const total = await col.countDocuments(match)
  const items = await (col as any).aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    // Join job details
    {
      $lookup: {
        from: 'jobs',
        localField: 'jobId',
        foreignField: '_id',
        as: 'job',
      },
    },
    { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
    // Join employer (owner of the job) to fallback company name
    {
      $lookup: {
        from: 'users',
        localField: 'job.createdBy',
        foreignField: '_id',
        as: 'employer',
      },
    },
    { $unwind: { path: '$employer', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    // Lookup latest interview for this application to expose interviewStatus
    {
      $lookup: {
        from: 'interviews',
        let: { appId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$applicationId', '$$appId'] } } },
          { $sort: { updatedAt: -1, scheduledAt: -1 } },
          { $limit: 1 },
        ],
        as: 'latestInterview'
      }
    },
    { $unwind: { path: '$latestInterview', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        userId: 1,
        jobId: 1,
        status: 1,
        resumeUrl: 1,
        coverLetterUrl: 1,
        notes: 1,
        interviewDate: 1,
        interviewMode: 1,
        interviewLocation: 1,
        interviewStatus: '$latestInterview.status',
        createdAt: 1,
        updatedAt: 1,
        user: { _id: '$user._id', name: '$user.name', email: '$user.email' },
        // Flatten job info for convenience
        jobTitle: '$job.title',
        companyName: { $ifNull: ['$job.companyName', { $ifNull: ['$job.company', { $ifNull: ['$employer.orgName', '$employer.name'] }] }] },
        company: { $ifNull: ['$job.companyName', { $ifNull: ['$job.company', { $ifNull: ['$employer.orgName', '$employer.name'] }] }] },
        jobLocation: '$job.location',
        jobType: '$job.type',
      },
    },
  ]).toArray()

  return NextResponse.json({ ok: true, applications: items, page, limit, total, hasMore: skip + items.length < total })
}

// POST /api/applications -> create application
export async function POST(req: NextRequest) {
  try {
    // Require authenticated job_seeker (or admin) and bind userId to token
    const auth = await getAuthUser(req)
    if (!auth || (auth.role !== 'job_seeker' && auth.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    if (!body?.jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 })
    }
    // Validate IDs
    let jobObjectId: ObjectId
    try {
      jobObjectId = new ObjectId(body.jobId)
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid jobId' }, { status: 400 })
    }

    // Check for duplicate application for this user and job
    const applicationsCol = await getCollection<ApplicationDoc>('applications')
    const existing = await applicationsCol.findOne({ userId: new ObjectId(auth.id), jobId: jobObjectId })
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'You have already applied to this job', code: 'duplicate_application', existingId: String(existing._id) },
        { status: 409 }
      )
    }

    // Enforce minimal profile completeness: name, email, and a resume URL available
    const users = await getCollection<any>('users')
    const userDoc = await users.findOne({ _id: new ObjectId(auth.id) })
    const missing: string[] = []
    const nameOk = !!(userDoc?.name && String(userDoc.name).trim())
    const emailOk = !!(userDoc?.email && String(userDoc.email).trim())
    if (!nameOk) missing.push('name')
    if (!emailOk) missing.push('email')
    // Determine effective resume URL
    const profileResumeUrl = userDoc?.documents?.resume?.url ? String(userDoc.documents.resume.url) : ''
    const effectiveResumeUrl = body.resumeUrl || profileResumeUrl
    if (!effectiveResumeUrl) missing.push('resume')
    if (missing.length) {
      return NextResponse.json({ ok: false, error: 'Incomplete profile', code: 'incomplete_profile', missing }, { status: 400 })
    }

    // sanitize screening answers if provided
    let screeningAnswers: Array<{ question: string; answer: string }> | undefined
    if (Array.isArray(body?.screeningAnswers)) {
      screeningAnswers = (body.screeningAnswers as any[])
        .map((x) => ({
          question: String((x?.question ?? '')).trim(),
          answer: String((x?.answer ?? '')).trim(),
        }))
        .filter((x) => x.question && x.answer)
        .slice(0, 10)
    }

    const doc: ApplicationDoc = {
      userId: new ObjectId(auth.id),
      jobId: jobObjectId,
      status: (body.status as any) || 'submitted',
      resumeUrl: effectiveResumeUrl,
      coverLetterUrl: body.coverLetterUrl,
      notes: body.notes,
      attachments: Array.isArray(body.attachments) ? (body.attachments.map((s: any) => String(s || '').trim()).filter(Boolean).slice(0, 10)) : undefined,
      screeningAnswers,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const col = applicationsCol
    const result = await col.insertOne(doc as any)
    // Look up job to notify owning employer
    let createdByEmployer: string | undefined
    try {
      const jobsCol = await getCollection<any>('jobs')
      const jobDoc = await jobsCol.findOne({ _id: doc.jobId })
      if (jobDoc?.createdBy) createdByEmployer = String(jobDoc.createdBy)
    } catch {}

    // Non-blocking: also record an employer analytics view so dashboard reflects engagement
    try {
      const analytics = await getCollection<any>('analytics_views')
      await (analytics as any).insertOne({
        employerId: createdByEmployer ? new ObjectId(createdByEmployer) : undefined,
        jobId: doc.jobId,
        viewerId: doc.userId,
        type: 'employer',
        createdAt: new Date(),
      })
    } catch {}
    const createdPayload = { id: String(result.insertedId), application: { ...doc, _id: result.insertedId } }
    // Notify admin oversight
    broker.publish({ type: 'application.created', payload: createdPayload, toRole: 'admin' })
    // Notify the applicant (job seeker)
    broker.publish({ type: 'application.created', payload: createdPayload, toUserId: String(doc.userId) })
    // Notify the employer who owns the job
    if (createdByEmployer) broker.publish({ type: 'application.created', payload: createdPayload, toUserId: createdByEmployer })

    // Create notifications for applicant and employer
    try {
      const notiCol = await getCollection<any>('notifications')
      // Applicant notification
      await (notiCol as any).insertOne({
        userId: doc.userId,
        type: 'application',
        title: 'Application submitted',
        message: 'Your application has been submitted successfully.',
        url: `/dashboard/applications?open=${String(result.insertedId)}`,
        icon: null,
        read: false,
        createdAt: new Date(),
      })
      // Employer notification
      if (createdByEmployer) {
        await (notiCol as any).insertOne({
          userId: new ObjectId(createdByEmployer),
          type: 'application',
          title: 'New application received',
          message: 'A candidate has applied to your job posting.',
          url: `/employer/applicants?jobId=${String(doc.jobId)}&open=${String(result.insertedId)}`,
          icon: null,
          read: false,
          createdAt: new Date(),
        })
      }
      // Admin notifications
      try {
        const usersCol = await getCollection<any>('users')
        const admins = await usersCol.find({ role: 'admin' }).project({ _id: 1 }).toArray()
        if (admins.length) {
          const adminDocs = admins.map((a: any) => ({
            userId: a._id,
            type: 'application',
            title: 'New application submitted',
            message: 'A new job application has been submitted.',
            url: `/admin/reports?open=${String(result.insertedId)}`,
            icon: null,
            read: false,
            createdAt: new Date(),
          }))
          await (notiCol as any).insertMany(adminDocs)
        }
      } catch {}
    } catch {}

    // Audit: application created
    try {
      await logAudit({
        actorId: String(auth.id),
        actorRole: auth.role,
        action: 'application_created',
        targetType: 'application',
        targetId: String(result.insertedId),
        meta: { jobId: String(jobObjectId), resumeUrl: doc.resumeUrl || null, attachments: doc.attachments || [] }
      })
    } catch {}
    return NextResponse.json({ ok: true, id: result.insertedId, doc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
