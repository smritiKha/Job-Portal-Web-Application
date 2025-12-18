import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { getCollection } from '@/lib/db'
import { ObjectId } from 'mongodb'

export type AuthUser = {
  id: string
  role: 'admin' | 'employer' | 'job_seeker'
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: AuthUser['role'] }
    // Optionally verify user existence
    const users = await getCollection('users')
    const user = await users.findOne({ _id: new ObjectId(payload.sub) })
    if (!user) return null
    return { id: String(user._id), role: payload.role }
  } catch {
    return null
  }
}
