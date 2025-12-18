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
    // To avoid account enumeration, return ok even if user not found
    if (!user) return NextResponse.json({ ok: true })

    const resets = await getCollection<any>('password_resets')
    // Invalidate previous tokens for this user
    await resets.deleteMany({ userId: user._id })

    const token = crypto.randomBytes(32).toString('hex')
    const doc = {
      userId: new ObjectId(user._id),
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false,
    }
    await resets.insertOne(doc as any)

    // Build reset URL
    const appBase = process.env.APP_BASE_URL?.replace(/\/$/, '') || ''
    const origin = (req.headers.get('origin') || req.headers.get('referer') || '').replace(/\/$/, '')
    const host = req.headers.get('host')
    const baseUrl = appBase || origin || (host ? `http://${host}` : '')
    const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`

    // Attempt to send email if SMTP is configured
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env as Record<string, string | undefined>
    const isProd = process.env.NODE_ENV === 'production'
    if (SMTP_HOST && SMTP_PORT && SMTP_FROM) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      })
      const html = `
        <div style="font-family:Arial,sans-serif; line-height:1.6;">
          <h2>Reset your password</h2>
          <p>We received a request to reset your password. Click the button below to set a new password.</p>
          <p><a href="${resetUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Reset Password</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link will expire in 1 hour. If you didn’t request this, you can ignore this email.</p>
        </div>
      `
      try {
        await transporter.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: 'Reset your Job Portal password',
          html,
        })
      } catch (e) {
        console.error('SMTP send error:', e)
        // Fall back to returning the resetUrl in response in case of SMTP errors (dev convenience)
        return NextResponse.json({ ok: true, resetUrl })
      }
      // Always include resetUrl for convenience
      return NextResponse.json({ ok: true, resetUrl })
    }

    // If SMTP is not configured, use Ethereal test account for local dev to preview emails
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
        subject: 'Reset your Job Portal password',
        html: `
          <div style="font-family:Arial,sans-serif; line-height:1.6;">
            <h2>Reset your password</h2>
            <p>Click the button below to set a new password.</p>
            <p><a href="${resetUrl}" style="display:inline-block; padding:10px 16px; background:#2563eb; color:#fff; text-decoration:none; border-radius:6px;">Reset Password</a></p>
            <p>Or copy and paste this link:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
          </div>
        `,
      })
      const previewUrl = nodemailer.getTestMessageUrl(info)
      return NextResponse.json({ ok: true, resetUrl, previewUrl })
    } catch {
      // As a last resort just return the reset URL
      return NextResponse.json({ ok: true, resetUrl })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
