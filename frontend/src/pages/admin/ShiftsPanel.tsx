import { useEffect, useState } from 'react'
import { shiftsApi, adminApi } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../store/toast.store'
import { Shift } from '../../types'
import { CreateShiftModal } from '../../components/ui/CreateShiftModal'

const STATUS_BADGE: Record<string, string> = {
  PLANNED:  'badge--draft',
  ACTIVE:   'badge--active',
  HANDOVER: 'badge--warning',
  CLOSED:   'badge--archived',
}

export function ShiftsPanel() {
  const { user } = useAuthStore()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const isManager = ['ADMIN','SUPER_ADMIN','SENIOR_MANAGER','SERVICE_MANAGER'].includes(user?.role ?? '')

  const load = async () => {
    try {
      const data = await shiftsApi.list()
      setShifts(data)
    } catch { toast.error('Failed to load shifts') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const act = async (shiftId: string, name: string, fn: () => Promise<unknown>, label: string) => {
    if (!confirm(`${label} shift "${name}"?`)) return
    setActing(shiftId)
    try {
      await fn()
      toast.success(`${label}: ${name}`)
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? `Failed to ${label.toLowerCase()}`)
    } finally { setActing(null) }
  }

  if (loading) return (
    <div className="flex-center gap-12" style={{ padding: 40 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <>
      {showCreate && <CreateShiftModal onCreated={load} onClose={() => setShowCreate(false)} />}

      <div className="flex-center" style={{ marginBottom: 16 }}>
        {isManager && (
          <button className="btn btn--primary btn--sm ml-auto" onClick={() => setShowCreate(true)}>
            + CREATE SHIFT
          </button>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 0' }}>
          <div className="empty-state__icon">⬡</div>
          <div className="empty-state__title">No shifts yet</div>
          <div className="empty-state__desc">Create a shift to begin operations</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>STATUS</th>
                <th>NAME</th>
                <th>OPENED BY</th>
                <th>STARTED</th>
                <th>ENDED</th>
                {isManager && <th>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status] ?? 'badge--draft'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</td>
                  <td style={{ fontSize: 12 }}>{s.openedBy?.fullName ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.openedAt
                      ? new Date(s.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.closedAt
                      ? new Date(s.closedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  {isManager && (
                    <td>
                      <div className="flex-center gap-6">
                        {s.status === 'PLANNED' && (
                          <button
                            className="btn btn--sm btn--ghost"
                            style={{ color: 'var(--success)', borderColor: 'rgba(0,230,118,0.3)' }}
                            disabled={acting === s.id}
                            onClick={() => act(s.id, s.name, () => shiftsApi.open(s.id), 'Open')}
                          >
                            {acting === s.id ? <span className="spinner" /> : 'OPEN'}
                          </button>
                        )}
                        {s.status === 'ACTIVE' && (
                          <>
                            <button
                              className="btn btn--sm btn--ghost"
                              style={{ color: 'var(--warning)', borderColor: 'rgba(255,159,26,0.3)' }}
                              disabled={acting === s.id}
                              onClick={() => act(s.id, s.name, () => shiftsApi.handover(s.id), 'Handover')}
                            >
                              {acting === s.id ? <span className="spinner" /> : 'HANDOVER'}
                            </button>
                            <button
                              className="btn btn--sm btn--ghost"
                              style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,90,0.3)' }}
                              disabled={acting === s.id}
                              onClick={() => act(s.id, s.name, () => shiftsApi.close(s.id), 'Close')}
                            >
                              {acting === s.id ? <span className="spinner" /> : 'CLOSE'}
                            </button>
                          </>
                        )}
                        {s.status === 'HANDOVER' && (
                          <button
                            className="btn btn--sm btn--ghost"
                            style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,90,0.3)' }}
                            disabled={acting === s.id}
                            onClick={() => act(s.id, s.name, () => shiftsApi.close(s.id), 'Close')}
                          >
                            {acting === s.id ? <span className="spinner" /> : 'CLOSE'}
                          </button>
                        )}
                        {s.status === 'CLOSED' && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                            COMPLETE
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
