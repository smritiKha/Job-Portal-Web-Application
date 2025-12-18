import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { broker } from '@/lib/events'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'

// Schema: analytics_views
// { _id, employerId: ObjectId, jobId?: ObjectId, viewerId?: ObjectId, type: 'job'|'employer', createdAt: Date }

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req).catch(() => null)
    const body = await req.json().catch(() => ({}))
    const type = (body?.type as 'job'|'employer') || 'job'
    let employerId: ObjectId | null = null
    let jobId: ObjectId | null = null

    if (type === 'job' && body?.jobId) {
      try {
        jobId = new ObjectId(String(body.jobId))
        const jobs = await getCollection<any>('jobs')
        const job = await jobs.findOne({ _id: jobId })
        if (job?.createdBy) employerId = new ObjectId(String(job.createdBy))
      } catch {}
    }
    if (!employerId && body?.employerId) {
      try { employerId = new ObjectId(String(body.employerId)) } catch {}
    }
    if (!employerId) return NextResponse.json({ ok: false, error: 'employerId could not be resolved' }, { status: 400 })

    const viewerId = auth?.id ? new ObjectId(String(auth.id)) : undefined
    const col = await getCollection<any>('analytics_views')
    const r = await (col as any).insertOne({ employerId, jobId, viewerId, type, createdAt: new Date() })
    // Publish an event so connected dashboards can refresh
    try {
      broker.publish({ type: 'analytics.view', payload: { id: String(r.insertedId), employerId: String(employerId), type, jobId: jobId ? String(jobId) : undefined }, toUserId: String(employerId) })
    } catch {}
    return NextResponse.json({ ok: true, id: r.insertedId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}

// GET for employer: returns counts for recent periods
// /api/analytics/views?mine=1&periodDays=30
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || (auth.role !== 'employer' && auth.role !== 'admin')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const periodDays = Math.max(1, Math.min(90, parseInt(searchParams.get('periodDays') || '30', 10) || 30))
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
    const jobIdParam = searchParams.get('jobId')
    const series = Boolean(searchParams.get('series'))

    const col = await getCollection<any>('analytics_views')
    const match: any = { employerId: new ObjectId(auth.id), createdAt: { $gte: since } }
    if (jobIdParam) {
      try { match.jobId = new ObjectId(jobIdParam) } catch {}
    }
    const total = await col.countDocuments(match)

    // Also compute previous period for change calculation
    const prevSince = new Date(since.getTime() - periodDays * 24 * 60 * 60 * 1000)
    const prevMatch: any = { employerId: new ObjectId(auth.id), createdAt: { $gte: prevSince, $lt: since } }
    if (jobIdParam) {
      try { prevMatch.jobId = new ObjectId(jobIdParam) } catch {}
    }
    const prevTotal = await col.countDocuments(prevMatch)

    const change = total - prevTotal
    const changeStr = change === 0 ? '' : (change > 0 ? `+${change} vs prev ${periodDays}d` : `${change} vs prev ${periodDays}d`)

    if (!series) {
      return NextResponse.json({ ok: true, total, periodDays, change, changeStr })
    }

    // Build a daily time series for the last periodDays
    const pipeline: any[] = [
      { $match: match },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
      { $group: { _id: '$day', total: { $count: {} } } },
      { $sort: { _id: 1 } },
    ]
    const raw = await (col as any).aggregate(pipeline).toArray()
    // Normalize into an ordered array covering each day in the window
    const out: Array<{ date: string; total: number }> = []
    const today = new Date()
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      const found = raw.find((r: any) => r._id === key)
      out.push({ date: key, total: found ? Number(found.total || 0) : 0 })
    }
    return NextResponse.json({ ok: true, total, periodDays, change, changeStr, series: out })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
