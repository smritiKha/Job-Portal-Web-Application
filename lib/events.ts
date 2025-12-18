import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export type RealtimeEvent = {
  type: string
  payload?: any
  at?: number
  // Optional audience routing
  toRole?: 'admin' | 'employer' | 'job_seeker'
  toUserId?: string
}

type Client = {
  id: string
  write: (evt: RealtimeEvent) => void
  roles?: Array<'admin' | 'employer' | 'job_seeker'>
  userId?: string
}

type Broker = {
  subscribe: (client: Client) => () => void
  publish: (evt: RealtimeEvent) => void
  clients: Map<string, Client>
}

// Ensure a singleton broker across hot reloads
const g = globalThis as any
if (!g.__realtime_broker) {
  const clients = new Map<string, Client>()
  const broker: Broker = {
    clients,
    subscribe(client: Client) {
      clients.set(client.id, client)
      return () => {
        clients.delete(client.id)
      }
    },
    publish(evt: RealtimeEvent) {
      const e = { ...evt, at: Date.now() }
      for (const [, c] of clients) {
        try {
          // Optional routing by role or userId
          if (e.toUserId && c.userId && e.toUserId !== c.userId) continue
          if (e.toRole && (!c.roles || !c.roles.includes(e.toRole))) continue
          c.write(e)
        } catch {
          // ignore write errors
        }
      }
    },
  }
  g.__realtime_broker = broker
}

export const broker: Broker = g.__realtime_broker as Broker

export function verifyTokenFromUrl(req: NextRequest): { id: string; role: 'admin' | 'employer' | 'job_seeker' } | null {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const secret = process.env.JWT_SECRET
    if (!token || !secret) return null
    const payload = jwt.verify(token, secret) as { sub: string; role: 'admin' | 'employer' | 'job_seeker' }
    return { id: payload.sub, role: payload.role }
  } catch {
    return null
  }
}
