import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../store/toast.store'
import { User, Zone, Service } from '../../types'
import { ShiftsPanel } from './ShiftsPanel'
import { CreateUserModal } from '../../components/ui/CreateUserModal'
import { UserServiceModal } from '../../components/ui/UserServiceModal'

type Tab = 'shifts' | 'users' | 'zones' | 'services'

export function AdminPage() {
  const { user } = useAuthStore()
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role ?? '')
  const [tab, setTab] = useState<Tab>('shifts')
  const tabs: { key: Tab; label: string }[] = [
    { key: 'shifts', label: 'SHIFTS' },
    { key: 'users', label: 'USERS' },
    { key: 'zones', label: 'ZONES' },
    { key: 'services', label: 'SERVICES' },
  ]
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">ADMIN</div>
          <div className="page-subtitle">Shift, user, zone and service management</div>
        </div>
      </div>
      <div className="flex-center gap-8" style={{ marginBottom: 20 }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            className="btn btn--ghost btn--sm"
            style={tab === key ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'shifts' && <ShiftsPanel />}
      {tab === 'users' && <UsersPanel isAdmin={isAdmin} />}
      {tab === 'zones' && <ZonesPanel />}
      {tab === 'services' && <ServicesPanel />}
    </div>
  )
}

function UsersPanel({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [svcModal, setSvcModal] = useState<{id:string;name:string}|null>(null)

  const load = () => adminApi.users.list().then(setUsers).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const toggle = async (u: User) => {
    try {
      const updated = await adminApi.users.setActive(u.id, !u.isActive)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)))
      toast.success(`${u.fullName} ${!u.isActive ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Failed to update user')
    }
  }

  if (loading) return <div className="flex-center gap-12"><div className="spinner" /></div>

  return (
    <>
      {showCreate && <CreateUserModal onCreated={load} onClose={() => setShowCreate(false)} />}
      {svcModal && <UserServiceModal userId={svcModal.id} userName={svcModal.name} onClose={() => setSvcModal(null)} />}
      {isAdmin && (
        <div className="flex-center" style={{ marginBottom: 16 }}>
          <button className="btn btn--primary btn--sm ml-auto" onClick={() => setShowCreate(true)}>
            + CREATE USER
          </button>
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th>
              {isAdmin && <th>ACTION</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.fullName}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.email}</td>
                <td><span className="badge badge--draft">{u.role.replace(/_/g, ' ')}</span></td>
                <td>
                  <span className={`badge badge--${u.isActive ? 'resolved' : 'escalated'}`}>
                    {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                {isAdmin && (
                  <td>
                    <div className="flex-center gap-8">
                      <button
                        className="btn btn--sm btn--ghost"
                        style={{ color: 'var(--accent)', borderColor: 'rgba(0,212,255,0.25)' }}
                        onClick={() => setSvcModal({ id: u.id, name: u.fullName })}
                      >
                        SERVICES
                      </button>
                      <button
                        className="btn btn--sm btn--ghost"
                        style={
                          u.isActive
                            ? { color: 'var(--danger)', borderColor: 'rgba(255,61,90,0.3)' }
                            : { color: 'var(--success)', borderColor: 'rgba(0,230,118,0.3)' }
                        }
                        onClick={() => toggle(u)}
                      >
                        {u.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ZonesPanel() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { adminApi.zones.list().then(setZones).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const zone = await adminApi.zones.create({ name: newName.trim() })
      setZones((p) => [...p, zone])
      setNewName('')
      toast.success(`Zone "${newName}" created`)
    } catch { toast.error('Failed to create zone') }
    finally { setAdding(false) }
  }

  const toggleZone = async (z: Zone) => {
    try {
      await adminApi.zones.update(z.id, { isActive: !z.isActive })
      setZones((p) => p.map((x) => (x.id === z.id ? { ...x, isActive: !z.isActive } : x)))
      toast.success(`Zone "${z.name}" updated`)
    } catch { toast.error('Failed to update zone') }
  }

  if (loading) return <div className="flex-center gap-12"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex-center gap-8" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="New zone name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{ maxWidth: 260 }}
        />
        <button className="btn btn--primary" onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? <span className="spinner" /> : 'ADD ZONE'}
        </button>
      </div>
      {zones.length === 0 && !loading && (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <div className="empty-state__title">No zones yet</div>
          <div className="empty-state__desc">Add zones above to get started</div>
        </div>
      )}
      {zones.length > 0 && <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>NAME</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{z.name}</td>
                <td>
                  <span className={`badge badge--${z.isActive ? 'resolved' : 'draft'}`}>
                    {z.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td>
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleZone(z)}>
                    {z.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { adminApi.services.list().then(setServices).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const svc = await adminApi.services.create({ name: newName.trim() })
      setServices((p) => [...p, svc])
      setNewName('')
      toast.success(`Service "${newName}" created`)
    } catch { toast.error('Failed to create service') }
    finally { setAdding(false) }
  }

  const toggleService = async (s: Service) => {
    try {
      await adminApi.services.update(s.id, { isActive: !s.isActive })
      setServices((p) => p.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)))
      toast.success(`Service "${s.name}" updated`)
    } catch { toast.error('Failed to update service') }
  }

  if (loading) return <div className="flex-center gap-12"><div className="spinner" /></div>

  return (
    <div>
      <div className="flex-center gap-8" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="New service name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{ maxWidth: 260 }}
        />
        <button className="btn btn--primary" onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? <span className="spinner" /> : 'ADD SERVICE'}
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead><tr><th>NAME</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</td>
                <td>
                  <span className={`badge badge--${s.isActive ? 'resolved' : 'draft'}`}>
                    {s.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td>
                  <button className="btn btn--ghost btn--sm" onClick={() => toggleService(s)}>
                    {s.isActive ? 'DEACTIVATE' : 'ACTIVATE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
