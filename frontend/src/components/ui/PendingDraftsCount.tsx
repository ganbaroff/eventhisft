import { useEffect, useState } from 'react'
import { draftIncidents, draftOperations } from '../../utils/offline'

export function PendingDraftsCount() {
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const [inc, ops] = await Promise.all([
      draftIncidents.getAll(),
      draftOperations.getAll(),
    ])
    const pending = [...inc, ...ops].filter((d) => d.syncState === 'PENDING_CONFIRMATION')
    setCount(pending.length)
  }

  useEffect(() => {
    refresh()
    // Refresh count every 30s and on reconnect
    const interval = setInterval(refresh, 30_000)
    window.addEventListener('online', refresh)
    return () => { clearInterval(interval); window.removeEventListener('online', refresh) }
  }, [])

  if (count === 0) return null

  return (
    <span className="nav-badge" title={`${count} pending draft(s) awaiting sync`}>
      {count}
    </span>
  )
}
