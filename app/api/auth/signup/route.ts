import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { broker } from '@/lib/events'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

interface SignupBody {
  email: string
  password: string
  name: string
  role: 'admin' | 'employer' | 'job_seeker'
  companyName?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SignupBody>
    if (!body?.email || !body?.password || !body?.name || !body?.role) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const usersCol = await getCollection<any>('users')

    const existing = await usersCol.findOne({ email: body.email })
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    const userDoc: any = {
      email: body.email,
      name: body.name,
      role: body.role,
      passwordHash,
      createdAt: new Date(),
      status: 'active', // Auto-approve all new users
      emailVerified: false,
    }
    if (body.role === 'employer' && body.companyName) {
      userDoc.companyName = body.companyName
    }

    const result = await usersCol.insertOne(userDoc)

    const JWT_SECRET = process.env.JWT_SECRET
    if (!JWT_SECRET) {
      return NextResponse.json({ ok: false, error: 'Server misconfigured: missing JWT_SECRET' }, { status: 500 })
    }

    const isPending = userDoc.status === 'pending'
    const token = isPending ? null : jwt.sign({ sub: String(result.insertedId), role: body.role }, JWT_SECRET, { expiresIn: '7d' })

    // Create email verification token and send email (non-blocking for response timing)
    try {
      const verifications = await getCollection<any>('email_verifications')
      // Invalidate previous tokens for this email if any (should not exist for new users)
      await verifications.deleteMany({ userId: result.insertedId })

      const vtoken = crypto.randomBytes(32).toString('hex')
      const verificationDoc = {
        userId: result.insertedId,
        token: vtoken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        used: false,
      }
      await verifications.insertOne(verificationDoc as any)

      // Build verify URL similar to forgot route
      const headers = (req as any).headers || new Headers()
      const appBase = (process.env.APP_BASE_URL || '').replace(/\/$/, '')
      const origin = (headers.get?.('origin') || headers.get?.('referer') || '').replace(/\/$/, '')
      const host = headers.get?.('host')
      const baseUrl = appBase || origin || (host ? `http://${host}` : '')
      const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(vtoken)}`

      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env as Record<string, string | undefined>
      if (SMTP_HOST && SMTP_PORT && SMTP_FROM) {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465,
          auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        })
        const html = `
          <div style="font-family:Arial,sans-serif; line-height:1.6;">
            <h2>Verify your email</h2>
            <p>Welcome to Job Portal, ${userDoc.name}!</p>
            <p>Please confirm your email by clicking the button below.</p>
            <p><a href="${verifyUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Verify Email</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>This link expires in 24 hours.</p>
          </div>
        `
        await transporter.sendMail({ from: SMTP_FROM, to: userDoc.email, subject: 'Verify your email', html })
      } else {
        // Dev fallback with Ethereal
        try {
          const testAccount = await nodemailer.createTestAccount()
          const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
          })
          const info = await transporter.sendMail({
            from: 'Job Portal <no-reply@example.com>',
            to: userDoc.email,
            subject: 'Verify your email',
            html: `
              <div style="font-family:Arial,sans-serif; line-height:1.6;">
                <h2>Verify your email</h2>
                <p>Welcome to Job Portal, ${userDoc.name}!</p>
                <p><a href="${verifyUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Verify Email</a></p>
                <p>Or copy and paste: <a href="${verifyUrl}">${verifyUrl}</a></p>
              </div>
            `,
          })
          // Attach preview URL to a debug collection for easier QA (optional, non-blocking)
          const previewUrl = nodemailer.getTestMessageUrl(info)
          if (previewUrl) {
            try {
              const debugCol = await getCollection<any>('debug_email_previews')
              await debugCol.insertOne({ type: 'verify-email', userId: result.insertedId, previewUrl, createdAt: new Date() })
            } catch {}
          }
        } catch {}
      }
    } catch (e) {
      console.error('Signup email verification error:', e)
    }

    // Realtime: broadcast user.created to admins
    try {
      broker.publish({ type: 'user.created', toRole: 'admin', payload: { id: String(result.insertedId), user: { ...userDoc, _id: result.insertedId } } })
    } catch {}

    // Notify admins about new user signup (non-blocking)
    try {
      const usersCol2 = await getCollection<any>('users')
      const admins = await usersCol2.find({ role: 'admin' }).project({ _id: 1 }).toArray()
      if (admins.length) {
        const notiCol = await getCollection<any>('notifications')
        const docs = admins.map((a: any) => ({
          userId: a._id,
          type: 'user',
          title: 'New user signed up',
          message: `${body.name} (${body.email}) created an account as ${body.role}.`,
          url: `/admin/users?open=${String(result.insertedId)}`,
          icon: null,
          read: false,
          createdAt: new Date(),
        }))
        if (docs.length) await (notiCol as any).insertMany(docs)
      }
    } catch {}

    // Audit: user signup
    try {
      const headers = (req as any).headers || new Headers()
      await logAudit({
        actorId: String(result.insertedId),
        actorRole: body.role as any,
        action: 'auth_signup',
        targetType: 'user',
        targetId: String(result.insertedId),
        meta: {
          email: body.email,
          headers: {
            'User-Agent': headers.get('user-agent') || null,
            'X-Forwarded-For': headers.get('x-forwarded-for') || null,
            'X-Real-IP': headers.get('x-real-ip') || null,
          },
        },
      })
    } catch {}

    const { passwordHash: _, ...safeUser } = { _id: result.insertedId, ...userDoc }
    if (isPending) {
      // Do not auto-sign-in pending users
      return NextResponse.json({ ok: true, pending: true, message: 'Check your email to verify your address. Your account is pending admin approval.', user: { id: String(result.insertedId), ...safeUser } }, { status: 202 })
    }
    return NextResponse.json({ ok: true, token, user: { id: String(result.insertedId), ...safeUser } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
