import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// GET: list saved plans for current user (latest first)
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const col = await getCollection<any>('learning_plans')
    const items = await col.find({ userId: new ObjectId(auth.id) }).sort({ createdAt: -1 }).limit(20).toArray()
    return NextResponse.json({ ok: true, plans: items.map(it => ({ ...it, id: String(it._id) })) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// POST: save a learning plan for current user
// Body should contain: dreamJob, readiness, skillGaps, recommendations, roadmap
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    if (!body?.dreamJob || !body?.readiness) {
      return NextResponse.json({ ok: false, error: 'dreamJob and readiness are required' }, { status: 400 })
    }

    const doc = {
      userId: new ObjectId(auth.id),
      dreamJob: String(body.dreamJob),
      readiness: body.readiness,
      skillGaps: Array.isArray(body.skillGaps) ? body.skillGaps : [],
      recommendations: Array.isArray(body.recommendations) ? body.recommendations : [],
      roadmap: Array.isArray(body.roadmap) ? body.roadmap : [],
      createdAt: new Date(),
    }

    const col = await getCollection<any>('learning_plans')
    const r = await col.insertOne(doc)
    return NextResponse.json({ ok: true, id: r.insertedId })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
