import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const uid = params?.id
    if (!uid) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    let _id: ObjectId
    try { _id = new ObjectId(uid) } catch { return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 }) }
    const users = await getCollection<any>('users')
    const user = await users.findOne({ _id }, { projection: { publicKey: 1, publicKeyFormat: 1 } })
    return NextResponse.json({ ok: true, publicKey: user?.publicKey || null, format: user?.publicKeyFormat || null })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
