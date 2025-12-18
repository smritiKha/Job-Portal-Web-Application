import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const users = await getCollection('users')
    const jobs = await getCollection('jobs')
    const applications = await getCollection('applications')

    const [totalUsers, jobSeekers, employers, totalJobs, activeJobs, totalApplications] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: 'job_seeker' }),
      users.countDocuments({ role: 'employer' }),
      jobs.countDocuments({}),
      jobs.countDocuments({ status: { $in: ['active','open'] } }),
      applications.countDocuments({}),
    ])

    return NextResponse.json({ ok: true, stats: {
      totalUsers,
      jobSeekers,
      employers,
      totalJobs,
      activeJobs,
      totalApplications,
    } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
