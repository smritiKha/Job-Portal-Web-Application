"use client"

import { useEffect, useState } from 'react'

export function useSseStatus() {
  const [connected, setConnected] = useState<boolean>(false)

  useEffect(() => {
    let es: EventSource | null = null
    let timer: any
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'
      es = new EventSource(url)
      es.addEventListener('open', () => setConnected(true))
      es.addEventListener('error', () => setConnected(false))
      es.addEventListener('sse.ping', () => setConnected(true))
      // Fallback heartbeat if no ping is received after a while
      let last = Date.now()
      const onPing = () => { last = Date.now() }
      es.addEventListener('sse.ping', onPing)
      timer = setInterval(() => {
        if (Date.now() - last > 30000) setConnected(false)
      }, 15000)
    } catch {
      setConnected(false)
    }
    return () => {
      if (timer) clearInterval(timer)
      if (es) es.close()
    }
  }, [])

  return { connected }
}
