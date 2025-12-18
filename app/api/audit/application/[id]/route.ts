import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/api-auth'

function oid(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// GET /api/audit/application/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id)
  if (!_id) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })

  const auth = await getAuthUser(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Basic access control: allow job seeker, employer, admin to view logs
  // In a more strict impl, verify ownership/visibility based on application doc
  const col = await getCollection<any>('audit_logs')
  const logs = await (col as any)
    .find({ targetType: 'application', targetId: String(_id) })
    .sort({ createdAt: 1 })
    .toArray()

  return NextResponse.json({ ok: true, logs })
}
