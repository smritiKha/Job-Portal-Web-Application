import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { broker } from '@/lib/events'
import path from 'path'
import fs from 'fs/promises'
import { ObjectId } from 'mongodb'
import fsSync from 'fs'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalName = file.name || 'resume.pdf'
    const ext = (originalName.split('.').pop() || 'pdf').toLowerCase()
    const dir = path.join(process.cwd(), 'public', 'uploads', auth.id)
    await fs.mkdir(dir, { recursive: true })
    const filename = `resume.${ext}`
    const fullPath = path.join(dir, filename)
    await fs.writeFile(fullPath, buffer)
    const publicPath = `/uploads/${auth.id}/${filename}`

    const users = await getCollection('users')
    const doc = {
      _id: new ObjectId(),
      url: publicPath,
      name: originalName,
      uploadedAt: new Date(),
      size: (file as any).size ?? buffer.byteLength,
      type: 'resume'
    } as any
    await users.updateOne(
      { _id: new ObjectId(auth.id) },
      { 
        $push: { 'documents.resumes': doc },
        $set: { 'documents.resume': doc, updatedAt: new Date() }
      }
    )

    // Emit realtime event
    const payload = { id: String(auth.id), fields: ['documents.resume'] }
    broker.publish({ type: 'user.updated', payload, toUserId: String(auth.id) })
    broker.publish({ type: 'user.updated', payload, toRole: 'admin' })

    return NextResponse.json({ ok: true, resume: { id: String(doc._id), url: doc.url, name: doc.name, uploadedAt: doc.uploadedAt, size: doc.size } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}

// Set default resume by id
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const id = body?.id ? String(body.id) : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    const users = await getCollection('users')
    const user = await users.findOne({ _id: new ObjectId(auth.id) }) as any
    const list: any[] = Array.isArray(user?.documents?.resumes) ? user.documents.resumes : []
    const found = list.find((d: any) => String(d?._id) === id)
    if (!found) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    await users.updateOne({ _id: new ObjectId(auth.id) }, { $set: { 'documents.resume': found, updatedAt: new Date() } })
    return NextResponse.json({ ok: true, resume: { id: String(found._id), url: found.url, name: found.name } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
 
// Remove resume (optionally one of multiple)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const users = await getCollection('users')
    const url = new URL(req.url)
    const idParam = url.searchParams.get('id')
    const user = await users.findOne({ _id: new ObjectId(auth.id) }) as any
    const current = user?.documents?.resume
    const list: any[] = Array.isArray(user?.documents?.resumes) ? user.documents.resumes : []
    let target: any | null = null
    if (idParam) {
      target = list.find((d: any) => String(d?._id) === String(idParam)) || null
    } else {
      target = current || null
    }

    // Remove file on disk if present
    if (target?.url) {
      const publicUrl: string = String(target.url)
      const rel = publicUrl.startsWith('/uploads/') ? publicUrl.replace('/uploads/', '') : null
      if (rel) {
        const full = path.join(process.cwd(), 'public', 'uploads', rel)
        try {
          if (fsSync.existsSync(full)) await fs.unlink(full).catch(() => {})
        } catch {}
      }
    }

    if (idParam) {
      // Remove specific resume and adjust default if needed
      await (users as any).updateOne(
        { _id: new ObjectId(auth.id) },
        { $pull: { 'documents.resumes': { _id: new ObjectId(String(idParam)) } }, $set: { updatedAt: new Date() } }
      )
      const fresh = await users.findOne({ _id: new ObjectId(auth.id) }) as any
      const newList: any[] = Array.isArray(fresh?.documents?.resumes) ? fresh.documents.resumes : []
      if (current && String(current?._id) === String(idParam)) {
        const newDefault = newList[0] || null
        if (newDefault) {
          await users.updateOne({ _id: new ObjectId(auth.id) }, { $set: { 'documents.resume': newDefault, updatedAt: new Date() } })
        } else {
          await users.updateOne({ _id: new ObjectId(auth.id) }, { $unset: { 'documents.resume': "" }, $set: { updatedAt: new Date() } })
        }
      }
    } else {
      // Remove default resume
      await users.updateOne(
        { _id: new ObjectId(auth.id) },
        { $unset: { 'documents.resume': "" }, $set: { updatedAt: new Date() } }
      )
    }

    const payload = { id: String(auth.id), fields: ['documents.resume'] }
    broker.publish({ type: 'user.updated', payload, toUserId: String(auth.id) })
    broker.publish({ type: 'user.updated', payload, toRole: 'admin' })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
