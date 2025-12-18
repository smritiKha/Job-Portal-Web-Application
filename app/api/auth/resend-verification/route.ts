import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { email?: string }
    const email = (body.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 })
    }

    const users = await getCollection<any>('users')
    const user = await users.findOne({ email })
    // Do not leak whether user exists
    if (!user) return NextResponse.json({ ok: true })

    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: 'Email already verified' })
    }

    const verifications = await getCollection<any>('email_verifications')
    await verifications.deleteMany({ userId: user._id })

    const token = crypto.randomBytes(32).toString('hex')
    await verifications.insertOne({
      userId: new ObjectId(user._id),
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      used: false,
    } as any)

    const appBase = (process.env.APP_BASE_URL || '').replace(/\/$/, '')
    const origin = (req.headers.get('origin') || req.headers.get('referer') || '').replace(/\/$/, '')
    const host = req.headers.get('host')
    const baseUrl = appBase || origin || (host ? `http://${host}` : '')
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`

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
          <p>Please confirm your email by clicking the button below.</p>
          <p><a href="${verifyUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Verify Email</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>This link expires in 24 hours.</p>
        </div>
      `
      await transporter.sendMail({ from: SMTP_FROM, to: email, subject: 'Verify your email', html })
      return NextResponse.json({ ok: true, verifyUrl })
    }

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
        to: email,
        subject: 'Verify your email',
        html: `
          <div style="font-family:Arial,sans-serif; line-height:1.6;">
            <h2>Verify your email</h2>
            <p><a href="${verifyUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Verify Email</a></p>
            <p>Or copy and paste: <a href="${verifyUrl}">${verifyUrl}</a></p>
          </div>
        `,
      })
      const previewUrl = nodemailer.getTestMessageUrl(info)
      return NextResponse.json({ ok: true, verifyUrl, previewUrl })
    } catch {
      return NextResponse.json({ ok: true, verifyUrl })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
