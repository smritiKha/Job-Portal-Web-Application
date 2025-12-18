import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { broker } from '@/lib/events'
import { logAudit } from '@/lib/audit'
import { getAuthUser } from '@/lib/api-auth'

interface UserDoc {
  _id?: ObjectId
  email: string
  name?: string
  createdAt?: Date
  role?: 'admin' | 'employer' | 'job_seeker'
  status?: 'active' | 'suspended' | 'pending'
  // Common profile
  phone?: string
  location?: string
  title?: string
  bio?: string
  skills?: string[]
  // Job seeker preferences
  salaryExpectation?: string
  dreamJob?: string
  isFresher?: boolean
  openToInternships?: boolean
  availabilityStartDate?: string
  preferredInternshipDuration?: string
  // Job seeker profile extras
  experiences?: Array<{ title?: string; company?: string; start?: string; end?: string; description?: string }>
  education?: Array<{ degree?: string; school?: string; start?: string; end?: string; description?: string }>
  // Additional sections
  projects?: Array<{ name?: string; role?: string; link?: string; start?: string; end?: string; description?: string; tech?: string[] }>
  certifications?: Array<{ name?: string; issuer?: string; date?: string; credentialId?: string; link?: string }>
  resumeTemplate?: string
  // Employer company profile
  companyName?: string
  companyWebsite?: string
  companyLocation?: string
  companyBio?: string
  companyLogo?: string
  companyLinkedin?: string
  companyTwitter?: string
  companyFacebook?: string
  teamSize?: string
  industry?: string
  benefits?: string
  hiringPreferences?: string
}

function parseObjectId(id: string) {
  try {
    return new ObjectId(id)
  } catch {
    return null
  }
}

// GET /api/users/[id]
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ id: string }>) : (ctx.params as { id: string })
  const oid = parseObjectId(p.id)
  if (!oid) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })

  const usersCol = await getCollection<UserDoc>('users')
  const user = await usersCol.findOne({ _id: oid })
  if (!user) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, user })
}

