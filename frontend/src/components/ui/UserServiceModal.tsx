import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { toast } from '../../store/toast.store'

interface Service { id: string; name: string; isActive: boolean }
interface UserService { serviceId: string; name: string; isActive: boolean }

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

export function UserServiceModal({ userId, userName, onClose }: Props) {
  const [allServices, setAllServices] = useState<Service[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [svcs, userSvcs] = await Promise.all([
          api.get('/admin/services').then(r => r.data as Service[]),
          api.get(`/admin/users/${userId}/services`).then(r => r.data as UserService[]),
        ])
        setAllServices(svcs.filter(s => s.isActive))
        setAssigned(new Set(userSvcs.map(us => us.serviceId)))
      } catch { toast.error('Failed to load services') }
      finally { setLoading(false) }
    }
    load()
  }, [userId])

  const toggle = (svcId: string) => {
    setAssigned(prev => {
      const next = new Set(prev)
      next.has(svcId) ? next.delete(svcId) : next.add(svcId)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/admin/users/${userId}/services`, {
        serviceIds: Array.from(assigned),
      })
      toast.success(`Services updated for ${userName}`)
      onClose()
    } catch { toast.error('Failed to save service assignments') }
    finally { setSaving(false) }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card fade-in"
        style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="flex-center">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>ASSIGN SERVICES</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {userName}
            </div>
          </div>
          <button className="btn btn--ghost btn--sm ml-auto" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="flex-center gap-12" style={{ padding: 24 }}>
            <div className="spinner" />
          </div>
        ) : allServices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__title">No services found</div>
            <div className="empty-state__desc">Create services in the Services tab first</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="form-label">Select services this user can access</div>
            {allServices.map(svc => (
              <label
                key={svc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: assigned.has(svc.id) ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${assigned.has(svc.id) ? 'rgba(61,127,255,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={assigned.has(svc.id)}
                  onChange={() => toggle(svc.id)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: assigned.has(svc.id) ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {svc.name}
                </span>
                {assigned.has(svc.id) && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    ASSIGNED
                  </span>
                )}
              </label>
            ))}
          </div>
        )}

        <div className="flex-center gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>CANCEL</button>
          <button
            className="btn btn--primary"
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? <span className="spinner" /> : `SAVE (${assigned.size} services)`}
          </button>
        </div>
      </div>
    </div>
  )
}
