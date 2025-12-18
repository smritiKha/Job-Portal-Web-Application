import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import jwt from 'jsonwebtoken'

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 401 })
    }

    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) {
      return NextResponse.json({ ok: false, error: 'Server misconfigured: missing JWT_SECRET' }, { status: 500 })
    }

    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string }

    const usersCol = await getCollection<any>('users')
    const user = await usersCol.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) })
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    const { passwordHash, ...safeUser } = user
    return NextResponse.json({ ok: true, user: { id: String(user._id), ...safeUser } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 401 })
  }
}
