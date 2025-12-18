import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

interface EmployerDoc {
  _id?: ObjectId
  name: string
  website?: string
  description?: string
  createdAt?: Date
}

// GET /api/employers -> list employers
export async function GET() {
  const col = await getCollection<EmployerDoc>('employers')
  const employers = await col.find({}).sort({ createdAt: -1 }).limit(50).toArray()
  return NextResponse.json({ ok: true, employers })
}

// POST /api/employers -> create employer
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<EmployerDoc>
    if (!body || !body.name) {
      return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 })
    }
    const col = await getCollection<EmployerDoc>('employers')
    const doc: EmployerDoc = {
      name: body.name,
      website: body.website || '',
      description: body.description || '',
      createdAt: new Date(),
    }
    const result = await col.insertOne(doc as any)
    return NextResponse.json({ ok: true, id: result.insertedId, doc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
