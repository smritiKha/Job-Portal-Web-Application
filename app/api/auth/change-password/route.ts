import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/change-password
// body: { currentPassword: string, newPassword: string }
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json().catch(() => ({}))
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ ok: false, error: 'currentPassword and newPassword are required' }, { status: 400 })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const users = await getCollection('users')
    const user = await (users as any).findOne({ _id: new ObjectId(String(auth.id)) })
    if (!user) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })

    // Backward-compat: support legacy 'password' or current 'passwordHash'
    const currentHash: string | undefined = user.passwordHash || user.password
    if (!currentHash) return NextResponse.json({ ok: false, error: 'Password not set' }, { status: 400 })

    const match = await bcrypt.compare(currentPassword, currentHash)
    if (!match) return NextResponse.json({ ok: false, error: 'Current password is incorrect' }, { status: 400 })

    const newHash = await bcrypt.hash(newPassword, 10)
    await (users as any).updateOne(
      { _id: new ObjectId(String(auth.id)) },
      { $set: { passwordHash: newHash, updatedAt: new Date() }, $unset: { password: "" } }
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
