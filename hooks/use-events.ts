"use client"

import { useEffect } from 'react'

export type UseEventsOptions = {
  events: string[]
  onEvent: (evt: MessageEvent<any>) => void
}

export function useEvents({ events, onEvent }: UseEventsOptions) {
  useEffect(() => {
    let es: EventSource | null = null
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('job_portal_token') : null
      const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events'
      es = new EventSource(url)
      for (const ev of events) {
        es.addEventListener(ev, onEvent as any)
      }
      // Optional: listen to hello/ping for debugging
      es.addEventListener('sse.hello', () => {})
      es.addEventListener('sse.ping', () => {})
    } catch {
      // ignore
    }
    return () => {
      if (es) {
        try {
          for (const ev of events) {
            es.removeEventListener(ev, onEvent as any)
          }
          es.close()
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
