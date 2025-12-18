import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

function pctChange(curr: number, prev: number) {
  if (!prev && !curr) return 0
  if (!prev) return 100
  return Math.round(((curr - prev) / prev) * 100)
}

function parseRangeDays(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const r = parseInt(searchParams.get('range') || '30', 10)
  if (r === 7 || r === 30 || r === 90) return r
  return 30
}

function parseFilters(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')?.trim() || ''
  const status = searchParams.get('status')?.trim() || ''
  return { company, status }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const days = parseRangeDays(req)
    const { company, status } = parseFilters(req)
    const now = new Date()
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000)

    const jobsCol = await getCollection<any>('jobs')
    const appsCol = await getCollection<any>('applications')

    // Optional company filter: limit jobs/applications to those matching company
    let jobCompanyMatch: any = {}
    if (company) {
      jobCompanyMatch = {
        $or: [
          { companyName: { $regex: company, $options: 'i' } },
          { 'company.name': { $regex: company, $options: 'i' } },
          { company: { $regex: company, $options: 'i' } },
        ],
      }
    }

    // Current period counts
    const [totalJobs, activeJobs, pendingJobs] = await Promise.all([
      jobsCol.countDocuments({ createdAt: { $gte: since }, ...(company ? jobCompanyMatch : {}) }),
      jobsCol.countDocuments({ createdAt: { $gte: since }, status: { $in: ['active', 'open'] }, ...(company ? jobCompanyMatch : {}) }),
      jobsCol.countDocuments({ createdAt: { $gte: since }, status: 'pending', ...(company ? jobCompanyMatch : {}) }),
    ])

    // Applications counts with optional filters
    const appMatchCurrent: any = { createdAt: { $gte: since } }
    if (status) appMatchCurrent.status = status
    // If filtering by company, restrict to applications whose jobId is in company jobs
    let companyJobIds: string[] | null = null
    if (company) {
      const companyJobs = await jobsCol.find({ ...(jobCompanyMatch as any) }, { projection: { _id: 1 } }).toArray()
      companyJobIds = companyJobs.map((j: any) => String(j._id))
      appMatchCurrent.jobId = { $in: companyJobIds.map((id) => new ObjectId(id)) }
    }
    const totalApplications = await appsCol.countDocuments(appMatchCurrent)

    // Previous period counts
    const [prevTotalJobs, prevActiveJobs, prevPendingJobs, prevTotalApplications] = await Promise.all([
      jobsCol.countDocuments({ createdAt: { $gte: prevSince, $lt: since }, ...(company ? jobCompanyMatch : {}) }),
      jobsCol.countDocuments({ createdAt: { $gte: prevSince, $lt: since }, status: { $in: ['active', 'open'] }, ...(company ? jobCompanyMatch : {}) }),
      jobsCol.countDocuments({ createdAt: { $gte: prevSince, $lt: since }, status: 'pending', ...(company ? jobCompanyMatch : {}) }),
      appsCol.countDocuments({
        createdAt: { $gte: prevSince, $lt: since },
        ...(status ? { status } : {}),
        ...(company && companyJobIds ? { jobId: { $in: companyJobIds.map((id) => new ObjectId(id)) } } : {}),
      }),
    ])

    // Applications by status (current period)
    const appsByStatus = await (appsCol as any).aggregate([
      { $match: { ...appMatchCurrent } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]).toArray()

    // Top jobs by applications (current period)
    const topJobsAgg = await (appsCol as any).aggregate([
      { $match: { ...appMatchCurrent } },
      { $group: { _id: '$jobId', applications: { $sum: 1 } } },
      { $sort: { applications: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      { $project: { jobId: { $toString: '$_id' }, applications: 1, title: '$job.title', companyName: '$job.companyName', company: '$job.company' } },
    ]).toArray()

    const topJobsByApplications = topJobsAgg.map((j: any) => ({
      jobId: j.jobId,
      title: j.title || 'Untitled',
      company: (j.companyName && typeof j.companyName === 'string') ? j.companyName : (typeof j.company === 'object' && j.company ? (j.company.name || 'Company') : (j.company || 'Company')),
      applications: j.applications || 0,
    }))

    // Applications daily time series (current period)
    const appsDailyRaw = await (appsCol as any).aggregate([
      { $match: { ...appMatchCurrent } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]).toArray()
    // Fill missing days
    const fillSeries: Array<{ date: string; count: number }> = []
    const dayMs = 24 * 60 * 60 * 1000
    const startDay = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()))
    const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const map = new Map<string, number>(appsDailyRaw.map((d: any) => [String(d.date), Number(d.count)]))
    for (let t = startDay.getTime(); t <= endDay.getTime(); t += dayMs) {
      const d = new Date(t)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
      fillSeries.push({ date: key, count: map.get(key) || 0 })
    }

    const resultBody = {
      ok: true,
      range: { days, since, prevSince, until: now, company: company || null, status: status || null },
      metrics: {
        totalJobs: { current: totalJobs, prev: prevTotalJobs, changePct: pctChange(totalJobs, prevTotalJobs) },
        totalApplications: { current: totalApplications, prev: prevTotalApplications, changePct: pctChange(totalApplications, prevTotalApplications) },
        activeJobs: { current: activeJobs, prev: prevActiveJobs, changePct: pctChange(activeJobs, prevActiveJobs) },
        pendingJobs: { current: pendingJobs, prev: prevPendingJobs, changePct: pctChange(pendingJobs, prevPendingJobs) },
      },
      topJobsByApplications,
      applicationsByStatus: appsByStatus,
      applicationsDaily: fillSeries,
    }

    // Cache header for small revalidation window
    const res = NextResponse.json(resultBody)
    res.headers.set('Cache-Control', 'public, max-age=30')
    return res
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
