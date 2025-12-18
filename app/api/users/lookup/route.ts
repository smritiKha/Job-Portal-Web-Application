import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { getCollection } from '@/lib/db'

// GET /api/users/lookup?email= OR ?q=
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req)
    if (!auth) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const q = searchParams.get('q')
    const users = await getCollection<any>('users')

    // Suggestions flow
    if (q) {
      const term = String(q).trim().toLowerCase()
      if (!term) return NextResponse.json({ ok: true, suggestions: [] })
      // Only suggest opposite role to enforce allowed messaging pairs
      const wantRole = auth.role === 'employer' ? 'job_seeker' : auth.role === 'job_seeker' ? 'employer' : null
      const roleFilter = wantRole ? { role: wantRole } : {}
      const cursor = users.find({
        ...roleFilter,
        $or: [
          { email: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        ]
      }, { projection: { name: 1, email: 1, avatar: 1, role: 1 } })
      const docs = await cursor.limit(5).toArray()
      const suggestions = docs.map(u => ({ id: String(u._id), name: u.name || '', email: u.email || '', avatar: u.avatar || '', role: u.role || '' }))
      return NextResponse.json({ ok: true, suggestions })
    }

    // Exact lookup by email
    if (!email) return NextResponse.json({ ok: false, error: 'email or q is required' }, { status: 400 })
    const u = await users.findOne({ email: String(email).toLowerCase() }, { projection: { name: 1, email: 1, avatar: 1, role: 1 } })
    if (!u) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, user: { id: String(u._id), name: u.name || '', email: u.email || '', avatar: u.avatar || '', role: u.role || '' } })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 })
  }
}
