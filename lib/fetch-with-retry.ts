export type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  timeoutMs?: number
  retryOnStatuses?: number[]
}

export async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit = {}, opts: RetryOptions = {}) {
  const attempts = opts.attempts ?? 3
  const baseDelay = opts.baseDelayMs ?? 500
  const timeoutMs = opts.timeoutMs ?? 30000
  const retryOn = new Set(opts.retryOnStatuses ?? [408, 429, 500, 502, 503, 504])

  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok && retryOn.has(res.status) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)))
        continue
      }
      return res
    } catch (e: any) {
      clearTimeout(timer)
      lastErr = e
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)))
        continue
      }
      throw e
    }
  }
  throw lastErr
}
