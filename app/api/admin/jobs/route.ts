import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'

export const runtime = 'nodejs'

// GET /api/admin/jobs -> list jobs with application counts (admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const jobs = await getCollection<any>('jobs')
    const applications = await getCollection<any>('applications')

    // Aggregate jobs with applications count and basic fields
    const items = await (jobs as any).aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'applications',
          let: { jobId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$jobId', '$$jobId'] } } },
            { $count: 'count' },
          ],
          as: 'apps'
        }
      },
      { $unwind: { path: '$apps', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          title: 1,
          companyName: 1,
          company: 1,
          location: 1,
          type: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          applicationsCount: { $ifNull: ['$apps.count', 0] },
        }
      }
    ]).toArray()

    return NextResponse.json({ ok: true, jobs: items })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
