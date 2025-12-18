import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import path from 'path'
import fs from 'fs/promises'
import { encryptBytes, decryptBytes } from '@/lib/crypto'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    const name = String(form.get('name') || (file ? file.name : 'attachment'))
    const mime = String(form.get('mime') || (file ? file.type : 'application/octet-stream'))
    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    // Server-side validation
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED = new Set([
      'image/png','image/jpeg','image/webp','image/gif','image/svg+xml',
      'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: 'File too large (max 10MB)' }, { status: 400 })
    if (!ALLOWED.has(mime)) return NextResponse.json({ ok: false, error: 'Unsupported file type' }, { status: 400 })

    const mode = String(form.get('mode') || '')
    const ab = await file.arrayBuffer()
    let ciphertext: Buffer
    let iv = ''
    let tag = ''
    let clientEncrypted = false
    if (mode === 'e2e') {
      // Client has already encrypted the file; store as-is
      ciphertext = Buffer.from(new Uint8Array(ab))
      iv = String(form.get('iv') || '')
      clientEncrypted = true
    } else {
      const enc = encryptBytes(new Uint8Array(ab))
      ciphertext = enc.ciphertext
      iv = enc.iv
      tag = enc.tag
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '_')
    const dir = path.join(process.cwd(), 'public', 'uploads', String(auth.id), 'messages')
    await fs.mkdir(dir, { recursive: true })
    const filename = `${Date.now()}-${safeName}.enc`
    const full = path.join(dir, filename)
    await fs.writeFile(full, ciphertext)

    const url = `/uploads/${auth.id}/messages/${filename}`

    // Persist metadata in attachments collection
    const attachments = await getCollection<any>('attachments')
    const doc = {
      ownerId: auth.id,
      url,
      name,
      mime,
      size: ciphertext.length,
      iv,
      tag,
      encrypted: true,
      clientEncrypted,
      messageId: null as string | null,
      createdAt: new Date(),
    }
    const ins = await attachments.insertOne(doc as any)

    return NextResponse.json({ ok: true, attachmentId: String(ins.insertedId), url, iv, tag, name, mime, size: ciphertext.length, clientEncrypted })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// GET /api/messages/attachments?messageId=...&download=1
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')
    const download = searchParams.get('download') === '1'
    if (!messageId) return NextResponse.json({ ok: false, error: 'messageId is required' }, { status: 400 })
    let _id: ObjectId
    try { _id = new ObjectId(messageId) } catch { return NextResponse.json({ ok: false, error: 'invalid messageId' }, { status: 400 }) }

    const messages = await getCollection<any>('messages')
    const msg = await messages.findOne({ _id })
    if (!msg || !msg.attachment || !msg.attachment.url || !msg.attachment.iv || !msg.attachment.tag) {
      return NextResponse.json({ ok: false, error: 'Attachment not found' }, { status: 404 })
    }
    // Authorization: only sender or recipient may access
    if (String(msg.senderId) !== auth.id && String(msg.recipientId) !== auth.id && auth.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const absPath = path.join(process.cwd(), 'public', msg.attachment.url)
    const data = await fs.readFile(absPath)

    // If clientEncrypted, stream raw ciphertext; client will decrypt
    const payload = msg.attachment.clientEncrypted ? data : decryptBytes(data, String(msg.attachment.iv), String(msg.attachment.tag))

    const headers: Record<string, string> = {
      'Content-Type': msg.attachment.mime || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    }
    if (download) {
      const fname = (msg.attachment.name || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_')
      headers['Content-Disposition'] = `attachment; filename="${fname}` + (msg.attachment.clientEncrypted ? '' : '') + `"`
    }
    return new NextResponse(payload, { headers })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
