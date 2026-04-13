import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    await login(email, password)
    // navigate on success handled by AuthGuard re-render
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        {/* Logo */}
        <div>
          <div className="login-logo">OPSBOARD</div>
          <div className="login-tagline">operational source of truth</div>
        </div>

        {/* Error */}
        {error && <div className="error-msg">⊘ {error}</div>}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="coordinator@org.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={onKey}
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={isLoading || !email || !password}
        >
          {isLoading ? <span className="spinner" /> : 'SIGN IN →'}
        </button>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-dim)',
          textAlign: 'center',
          letterSpacing: '0.05em',
        }}>
          OPSBOARD · SECURE ACCESS
        </div>
      </div>
    </div>
  )
}
