import { useEffect, useRef } from 'react'

/**
 * Calls `fn` immediately and then every `intervalMs`.
 * Stops polling when the component unmounts or when offline.
 * Resumes polling when back online.
 */
export function useAutoRefresh(fn: () => void, intervalMs: number = 30_000) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer) return
      fnRef.current()
      timer = setInterval(() => {
        if (navigator.onLine) fnRef.current()
      }, intervalMs)
    }

    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    const handleOnline = () => start()
    const handleOffline = () => stop()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) start()

    return () => {
      stop()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [intervalMs])
}
