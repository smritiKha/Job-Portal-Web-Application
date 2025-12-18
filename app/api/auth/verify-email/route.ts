import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = (searchParams.get('token') || '').trim()
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 })
    }

    const verifications = await getCollection<any>('email_verifications')
    const doc = await verifications.findOne({ token })
    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 })
    }
    if (doc.used) {
      return NextResponse.json({ ok: false, error: 'Token already used' }, { status: 400 })
    }
    if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'Token expired' }, { status: 400 })
    }

    const users = await getCollection<any>('users')
    const userId = typeof doc.userId === 'string' ? new ObjectId(doc.userId) : new ObjectId(doc.userId)

    // Mark user as verified
    const update: any = { $set: { emailVerified: true, emailVerifiedAt: new Date() } }
    // Optionally activate pending accounts upon email verification
    const user = await users.findOne({ _id: userId })
    if (user && user.status === 'pending') {
      update.$set.status = 'active'
    }
    await users.updateOne({ _id: userId }, update)

    await verifications.updateOne({ _id: doc._id }, { $set: { used: true, usedAt: new Date() } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
