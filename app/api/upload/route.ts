import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import path from 'path'
import fs from 'fs/promises'
import { broker } from '@/lib/events'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/upload
// form-data: file: File, category: 'resume' | 'coverLetter' | 'portfolio' | 'certificate' | 'other'
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as unknown as File | null
    const categoryRaw = String(form.get('category') || '').trim().toLowerCase()
    const category = (['resume','coverletter','portfolio','certificate','other'].includes(categoryRaw) ? categoryRaw : 'other') as 'resume' | 'coverletter' | 'portfolio' | 'certificate' | 'other'

    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalName = (file as any).name || 'document'
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, '_')
    const ext = (safeName.split('.').pop() || 'dat').toLowerCase()
    const userDir = path.join(process.cwd(), 'public', 'uploads', String(auth.id))
    await fs.mkdir(userDir, { recursive: true })
    const ts = Date.now()
    const baseName = category === 'resume' ? 'resume' : (category === 'coverletter' ? 'cover-letter' : safeName.replace(`.${ext}`, ''))
    const filename = `${baseName}-${ts}.${ext}`
    const fullPath = path.join(userDir, filename)
    await fs.writeFile(fullPath, buffer)
    const publicUrl = `/uploads/${String(auth.id)}/${filename}`

    // Update user documents in DB
    const users = await getCollection('users')

    // Choose a human-friendly display name based on category, keep originalName as fallback
    const displayName = (
      category === 'resume' ? `Resume.${ext}` :
      category === 'coverletter' ? `Cover Letter.${ext}` :
      category === 'portfolio' ? `Portfolio.${ext}` :
      category === 'certificate' ? `Certificate.${ext}` :
      originalName
    )

    const docEntry: any = {
      _id: new ObjectId(),
      url: publicUrl,
      name: displayName,
      uploadedAt: new Date(),
      size: (file as any).size ?? buffer.byteLength,
      type: category,
    }

    const updateOps: any = { $set: { updatedAt: new Date() } }

    if (category === 'resume') {
      // set current resume, maintain history in documents.resumes
      updateOps.$set['documents.resume'] = docEntry
      updateOps.$push = { ...(updateOps.$push || {}), 'documents.resumes': docEntry }
    } else if (category === 'coverletter') {
      // set current cover letter, maintain history
      updateOps.$set['documents.coverLetter'] = docEntry
      updateOps.$push = { ...(updateOps.$push || {}), 'documents.coverLetters': docEntry }
    } else if (category === 'portfolio') {
      updateOps.$set['documents.portfolio'] = docEntry
    } else if (category === 'certificate') {
      updateOps.$push = { ...(updateOps.$push || {}), 'documents.certificates': docEntry }
    } else {
      // other
      updateOps.$push = { ...(updateOps.$push || {}), 'documents.other': docEntry }
    }

    await (users as any).updateOne({ _id: new ObjectId(String(auth.id)) }, updateOps)

    // Emit realtime update so Profile and other clients refresh
    const fields: string[] = ['documents']
    const payload = { id: String(auth.id), fields }
    try { broker.publish({ type: 'user.updated', payload, toRole: 'admin' }) } catch {}
    try { broker.publish({ type: 'user.updated', payload, toUserId: String(auth.id) }) } catch {}

    // Audit
    try {
      await logAudit({
        actorId: String(auth.id),
        actorRole: auth.role,
        action: 'user_document_uploaded',
        targetType: 'user',
        targetId: String(auth.id),
        meta: { category, url: publicUrl, name: originalName }
      })
    } catch {}

    return NextResponse.json({ ok: true, url: publicUrl, name: originalName })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
