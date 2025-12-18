import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

interface EmployerDoc {
  _id?: ObjectId
  name: string
  website?: string
  description?: string
  createdAt?: Date
}

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// GET /api/employers/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<EmployerDoc>('employers')
  const doc = await col.findOne({ _id })
  if (!doc) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, employer: doc })
}

// PUT /api/employers/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const body = await req.json()
  const update: any = {}
  if (typeof body.name === 'string') update.name = body.name
  if (typeof body.website === 'string') update.website = body.website
  if (typeof body.description === 'string') update.description = body.description
  if (!Object.keys(update).length) return NextResponse.json({ ok: false, error: 'no valid fields' }, { status: 400 })
  const col = await getCollection<EmployerDoc>('employers')
  const r = await col.updateOne({ _id }, { $set: update })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, modifiedCount: r.modifiedCount })
}

// DELETE /api/employers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const col = await getCollection<EmployerDoc>('employers')
  const r = await col.deleteOne({ _id })
  if (!r.deletedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, deletedCount: r.deletedCount })
}
