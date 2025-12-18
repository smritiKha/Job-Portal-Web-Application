import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'

// Basic User type for the sample
interface UserDoc {
  _id?: string
  email: string
  name?: string
  createdAt?: Date
}

// GET /api/users -> list users (limit 50)
export async function GET() {
  const usersCol = await getCollection<UserDoc>('users')
  const users = await usersCol
    .find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray()

  return NextResponse.json({ ok: true, users })
}

// POST /api/users -> create user
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<UserDoc>
    if (!body || !body.email) {
      return NextResponse.json({ ok: false, error: 'email is required' }, { status: 400 })
    }

    const usersCol = await getCollection<UserDoc>('users')

    const doc: UserDoc = {
      email: body.email,
      name: body.name || '',
      createdAt: new Date(),
    }

    const result = await usersCol.insertOne(doc as any)

    return NextResponse.json({ ok: true, id: result.insertedId, doc })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
