import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

function parseObjectId(id: string) {
  try { return new ObjectId(id) } catch { return null }
}

// DELETE /api/training/plans/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const oid = parseObjectId(params.id)
    if (!oid) return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })

    const col = await getCollection<any>('learning_plans')
    const result = await col.deleteOne({ _id: oid, userId: new ObjectId(auth.id) })
    if (!result.deletedCount) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
