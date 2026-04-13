import { useState } from 'react'
import { authApi } from '../../api/client'
import { toast } from '../../store/toast.store'

interface Props { onClose: () => void }

export function ChangePasswordModal({ onClose }: Props) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    setError('')
    if (!form.current || !form.next || !form.confirm) { setError('All fields required'); return }
    if (form.next.length < 8) { setError('New password must be at least 8 characters'); return }
    if (form.next !== form.confirm) { setError('New passwords do not match'); return }
    setSaving(true)
    try {
      await authApi.changePassword(form.current, form.next)
      toast.success('Password changed successfully')
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card">
        <div className="flex-center">
          <div className="modal-title">CHANGE PASSWORD</div>
          <button className="btn btn--ghost btn--sm ml-auto" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="error-msg">⊘ {error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="input" type="password"
              placeholder="Your current password"
              value={form.current} onChange={set('current')} autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="input" type="password"
              placeholder="Min 8 characters"
              value={form.next} onChange={set('next')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="input" type="password"
              placeholder="Repeat new password"
              value={form.confirm} onChange={set('confirm')}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </div>
        </div>

        <div className="flex-center gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" onClick={onClose}>CANCEL</button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={saving || !form.current || !form.next || !form.confirm}
          >
            {saving ? <span className="spinner" /> : 'SAVE PASSWORD'}
          </button>
        </div>
      </div>
    </div>
  )
}