// PUT /api/users/[id]
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ id: string }>) : (ctx.params as { id: string })
  const oid = parseObjectId(p.id)
  if (!oid) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || (auth.role !== 'admin' && auth.id !== String(oid))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Partial<UserDoc> & { settings?: { notifications?: { jobAlerts?: boolean; applicationUpdates?: boolean; productNews?: boolean } } }
  const update: any = {}
  if (typeof body.email === 'string') update.email = String(body.email).trim().toLowerCase()
  if (typeof body.name === 'string') update.name = body.name
  if (typeof body.phone === 'string') update.phone = body.phone
  if (typeof body.location === 'string') update.location = body.location
  if (typeof body.title === 'string') update.title = body.title
  if (typeof body.bio === 'string') update.bio = body.bio
  if (Array.isArray(body.skills)) update.skills = body.skills.filter(s => typeof s === 'string')
  if (typeof (body as any).salaryExpectation === 'string') update.salaryExpectation = (body as any).salaryExpectation
  if (typeof (body as any).dreamJob === 'string') update.dreamJob = (body as any).dreamJob
  if (typeof (body as any).isFresher === 'boolean') update.isFresher = (body as any).isFresher
  if (typeof (body as any).openToInternships === 'boolean') update.openToInternships = (body as any).openToInternships
  if (typeof (body as any).availabilityStartDate === 'string') update.availabilityStartDate = (body as any).availabilityStartDate
  if (typeof (body as any).preferredInternshipDuration === 'string') update.preferredInternshipDuration = (body as any).preferredInternshipDuration
  if (Array.isArray(body.experiences)) update.experiences = body.experiences.filter(e => e && typeof e === 'object')
  if (Array.isArray(body.education)) update.education = body.education.filter(e => e && typeof e === 'object')
  if (Array.isArray(body.projects)) update.projects = body.projects.filter(e => e && typeof e === 'object')
  if (Array.isArray(body.certifications)) update.certifications = body.certifications.filter(e => e && typeof e === 'object')
  if (typeof body.resumeTemplate === 'string') update.resumeTemplate = body.resumeTemplate
  if (typeof body.companyName === 'string') update.companyName = body.companyName
  if (typeof body.companyWebsite === 'string') update.companyWebsite = body.companyWebsite
  if (typeof body.companyLocation === 'string') update.companyLocation = body.companyLocation
  if (typeof body.companyBio === 'string') update.companyBio = body.companyBio
  if (typeof (body as any).companyLogo === 'string') update.companyLogo = (body as any).companyLogo
  if (typeof (body as any).companyLinkedin === 'string') update.companyLinkedin = (body as any).companyLinkedin
  if (typeof (body as any).companyTwitter === 'string') update.companyTwitter = (body as any).companyTwitter
  if (typeof (body as any).companyFacebook === 'string') update.companyFacebook = (body as any).companyFacebook
  if (typeof (body as any).teamSize === 'string') update.teamSize = (body as any).teamSize
  if (typeof (body as any).industry === 'string') update.industry = (body as any).industry
  if (typeof (body as any).benefits === 'string') update.benefits = (body as any).benefits
  if (typeof (body as any).hiringPreferences === 'string') update.hiringPreferences = (body as any).hiringPreferences
  // Admin-only fields
  if (typeof (body as any).role === 'string') {
    if (auth.role !== 'admin') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    const r = (body as any).role
    if (!['admin','employer','job_seeker'].includes(r)) {
      return NextResponse.json({ ok: false, error: 'invalid role' }, { status: 400 })
    }
    update.role = r
  }
  if (typeof (body as any).status === 'string') {
    if (auth.role !== 'admin') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    const s = (body as any).status
    if (!['active','suspended','pending'].includes(s)) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 })
    }
    update.status = s
  }

  // Nested settings: notifications
  const notif = (body as any)?.settings?.notifications || {}
  if (typeof notif.jobAlerts === 'boolean') update['settings.notifications.jobAlerts'] = notif.jobAlerts
  if (typeof notif.applicationUpdates === 'boolean') update['settings.notifications.applicationUpdates'] = notif.applicationUpdates
  if (typeof notif.productNews === 'boolean') update['settings.notifications.productNews'] = notif.productNews

  // Nested settings: presence (online/offline)
  const presence = (body as any)?.settings?.presence || {}
  if (typeof presence.online === 'boolean') update['settings.presence.online'] = presence.online

  if (!Object.keys(update).length) {
    return NextResponse.json({ ok: false, error: 'no valid fields to update' }, { status: 400 })
  }

  const usersCol = await getCollection<UserDoc>('users')
  // Read previous user to detect email changes
  const prev = await usersCol.findOne({ _id: oid })
  if (!prev) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  // If email is changing, verify uniqueness
  if (typeof update.email === 'string' && update.email && update.email !== prev.email) {
    const exists = await usersCol.findOne({ email: update.email })
    if (exists) return NextResponse.json({ ok: false, error: 'email already in use' }, { status: 409 })
  }

  const { matchedCount, modifiedCount } = await usersCol.updateOne({ _id: oid }, { $set: update })
  if (!matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  // Emit realtime user.updated for admin and the affected user
  const fields = Object.keys(update)
  const payload = { id: String(oid), fields }
  broker.publish({ type: 'user.updated', payload, toRole: 'admin' })
  broker.publish({ type: 'user.updated', payload, toUserId: String(oid) })
  try {
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'user_updated',
      targetType: 'user',
      targetId: String(oid),
      meta: { fields, reason: (body as any)?.reason }
    })
  } catch {}

  // If email changed, propagate to denormalized fields in related collections
  try {
    if (typeof update.email === 'string' && update.email && update.email !== prev.email) {
      const newEmail = update.email
      // applications: applicantEmail, employerEmail
      try {
        const applications = await getCollection<any>('applications')
        await applications.updateMany({ applicantId: String(oid) }, { $set: { applicantEmail: newEmail } })
        await applications.updateMany({ employerId: String(oid) }, { $set: { employerEmail: newEmail } })
      } catch {}
      // offers: candidateEmail, employerEmail
      try {
        const offers = await getCollection<any>('offers')
        await offers.updateMany({ candidateId: String(oid) }, { $set: { candidateEmail: newEmail } })
        await offers.updateMany({ employerId: String(oid) }, { $set: { employerEmail: newEmail } })
      } catch {}
      // interviews: candidateEmail, employerEmail
      try {
        const interviews = await getCollection<any>('interviews')
        await interviews.updateMany({ candidateId: String(oid) }, { $set: { candidateEmail: newEmail } })
        await interviews.updateMany({ employerId: String(oid) }, { $set: { employerEmail: newEmail } })
      } catch {}
      // conversations/messages mostly keyed by userId; nothing needed here
    }
  } catch {}
  return NextResponse.json({ ok: true, modifiedCount })
}

// DELETE /api/users/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const p = (ctx.params as any)?.then ? await (ctx.params as Promise<{ id: string }>) : (ctx.params as { id: string })
  const oid = parseObjectId(p.id)
  if (!oid) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth || auth.role !== 'admin') return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const usersCol = await getCollection<UserDoc>('users')
  const { deletedCount } = await usersCol.deleteOne({ _id: oid })
  if (!deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  try {
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'user_deleted',
      targetType: 'user',
      targetId: String(oid)
    })
  } catch {}
  return NextResponse.json({ ok: true, deletedCount })
}
