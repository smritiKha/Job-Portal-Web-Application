import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import jwt from 'jsonwebtoken'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { logAudit } from '@/lib/audit'
import path from 'path'
import fs from 'fs/promises'

function guessMime(p: string) {
  const ext = p.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'svg': return 'image/svg+xml'
    case 'webp': return 'image/webp'
    case 'txt': return 'text/plain; charset=utf-8'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default: return 'application/octet-stream'
  }
}

export async function GET(req: NextRequest) {
  try {
    let auth = await getAuthUser(req)

    const { searchParams } = new URL(req.url)
    const rawPath = searchParams.get('path') // expected like /uploads/{userId}/{file}
    const download = searchParams.get('download') === '1'
    const qsToken = searchParams.get('token')

    // Fallback: if no Authorization header present, accept token provided via query string
    if (!auth && qsToken) {
      const JWT_SECRET = process.env.JWT_SECRET
      if (!JWT_SECRET) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      try {
        const payload = jwt.verify(qsToken, JWT_SECRET) as { sub: string; role: 'admin' | 'employer' | 'job_seeker' }
        const users = await getCollection('users')
        const user = await users.findOne({ _id: new ObjectId(payload.sub) })
        if (user) auth = { id: String(user._id), role: payload.role as any }
      } catch {}
    }

    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    if (!rawPath || !rawPath.startsWith('/uploads/')) {
      return NextResponse.json({ ok: false, error: 'Invalid path' }, { status: 400 })
    }

    // Enforce ownership: path must include /uploads/{userId}/...
    const parts = rawPath.split('/') // ['', 'uploads', '{userId}', 'file']
    const ownerId = parts[2]
    if (!ownerId) return NextResponse.json({ ok: false, error: 'Invalid path' }, { status: 400 })

    if (auth.role !== 'admin' && auth.id !== ownerId) {
      // Additional allowance: employers can access applicant files if the
      // applicant has applied to one of their jobs
      let allowed = false
      if (auth.role === 'employer') {
        try {
          const applications = await getCollection<any>('applications')
          const agg = await (applications as any).aggregate([
            { $match: { userId: new ObjectId(ownerId) } },
            { $limit: 50 },
            {
              $lookup: {
                from: 'jobs',
                localField: 'jobId',
                foreignField: '_id',
                as: 'job'
              }
            },
            { $unwind: '$job' },
            { $match: { 'job.createdBy': new ObjectId(auth.id) } },
            { $limit: 1 },
          ]).toArray()
          allowed = Array.isArray(agg) && agg.length > 0
        } catch {}
      }
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    // Resolve absolute path under project root (files are stored under public/uploads)
    const absPath = path.join(process.cwd(), 'public', rawPath)
    // Prevent path traversal escaping uploads dir
    const uploadsRoot = path.join(process.cwd(), 'public', 'uploads')
    if (!absPath.startsWith(uploadsRoot)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const data = await fs.readFile(absPath)
    const mime = guessMime(absPath)
    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'private, no-store',
    }
    if (download) {
      const filename = path.basename(absPath)
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }
    // Non-blocking audit log
    await logAudit({
      actorId: auth.id,
      actorRole: auth.role,
      action: 'file_proxy_access',
      targetType: 'file',
      targetId: absPath,
      meta: { ownerId, download }
    })
    return new NextResponse(new Uint8Array(data), { headers })
  } catch (err: any) {
    const msg = err?.code === 'ENOENT' ? 'File not found' : (err?.message || String(err))
    const status = err?.code === 'ENOENT' ? 404 : 500
    return NextResponse.json({ ok: false, error: msg }, { status })
  }
}
