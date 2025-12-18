import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'

interface AdDoc {
  _id?: ObjectId
  title: string
  description?: string
  imageUrl?: string
  linkUrl?: string
  active?: boolean
  featured?: boolean
  startsAt?: Date | null
  endsAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
  createdBy?: ObjectId
}

// GET /api/ads -> list active ads (limit 10)
export async function GET(req: NextRequest) {
  const col = await getCollection<AdDoc>('ads')
  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'
  const now = new Date()
  const query: any = {}
  if (!all) {
    query.active = true
    query.$and = [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }, { startsAt: { $exists: false } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }, { endsAt: { $exists: false } }] },
    ]
  }
  const ads = await col.find(query).sort({ featured: -1, createdAt: -1 }).limit(10).toArray()
  return NextResponse.json({ ok: true, ads })
}

// POST /api/ads -> create ad (admin only)
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const doc: AdDoc = {
      title: String(body.title || '').trim(),
      description: typeof body.description === 'string' ? body.description : '',
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim() : undefined,
      linkUrl: typeof body.linkUrl === 'string' ? body.linkUrl.trim() : undefined,
      active: Boolean(body.active ?? true),
      featured: Boolean(body.featured ?? false),
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(auth.id),
    }
    if (!doc.title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    const col = await getCollection<AdDoc>('ads')
    const r = await col.insertOne(doc as any)
    return NextResponse.json({ ok: true, id: r.insertedId, doc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
