import { useState } from 'react'
import { authApi } from '../../api/client'
import { toast } from '../../store/toast.store'
import { useAuthStore } from '../../store/auth.store'

interface Props {
  onClose: () => void
  /** When true, modal cannot be dismissed until password is successfully
   * changed — used for seeded accounts that carry mustChangePassword=true. */
  forced?: boolean
}

export function ChangePasswordModal({ onClose, forced = false }: Props) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const refreshUser = useAuthStore(s => s.refreshUser)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const safeClose = () => { if (!forced) onClose() }

  const handleSave = async () => {
    setError('')
    if (!form.current || !form.next || !form.confirm) { setError('All fields required'); return }
    if (form.next.length < 8) { setError('New password must be at least 8 characters'); return }
    if (form.next !== form.confirm) { setError('New passwords do not match'); return }
    setSaving(true)
    try {
      // Backend bumps tokenVersion on successful change, which revokes every
      // token tied to the old version — including the access token we're
      // using to make this very request. The response body therefore carries
      // freshly-issued tokens so the current session survives the rotation.
      // We MUST swap them into localStorage BEFORE any follow-up call
      // (refreshUser does GET /auth/me which would 401 with the stale token).
      const res: any = await authApi.changePassword(form.current, form.next)
      if (res?.accessToken)  localStorage.setItem('access_token',  res.accessToken)
      if (res?.refreshToken) localStorage.setItem('refresh_token', res.refreshToken)
      // Now re-fetch the user profile with the new token so the store's
      // mustChangePassword flag clears; otherwise the forced modal would
      // immediately re-open.
      await refreshUser()
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
      onClick={e => { if (e.target === e.currentTarget) safeClose() }}
    >
      <div className="modal-card">
        {forced && (
          <div
            className="error-msg"
            style={{ color: 'var(--accent)', borderColor: 'rgba(0,212,255,0.25)', background: 'rgba(0,212,255,0.05)' }}
          >
            Your account uses a default password. Please set a new one before continuing.
          </div>
        )}
        <div className="flex-center">
          <div className="modal-title">CHANGE PASSWORD</div>
          {!forced && (
            <button
              className="btn btn--ghost btn--sm ml-auto"
              onClick={safeClose}
              aria-label="Close"
            >✕</button>
          )}
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
          {!forced && (
            <button type="button" className="btn btn--ghost" onClick={safeClose}>CANCEL</button>
          )}
          <button
            type="button"
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
