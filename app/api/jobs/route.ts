import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'
import { broker } from '@/lib/events'

interface JobDoc {
  _id?: ObjectId
  title: string
  description?: string
  companyId?: ObjectId
  createdBy?: ObjectId
  location?: string
  salaryMin?: number
  salaryMax?: number
  status?: 'open' | 'closed' | 'pending'
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  skills?: string[]
  type?: 'full-time' | 'part-time' | 'contract' | 'internship'
  category?: string
  screeningQuestions?: string[]
  featured?: boolean
  createdAt?: Date
}

// GET /api/jobs -> list jobs (limit 50)
export async function GET(req: NextRequest) {
  const jobsCol = await getCollection<JobDoc>('jobs')
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const companyId = searchParams.get('companyId')
  const createdBy = searchParams.get('createdBy')
  const q = searchParams.get('q')
  const category = searchParams.get('category')
  const featured = searchParams.get('featured')
  
  // Get the authenticated user
  const authUser = await getAuthUser(req)

  const query: any = {}
  if (status) query.status = status
  if (companyId) {
    try { query.companyId = new ObjectId(companyId) } catch {}
  }
  if (createdBy) {
    try { query.createdBy = new ObjectId(createdBy) } catch {}
  }
  if (q) {
    query.title = { $regex: q, $options: 'i' }
  }
  if (category) {
    query.category = String(category)
  }
  if (featured === 'true' || featured === '1') {
    query.featured = true
  }

  // Only show approved and open jobs to non-admin users
  if (!authUser || authUser.role !== 'admin') {
    query.approvalStatus = 'approved';
    query.status = 'open';
  }
  const jobs = await jobsCol.find(query).sort({ featured: -1, createdAt: -1 }).limit(50).toArray()
  return NextResponse.json({ ok: true, jobs })
}

// POST /api/jobs -> create job
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser || (authUser.role !== 'employer' && authUser.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await req.json()) as Partial<JobDoc & { companyId?: string; skills?: string[] }>
    if (!body || !body.title) {
      return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    }

    const jobsCol = await getCollection<JobDoc>('jobs')

    // sanitize skills
    const skills: string[] | undefined = Array.isArray(body.skills)
      ? (body.skills
          .map((s) => String(s || '').trim())
          .filter(Boolean)
          .slice(0, 20))
      : undefined

    // sanitize type/category
    const allowedTypes = ['full-time','part-time','contract','internship'] as const
    const postedType = typeof body.type === 'string' && allowedTypes.includes(body.type as any) ? (body.type as any) : undefined
    const allowedCategories = [
      'IT','Education','Medical','Engineering','Design','Marketing','Finance','HR','Operations','Sales','Product','Data','Legal','Support','Other'
    ]
    const postedCategory = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : undefined

    // normalize screening questions from body.questions (string with newlines) or body.screeningQuestions (array)
    let screeningQuestions: string[] | undefined
    if (Array.isArray((body as any).screeningQuestions)) {
      screeningQuestions = (body as any).screeningQuestions
        .map((q: any) => String(q || '').trim())
        .filter(Boolean)
        .slice(0, 10)
    } else if (typeof (body as any).questions === 'string') {
      screeningQuestions = String((body as any).questions)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    }

    // Create job document with proper status handling
    const jobDoc: JobDoc & { approvalStatus: 'pending' | 'approved' | 'rejected' } = {
      title: body.title,
      description: body.description || '',
      companyId: body.companyId ? new ObjectId(body.companyId) : undefined,
      createdBy: new ObjectId(authUser.id),
      location: body.location || '',
      salaryMin: typeof body.salaryMin === 'number' ? body.salaryMin : undefined,
      salaryMax: typeof body.salaryMax === 'number' ? body.salaryMax : undefined,
      status: 'pending', // Will be set to 'open' after approval
      approvalStatus: 'pending', // New field for approval tracking
      skills,
      type: postedType,
      category: postedCategory,
      screeningQuestions,
      featured: false,
      createdAt: new Date(),
    }

    const result = await jobsCol.insertOne(jobDoc as any)
    // Emit real-time events for job created
    const createdPayload = { id: String(result.insertedId), job: { ...jobDoc, _id: result.insertedId } }
    // Broadcast to job seekers (list pages) and admins (oversight)
    broker.publish({ type: 'job.created', payload: createdPayload, toRole: 'job_seeker' })
    broker.publish({ type: 'job.created', payload: createdPayload, toRole: 'admin' })
    // Notify the creating employer as well
    broker.publish({ type: 'job.created', payload: createdPayload, toUserId: String(authUser.id) })

    // Create notifications for all admins
    try {
      const usersCol = await getCollection<any>('users')
      const admins = await usersCol.find({ role: 'admin' }).project({ _id: 1 }).toArray()
      if (admins.length) {
        const notiCol = await getCollection<any>('notifications')
        const docs = admins.map((a: any) => ({
          userId: a._id,
          type: 'job',
          title: 'New job posted',
          message: `Job "${jobDoc.title}" has been posted`,
          url: `/admin/jobs?open=${String(result.insertedId)}`,
          icon: null,
          read: false,
          createdAt: new Date(),
        }))
        if (docs.length) await (notiCol as any).insertMany(docs)
      }
    } catch {}

    // Audit: job created
    try {
      await logAudit({
        actorId: String(authUser.id),
        actorRole: authUser.role,
        action: 'job_created',
        targetType: 'job',
        targetId: String(result.insertedId),
        meta: {
          title: jobDoc.title,
          companyId: jobDoc.companyId ? String(jobDoc.companyId) : null,
          createdBy: String(authUser.id),
          status: jobDoc.status,
        },
      })
    } catch {}
    return NextResponse.json({ ok: true, id: result.insertedId, job: jobDoc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
