import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { broker } from '@/lib/events'
import path from 'path'
import fs from 'fs/promises'
import { ObjectId } from 'mongodb'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const dir = path.join(process.cwd(), 'public', 'uploads', auth.id)
    await fs.mkdir(dir, { recursive: true })
    const filename = `company-logo.${ext}`
    const fullPath = path.join(dir, filename)
    await fs.writeFile(fullPath, buffer)
    const publicPath = `/uploads/${auth.id}/${filename}`

    const users = await getCollection('users')
    await users.updateOne({ _id: new ObjectId(auth.id) }, { $set: { companyLogo: publicPath, updatedAt: new Date() } })

    const payload = { id: String(auth.id), fields: ['companyLogo'] }
    broker.publish({ type: 'user.updated', payload, toUserId: String(auth.id) })
    broker.publish({ type: 'user.updated', payload, toRole: 'admin' })

    return NextResponse.json({ ok: true, url: publicPath })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
