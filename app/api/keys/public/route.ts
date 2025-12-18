import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

// GET: return current user's public key (if any)
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const users = await getCollection<any>('users')
    const user = await users.findOne({ _id: new ObjectId(auth.id) }, { projection: { publicKey: 1 } })
    return NextResponse.json({ ok: true, publicKey: user?.publicKey || null })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// POST: { publicKey: string, format?: 'spki' } store user's public key
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (!body?.publicKey || typeof body.publicKey !== 'string') {
      return NextResponse.json({ ok: false, error: 'publicKey is required' }, { status: 400 })
    }
    const users = await getCollection<any>('users')
    await users.updateOne(
      { _id: new ObjectId(auth.id) },
      { $set: { publicKey: body.publicKey, publicKeyFormat: body.format || 'spki', publicKeyUpdatedAt: new Date() } },
      { upsert: false }
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
