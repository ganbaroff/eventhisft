import { useState } from 'react'
import { api } from '../../api/client'
import { toast } from '../../store/toast.store'
import { UserRole } from '../../types'

interface Props {
  onCreated: () => void
  onClose: () => void
}

const ROLES: UserRole[] = ['COORDINATOR', 'SERVICE_MANAGER', 'SENIOR_MANAGER', 'ADMIN']

export function CreateUserModal({ onCreated, onClose }: Props) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'COORDINATOR' as UserRole,
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) return
    setSubmitting(true)
    try {
      await api.post('/admin/users', form)
      toast.success(`User "${form.fullName}" created`)
      onCreated()
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create user')
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
      <div className="card fade-in" style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="flex-center">
          <div style={{ fontWeight: 700, fontSize: 15 }}>CREATE USER</div>
          <button className="btn btn--ghost btn--sm ml-auto" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="input" placeholder="Jane Smith" value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)} autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input" type="email" placeholder="jane@org.com" value={form.email}
            onChange={(e) => set('email', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="input" type="password" placeholder="Min 6 characters" value={form.password}
            onChange={(e) => set('password', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="select" value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex-center gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>CANCEL</button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !form.fullName || !form.email || !form.password}
          >
            {submitting ? <span className="spinner" /> : 'CREATE USER'}
          </button>
        </div>
      </div>
    </div>
  )
}
