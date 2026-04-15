import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { LoginPage } from './pages/LoginPage'
import { NowPage } from './pages/now/NowPage'
import { IncidentsPage } from './pages/incidents/IncidentsPage'
import { IncidentDetailPage } from './pages/incidents/IncidentDetailPage'
import { OperationsPage } from './pages/operations/OperationsPage'
import { AdminPage } from './pages/admin/AdminPage'
import { DraftsPage } from './pages/drafts/DraftsPage'
import { ToastContainer } from './components/ui/ToastContainer'
import { PendingDraftsCount } from './components/ui/PendingDraftsCount'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ChangePasswordModal } from './components/ui/ChangePasswordModal'
import { registerSyncOnReconnect } from './utils/sync'
import './index.css'

// ── Icons (inline SVG to avoid dependencies) ────────────────────────────────

const IconNow = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5"/>
    <path d="M8 4.5v3.75l2.5 1.5" strokeLinecap="round"/>
  </svg>
)

const IconIncidents = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2.5L14 13H2L8 2.5Z" strokeLinejoin="round"/>
    <path d="M8 6v3.5M8 11v.5" strokeLinecap="round"/>
  </svg>
)

const IconOps = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round"/>
  </svg>
)

const IconDrafts = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
    <circle cx="8" cy="8" r="2.5"/>
  </svg>
)

const IconAdmin = () => (
  <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M11.5 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" strokeLinecap="round"/>
  </svg>
)

// ── App Shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const { user, context, logout, loadContext } = useAuthStore()
  const [online, setOnline] = useState(navigator.onLine)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    loadContext()
    registerSyncOnReconnect(() => context?.activeShift?.id)
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const shift = context?.activeShift
  const isManager = ['ADMIN','SUPER_ADMIN','SENIOR_MANAGER','SERVICE_MANAGER'].includes(user?.role ?? '')

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="app-topbar">
        <span className="app-topbar__logo">OPSBOARD</span>
        <div className="app-topbar__divider" />
        {context && (
          <span className="app-topbar__project">
            {context.project?.name} · {context.department?.name}
          </span>
        )}
        <div className="app-topbar__spacer" />

        <div className={`app-topbar__pill ${online ? 'app-topbar__pill--online' : 'app-topbar__pill--offline'}`}>
          <div className={`status-dot ${online ? 'status-dot--pulse' : ''}`} />
          {online ? 'ONLINE' : 'OFFLINE'}
        </div>

        <div className={`app-topbar__pill ${shift ? 'app-topbar__pill--shift' : 'app-topbar__pill--no-shift'}`}>
          {shift ? `⬡ ${shift.name}` : '⊘ NO SHIFT'}
        </div>

        <div className="app-topbar__user">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{user?.fullName}</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowPwd(true)}
            aria-label="Change password"
            title="Change password"
          >
            <span aria-hidden="true">🔑</span>
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={logout}
            aria-label="Sign out"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="app-nav">
        <div className="nav-section">
          <div className="nav-section__label">Operations</div>
          <NavLink to="/now" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconNow /> NOW
          </NavLink>
          <NavLink to="/incidents" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconIncidents /> INCIDENTS
          </NavLink>
          <NavLink to="/operations" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconOps /> OPERATIONS
          </NavLink>
        </div>

        <div className="nav-section" style={{ marginTop: 'auto' }}>
          <div className="nav-section__label">System</div>
          <NavLink to="/drafts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconDrafts /> DRAFTS
            <PendingDraftsCount />
          </NavLink>
          {isManager && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <IconAdmin /> ADMIN
            </NavLink>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/now"           element={<NowPage />} />
            <Route path="/incidents"     element={<IncidentsPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
            <Route path="/operations"    element={<OperationsPage />} />
            <Route path="/drafts"        element={<DraftsPage />} />
            <Route path="/admin"         element={<AdminPage />} />
            <Route path="*"              element={<Navigate to="/now" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {(showPwd || user?.mustChangePassword) && (
        <ChangePasswordModal
          onClose={() => setShowPwd(false)}
          forced={!!user?.mustChangePassword}
        />
      )}
      <ToastContainer />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <LoginPage />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AuthGuard><AppShell /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
