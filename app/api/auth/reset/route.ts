import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { token?: string; password?: string }
    const token = (body.token || '').trim()
    const password = (body.password || '').trim()
    if (!token || !password) {
      return NextResponse.json({ ok: false, error: 'Token and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const resets = await getCollection<any>('password_resets')
    const resetDoc = await resets.findOne({ token })
    if (!resetDoc || resetDoc.used) {
      return NextResponse.json({ ok: false, error: 'Invalid or used token' }, { status: 400 })
    }
    if (resetDoc.expiresAt && new Date(resetDoc.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: 'Token expired' }, { status: 400 })
    }

    const users = await getCollection<any>('users')
    const userId = new ObjectId(resetDoc.userId)
    const passwordHash = await bcrypt.hash(password, 10)
    const r = await users.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: new Date() } })
    if (!r.matchedCount) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    await resets.updateOne({ _id: resetDoc._id }, { $set: { used: true, usedAt: new Date() } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
