import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

interface LoginBody {
  email: string
  password: string
  remember?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<LoginBody>
    if (!body?.email || !body?.password) {
      return NextResponse.json({ ok: false, error: 'Missing email or password' }, { status: 400 })
    }

    const usersCol = await getCollection<any>('users')
    const user = await usersCol.findOne({ email: body.email })
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
    }

    // Backward-compat: allow legacy 'password' field as hash if present. If legacy is plaintext, migrate on-the-fly.
    const hashCandidate: string = user.passwordHash || user.password || ''
    let valid = false
    try {
      valid = !!hashCandidate && await bcrypt.compare(body.password, hashCandidate)
    } catch {}
    if (!valid && user.password && typeof user.password === 'string') {
      // If legacy stored password is PLAINTEXT and matches directly, treat as valid and migrate
      if (user.password === body.password) {
        valid = true
        const newHash = await bcrypt.hash(body.password, 10)
        const usersCol2 = await getCollection<any>('users')
        await usersCol2.updateOne({ _id: user._id }, { $set: { passwordHash: newHash, updatedAt: new Date() }, $unset: { password: "" } })
      }
    }
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if account is suspended (only check for suspended status, ignore pending status)
    const status = (user.status || 'active') as 'active' | 'pending' | 'suspended'
    if (status === 'suspended') {
      return NextResponse.json({ ok: false, error: 'Your account is suspended. Contact support.' }, { status: 403 })
    }

    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) {
      return NextResponse.json({ ok: false, error: 'Server misconfigured: missing JWT_SECRET' }, { status: 500 })
    }

    const expiresIn = body.remember ? '30d' : '1d'
    const token = jwt.sign({ sub: String(user._id), role: user.role }, JWT_SECRET, { expiresIn })

    const { passwordHash, password, ...safeUser } = user

    // Audit: successful login
    try {
      const headers = (req as any).headers || new Headers()
      await logAudit({
        actorId: String(user._id),
        actorRole: user.role,
        action: 'auth_login',
        targetType: 'user',
        targetId: String(user._id),
        meta: {
          email: user.email,
          headers: {
            'User-Agent': headers.get('user-agent') || null,
            'X-Forwarded-For': headers.get('x-forwarded-for') || null,
            'X-Real-IP': headers.get('x-real-ip') || null,
          },
        },
      })
    } catch {}
    return NextResponse.json({ ok: true, token, user: { id: String(user._id), ...safeUser } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
