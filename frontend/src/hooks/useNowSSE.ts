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
    const token = localStorage.getItem('access_token')
    if (!token) return

    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

    function connect() {
      if (esRef.current) {
        esRef.current.close()
      }

      // SSE with auth via URL param (EventSource doesn't support headers)
      const url = `${BASE}/sse/now?token=${encodeURIComponent(token!)}`
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
        // Reconnect after 5s if still online
        setTimeout(() => {
          if (navigator.onLine) connect()
        }, 5_000)
      }
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
      esRef.current?.close()
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { snapshot, connected }
}
