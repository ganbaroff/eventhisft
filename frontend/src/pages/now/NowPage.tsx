import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidentsApi } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useNowSSE } from '../../hooks/useNowSSE'
import { Incident } from '../../types'

export function NowPage() {
  const { context } = useAuthStore()
  const navigate = useNavigate()
  const [escalated, setEscalated] = useState<Incident[]>([])
  const [active, setActive]       = useState<Incident[]>([])
  const [loading, setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const online = navigator.onLine

  // SSE real-time snapshot (counts + attention flag)
  const { snapshot, connected: sseConnected } = useNowSSE()

  const load = useCallback(async () => {
    try {
      const [esc, act] = await Promise.all([
        incidentsApi.list({ status: 'ESCALATED' }),
        incidentsApi.list({ status: 'ACTIVE' }),
      ])
      setEscalated(esc)
      setActive(act)
      setLastRefresh(new Date())
    } catch { /* offline */ }
    finally { setLoading(false) }
  }, [])

  // Reload full list when SSE snapshot changes (escalated count changes)
  const prevEscRef = { current: -1 }
  if (snapshot && snapshot.escalated !== prevEscRef.current) {
    prevEscRef.current = snapshot.escalated
  }

  // Fallback polling at 30s if SSE not connected
  useAutoRefresh(load, sseConnected ? 60_000 : 30_000)

  const shift = context?.activeShift
  const totalOpen = escalated.length + active.length
  const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (loading) return (
    <div className="flex-center gap-12" style={{ padding: 60 }}>
      <div className="spinner" />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
        LOADING OPERATIONAL STATUS...
      </span>
    </div>
  )

  return (
    <div className="fade-in">
      {!online && (
        <div className="offline-banner">
          <span>⚠</span>
          OFFLINE — displaying last known state
          {lastRefresh && ` · last synced ${fmt(lastRefresh)}`}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">NOW</div>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {new Date().toLocaleString('en-GB', {
              weekday: 'short', day: '2-digit', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
            {lastRefresh && (
              <span style={{ opacity: 0.5 }}>
                · refreshed {fmt(lastRefresh)}
              </span>
            )}
            {sseConnected && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--success)', background: 'var(--success-dim)',
                border: '1px solid rgba(0,230,118,0.2)', borderRadius: 3,
                padding: '1px 5px', letterSpacing: '0.05em',
              }}>
                ⬡ LIVE
              </span>
            )}
          </div>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={load}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
        >
          ↺ REFRESH
        </button>
      </div>

      {/* Shift card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-center gap-16">
          <div>
            <div className="form-label" style={{ marginBottom: 5 }}>ACTIVE SHIFT</div>
            {shift ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>
                ⬡ {shift.name}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--warning)' }}>
                ⊘ No active shift — coordinators cannot submit operations
              </div>
            )}
          </div>
          {shift?.openedAt && (
            <div className="ml-auto" style={{ textAlign: 'right' }}>
              <div className="form-label" style={{ marginBottom: 4 }}>STARTED</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ESCALATED — top priority */}
      {escalated.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="form-label" style={{ marginBottom: 8, color: 'var(--danger)', letterSpacing: '0.1em' }}>
            ⚠ REQUIRES ATTENTION — {escalated.length} ESCALATED
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {escalated.map(inc => (
              <div
                key={inc.id}
                className="card card--clickable card--escalated"
                onClick={() => navigate(`/incidents/${inc.id}`)}
              >
                <div className="flex-center gap-10">
                  <span className="badge badge--escalated">ESCALATED</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, flex: 1 }}>
                    {inc.title}
                  </span>
                  <div className="flex-center gap-10">
                    {inc.zone?.name && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {inc.zone.name}
                      </span>
                    )}
                    {inc.service?.name && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {inc.service.name}
                      </span>
                    )}
                    <span style={{ color: 'var(--danger)', fontSize: 16, fontWeight: 700 }}>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className={`stat-card ${escalated.length > 0 ? 'stat-card--danger' : ''}`}>
          <div className="stat-card__value">{escalated.length}</div>
          <div className="stat-card__label">Escalated</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{active.length}</div>
          <div className="stat-card__label">Active</div>
        </div>
        <div className={`stat-card ${totalOpen > 0 ? 'stat-card--warning' : 'stat-card--success'}`}>
          <div className="stat-card__value">{totalOpen}</div>
          <div className="stat-card__label">Total Open</div>
        </div>
      </div>

      {/* Active incidents */}
      {active.length > 0 && (
        <div>
          <div className="form-label" style={{ marginBottom: 8 }}>ACTIVE INCIDENTS</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>TYPE</th><th>TITLE</th><th>ZONE</th><th>SERVICE</th><th>OPENED</th><th></th>
                </tr>
              </thead>
              <tbody>
                {active.map(inc => (
                  <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/incidents/${inc.id}`)}>
                    <td>
                      <span className="badge badge--active">
                        {inc.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inc.title}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{inc.zone?.name ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{inc.service?.name ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(inc.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--accent)', fontWeight: 700 }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalOpen === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">✓</div>
          <div className="empty-state__title">Operations Clear</div>
          <div className="empty-state__desc">
            No open incidents
            {sseConnected ? ' · live updates active' : ' · auto-refreshes every 30s'}
          </div>
        </div>
      )}
    </div>
  )
}
