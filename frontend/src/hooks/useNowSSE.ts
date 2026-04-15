import { useEffect, useRef, useState } from 'react'

export interface NowSnapshot {
  escalated: number
  active: number
  total: number
  hasAttention: boolean
  lastUpdated: string
}

export function useNowSSE(): {
  snapshot: NowSnapshot | null
  connected: boolean
} {
  const [snapshot, setSnapshot] = useState<NowSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token')
    if (!accessToken) return

    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
    let cancelled = false

    // Exchange the access token for a short-lived SSE ticket (5 min TTL).
    // The ticket goes in the URL query string; the access token never does.
    async function fetchTicket(): Promise<string | null> {
      try {
        const res = await fetch(`${BASE}/auth/sse-ticket`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) return null
        const data = await res.json() as { ticket?: string }
        return data.ticket ?? null
      } catch {
        return null
      }
    }

    async function connect() {
      if (cancelled) return
      if (esRef.current) esRef.current.close()

      const ticket = await fetchTicket()
      if (cancelled) return
      if (!ticket) {
        setConnected(false)
        // Retry after 30s if the ticket mint failed (rate limit, transient).
        setTimeout(() => { if (navigator.onLine && !cancelled) connect() }, 30_000)
        return
      }

      const url = `${BASE}/sse/now?token=${encodeURIComponent(ticket)}`
      const es = new EventSource(url)
      esRef.current = es

      es.addEventListener('now-update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as NowSnapshot
          setSnapshot(data)
          setConnected(true)
        } catch { /* ignore parse error */ }
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Ticket expires in 5 min, so reconnect fetches a fresh one.
        setTimeout(() => {
          if (navigator.onLine && !cancelled) connect()
        }, 5_000)
      }

      // Proactively refresh ~30s before the 5-min TTL expires.
      const refreshTimer = setTimeout(() => {
        if (!cancelled && navigator.onLine) connect()
      }, 4.5 * 60_000)
      es.addEventListener('close', () => clearTimeout(refreshTimer))
    }

    if (navigator.onLine) connect()

    const handleOnline  = () => connect()
    const handleOffline = () => {
      esRef.current?.close()
      setConnected(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cancelled = true
      esRef.current?.close()
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { snapshot, connected }
}
