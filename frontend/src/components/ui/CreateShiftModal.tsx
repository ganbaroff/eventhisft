import { useState } from 'react'
import { api } from '../../api/client'
import { toast } from '../../store/toast.store'

interface Props {
  onCreated: () => void
  onClose: () => void
}

export function CreateShiftModal({ onCreated, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    startsAt: new Date().toISOString().slice(0, 16), // datetime-local format
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      await api.post('/admin/shifts', {
        name: form.name.trim(),
        startsAt: new Date(form.startsAt).toISOString(),
      })
      toast.success(`Shift "${form.name}" created`)
      onCreated()
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create shift')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card fade-in" style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="flex-center">
          <div style={{ fontWeight: 700, fontSize: 15 }}>CREATE SHIFT</div>
          <button className="btn btn--ghost btn--sm ml-auto" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Shift Name</label>
          <input className="input" placeholder="Morning Shift" value={form.name}
            onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Planned Start</label>
          <input className="input" type="datetime-local" value={form.startsAt}
            onChange={(e) => set('startsAt', e.target.value)} />
        </div>

        <div style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '8px 10px',
        }}>
          Shift will be created as PLANNED. Open it from the Shifts tab when ready.
        </div>

        <div className="flex-center gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>CANCEL</button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim()}
          >
            {submitting ? <span className="spinner" /> : 'CREATE SHIFT'}
          </button>
        </div>
      </div>
    </div>
  )
}
