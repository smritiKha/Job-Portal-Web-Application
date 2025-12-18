import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// PATCH /api/notifications/[id] - mark a single notification as read for current user
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const col = await getCollection<any>('notifications')
  const r = await (col as any).updateOne({ _id, userId: new ObjectId(auth.id) }, { $set: { read: true, updatedAt: new Date() } })
  if (!r.matchedCount) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
