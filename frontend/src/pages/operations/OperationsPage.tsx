import { useEffect, useState } from 'react'
import { operationsApi } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../store/toast.store'
import { draftOperations, generateLocalId, isOnline } from '../../utils/offline'

interface Operation { id: string; notes?: string; status: string; service?: { id: string; name: string }; zone?: { id: string; name: string }; createdAt: string }

export function OperationsPage() {
  const { context } = useAuthStore()
  const shift = context?.activeShift
  const services = context?.assignedServices ?? []
  const [ops, setOps] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ serviceId: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!shift) { setLoading(false); return }
    try { setOps(await operationsApi.list(shift.id)) }
    catch { /* offline */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [shift?.id])

  const handleCreate = async () => {
    if (!form.serviceId) { toast.error('Select a service'); return }
    setSaving(true)
    try {
      if (isOnline() && shift) {
        await operationsApi.create({ shiftId: shift.id, serviceId: form.serviceId, notes: form.notes || undefined })
        toast.success('Operation created')
        setForm({ serviceId: '', notes: '' })
        await load()
      } else {
        await draftOperations.save({ localId: generateLocalId(), serviceId: form.serviceId, notes: form.notes || undefined, syncState: 'PENDING_CONFIRMATION' as const, createdAt: new Date().toISOString() })
        toast.success('Saved as draft')
        setForm({ serviceId: '', notes: '' })
      }
    } catch { toast.error('Failed to create operation') }
    finally { setSaving(false) }
  }

  const handleSubmit = async (id: string) => {
    try { await operationsApi.submit(id); toast.success('Operation submitted'); await load() }
    catch { toast.error('Failed to submit') }
  }

  const STATUS_COLORS: Record<string, string> = { DRAFT: 'draft', SUBMITTED: 'submitted', LOCKED: 'locked' }
  const online = isOnline()

  if (!shift) return (
    <div className="fade-in">
      <div className="page-header"><div><div className="page-title">OPERATIONS</div><div className="page-subtitle">Routine operational state capture</div></div></div>
      <div className="empty-state" style={{ padding: '60px 0' }}>
        <div className="empty-state__icon">⊘</div>
        <div className="empty-state__title">No active shift</div>
        <div className="empty-state__desc">A manager must open a shift before operations can be recorded</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {!online && <div className="offline-banner"><span>⚠</span>OFFLINE — entries will be saved as local drafts</div>}
      <div className="page-header">
        <div><div className="page-title">OPERATIONS</div><div className="page-subtitle">Shift: {shift.name}</div></div>
      </div>

      {/* New operation form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-label" style={{ marginBottom: 12 }}>NEW OPERATION ENTRY</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '0 0 200px' }}>
            <label className="form-label">Service *</label>
            <select className="select" value={form.serviceId} onChange={e => setForm(p => ({ ...p, serviceId: e.target.value }))}>
              <option value="">— Select service —</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Notes (optional)</label>
            <input className="input" placeholder="Operational notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }} />
          </div>
          <button className="btn btn--primary" onClick={handleCreate} disabled={saving || !form.serviceId}>
            {saving ? <span className="spinner" /> : '+ LOG ENTRY'}
          </button>
        </div>
      </div>

      {/* Operations list */}
      {loading ? (
        <div className="flex-center gap-12" style={{ padding: 40 }}><div className="spinner" /></div>
      ) : ops.length === 0 ? (
        <div className="empty-state"><div className="empty-state__title">No operations logged yet</div><div className="empty-state__desc">Use the form above to log operational status</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th>STATUS</th><th>SERVICE</th><th>ZONE</th><th>NOTES</th><th>TIME</th><th></th></tr></thead>
            <tbody>
              {ops.map(op => (
                <tr key={op.id}>
                  <td><span className={`badge badge--${STATUS_COLORS[op.status] ?? 'draft'}`}>{op.status}</span></td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{op.service?.name ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{op.zone?.name ?? '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 300 }}>{op.notes ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(op.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    {op.status === 'DRAFT' && (
                      <button className="btn btn--ghost btn--sm" onClick={() => handleSubmit(op.id)}
                        style={{ color: 'var(--success)', borderColor: 'rgba(0,230,118,0.3)' }}>
                        SUBMIT
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
