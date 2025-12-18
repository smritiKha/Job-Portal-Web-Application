import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'

// Collection: saved_jobs { _id, userId, jobId, createdAt }

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const savedCol = await getCollection<any>('saved_jobs')

    // Join with jobs to enrich card data
    const items = await (savedCol as any).aggregate([
      { $match: { userId: new ObjectId(auth.id) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'jobs',
          localField: 'jobId',
          foreignField: '_id',
          as: 'job',
        }
      },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          jobId: 1,
          createdAt: 1,
          job: {
            _id: '$job._id',
            title: '$job.title',
            company: '$job.companyName',
            location: '$job.location',
            salaryMin: '$job.salaryMin',
            salaryMax: '$job.salaryMax',
            type: '$job.type',
            description: '$job.description',
            createdAt: '$job.createdAt',
          }
        }
      }
    ]).toArray()

    return NextResponse.json({ ok: true, saved: items })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const jobIdStr = String(body?.jobId || '')
    if (!jobIdStr) return NextResponse.json({ ok: false, error: 'jobId is required' }, { status: 400 })
    let jobId: ObjectId
    try { jobId = new ObjectId(jobIdStr) } catch { return NextResponse.json({ ok: false, error: 'invalid jobId' }, { status: 400 }) }

    const savedCol = await getCollection<any>('saved_jobs')
    // idempotent: upsert unique on (userId, jobId)
    const existing = await savedCol.findOne({ userId: new ObjectId(auth.id), jobId })
    if (existing) return NextResponse.json({ ok: true, id: existing._id, already: true })

    const res = await savedCol.insertOne({ userId: new ObjectId(auth.id), jobId, createdAt: new Date() })
    return NextResponse.json({ ok: true, id: res.insertedId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const idParam = url.searchParams.get('id')
    const jobIdParam = url.searchParams.get('jobId')
    const savedCol = await getCollection<any>('saved_jobs')

    let match: any = { userId: new ObjectId(auth.id) }
    if (idParam) {
      try { match._id = new ObjectId(String(idParam)) } catch { return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 }) }
    } else if (jobIdParam) {
      try { match.jobId = new ObjectId(String(jobIdParam)) } catch { return NextResponse.json({ ok: false, error: 'invalid jobId' }, { status: 400 }) }
    } else {
      return NextResponse.json({ ok: false, error: 'id or jobId required' }, { status: 400 })
    }

    const del = await savedCol.deleteOne(match)
    if (!del.deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
