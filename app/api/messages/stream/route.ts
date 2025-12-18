import { NextRequest } from 'next/server'
import { broker, verifyTokenFromUrl } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = verifyTokenFromUrl(req)
  if (!auth) {
    return new Response('Unauthorized', { status: 401 })
  }

  const ts = new TransformStream()
  const writer = ts.writable.getWriter()
  const enc = new TextEncoder()

  // Helper to write SSE event
  function write(data: any) {
    const payload = `data: ${JSON.stringify(data)}\n\n`
    return writer.write(enc.encode(payload))
  }
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    try { clearInterval(heartbeat) } catch {}
    try { unsubscribe?.() } catch {}
    try { writer.close() } catch {}
  }
  function safeWrite(data: any) {
    return write(data).catch(() => { cleanup() })
  }

  const clientId = `${auth.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const unsubscribe = broker.subscribe({
    id: clientId,
    userId: auth.id,
    roles: [auth.role],
    write: (evt) => { safeWrite(evt) }
  })

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    writer.write(enc.encode(': ping\n\n')).catch(() => { cleanup() })
  }, 25000)

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Allow browser to receive events immediately
    'X-Accel-Buffering': 'no',
  })

  // Clean up on client disconnect using the request's abort signal
  try {
    // NextRequest exposes an AbortSignal for when the client disconnects
    // When aborted, clean up resources
    ;(req as any).signal?.addEventListener('abort', cleanup)
  } catch {}

  // Send initial retry directive and open event
  try { await writer.write(enc.encode('retry: 5000\n\n')) } catch { cleanup() }
  await safeWrite({ type: 'sse.open', payload: { id: clientId } })

  return new Response(ts.readable, { headers })
}
