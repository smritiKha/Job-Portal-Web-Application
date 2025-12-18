import { NextRequest } from 'next/server'
import { broker, verifyTokenFromUrl } from '@/lib/events'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Optional: verify JWT from query so we know who's connecting
  const auth = verifyTokenFromUrl(req)

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const write = (evt: { type: string; payload?: any; at?: number }) => {
        const data = `event: ${evt.type}\n` + `data: ${JSON.stringify(evt)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Initial hello
      write({ type: 'sse.hello', payload: { ok: true, role: auth?.role, userId: auth?.id } })

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const unsubscribe = broker.subscribe({ id, write, roles: auth ? [auth.role] : undefined, userId: auth?.id })

      // Heartbeat to keep connection alive on proxies
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: sse.ping\n` + `data: {"t":${Date.now()}}\n\n`))
      }, 25000)

      // Clean up on cancel
      const close = () => {
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch {}
      }

      ;(req as any).signal?.addEventListener('abort', close)
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
