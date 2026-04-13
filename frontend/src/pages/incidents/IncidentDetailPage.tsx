import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { incidentsApi } from '../../api/client'
import { toast } from '../../store/toast.store'
import { Incident } from '../../types'
import { useAuthStore } from '../../store/auth.store'
import { useZones } from '../../hooks/useZones'
import { draftIncidents, generateLocalId, isOnline } from '../../utils/offline'

const INCIDENT_TYPES = [
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'LOST_AND_FOUND', label: 'Lost & Found' },
  { value: 'FLOW_DISRUPTION', label: 'Flow Disruption' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'active', ESCALATED: 'escalated', RESOLVED: 'resolved', ARCHIVED: 'archived',
}

const TYPE_LABELS: Record<string, string> = {
  LOST_AND_FOUND: 'Lost & Found', COMPLAINT: 'Complaint',
  FLOW_DISRUPTION: 'Flow Disruption', OTHER: 'Other',
}

function NewIncidentForm() {
  const navigate = useNavigate()
  const { context } = useAuthStore()
  const { zones } = useZones()
  const [form, setForm] = useState({ type: 'COMPLAINT', title: '', description: '', zoneId: '', serviceId: '' })
  const [saving, setSaving] = useState(false)
  const online = isOnline()
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      if (online) {
        const inc = await incidentsApi.create({ type: form.type as any, title: form.title.trim(), description: form.description.trim() || undefined, zoneId: form.zoneId || undefined, serviceId: form.serviceId || undefined })
        toast.success('Incident created')
        navigate(`/incidents/${inc.id}`)
      } else {
        await draftIncidents.save({ localId: generateLocalId(), type: form.type as any, title: form.title.trim(), description: form.description.trim() || undefined, zoneId: form.zoneId || undefined, serviceId: form.serviceId || undefined, syncState: 'PENDING_CONFIRMATION' as const, createdAt: new Date().toISOString() })
        toast.success('Saved as draft — will sync when online')
        navigate('/drafts')
      }
    } catch { toast.error('Failed to create incident') }
    finally { setSaving(false) }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><div className="page-title">NEW INCIDENT</div><div className="page-subtitle">Capture operational exception</div></div>
        <button className="btn btn--ghost" onClick={() => navigate('/incidents')}>← BACK</button>
      </div>
      {!online && <div className="offline-banner" style={{ marginBottom: 16 }}><span>⚠</span>OFFLINE — will save as local draft</div>}
      <div className="card" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Type *</label>
            <select className="select" value={form.type} onChange={set('type')}>
              {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="input" placeholder="Brief description" value={form.title} onChange={set('title')} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Details (optional)</label>
            <textarea className="textarea" placeholder="Additional context..." value={form.description} onChange={set('description')} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Zone</label>
              <select className="select" value={form.zoneId} onChange={set('zoneId')}>
                <option value="">— Zone —</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Service</label>
              <select className="select" value={form.serviceId} onChange={set('serviceId')}>
                <option value="">— Service —</option>
                {(context?.assignedServices ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-center gap-8" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost" onClick={() => navigate('/incidents')}>CANCEL</button>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving || !form.title.trim()}>
              {saving ? <span className="spinner" /> : online ? 'CREATE INCIDENT' : 'SAVE DRAFT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!id || id === 'new') return
    try { const data = await incidentsApi.get(id); setIncident(data) }
    catch { toast.error('Failed to load incident') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])
  if (id === 'new') return <NewIncidentForm />

  if (loading) return <div className="flex-center gap-12" style={{ padding: 60 }}><div className="spinner" /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>LOADING...</span></div>
  if (!incident) return <div className="empty-state"><div className="empty-state__icon">⊘</div><div className="empty-state__title">Incident not found</div><button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => navigate('/incidents')}>← Back</button></div>

  const isManager = ['ADMIN','SUPER_ADMIN','SENIOR_MANAGER','SERVICE_MANAGER'].includes(user?.role ?? '')
  const isTerminal = incident.status === 'ARCHIVED'
  const canEscalate = incident.status === 'ACTIVE' && isManager
  const canResolve  = (incident.status === 'ACTIVE' || incident.status === 'ESCALATED') && isManager
  const canArchive  = incident.status === 'RESOLVED' && isManager

  const handleAddNote = async () => {
    if (!noteText.trim() || !id) return
    setSubmitting(true)
    try { await incidentsApi.addNote(id, noteText.trim()); setNoteText(''); toast.success('Note added'); await load() }
    catch { toast.error('Failed to add note') }
    finally { setSubmitting(false) }
  }
  const handleEscalate = async () => {
    if (!id || !confirm('Escalate this incident?')) return
    try { await incidentsApi.escalate(id); toast.success('Escalated'); await load() }
    catch { toast.error('Failed to escalate') }
  }
  const handleResolve = async () => {
    if (!id || !confirm('Mark as resolved?')) return
    try { await incidentsApi.resolve(id, `Resolved by ${user?.fullName}`); toast.success('Resolved'); await load() }
    catch { toast.error('Failed to resolve') }
  }
  const handleArchive = async () => {
    if (!id || !confirm('Archive this incident? It will be read-only.')) return
    try { await incidentsApi.archive(id); toast.success('Archived'); await load() }
    catch { toast.error('Failed to archive') }
  }

  const initials = (name: string) => name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/incidents')} style={{ padding: '4px 8px' }}>← BACK</button>
          <div>
            <div className="flex-center gap-10">
              <span className={`badge badge--${STATUS_COLORS[incident.status] ?? 'active'}`}>{incident.status}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{TYPE_LABELS[incident.type] ?? incident.type}</span>
            </div>
            <div className="page-title" style={{ fontSize: 16, marginTop: 4 }}>{incident.title}</div>
          </div>
        </div>
        <div className="flex-center gap-8">
          {canEscalate && <button className="btn btn--danger" onClick={handleEscalate}>⬆ ESCALATE</button>}
          {canResolve  && <button className="btn btn--success" onClick={handleResolve}>✓ RESOLVE</button>}
          {canArchive  && <button className="btn btn--ghost btn--sm" onClick={handleArchive} style={{ color: 'var(--text-muted)' }}>ARCHIVE</button>}
          {isTerminal  && <span className="badge badge--archived" style={{ padding: '6px 12px' }}>READ-ONLY</span>}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="form-label" style={{ marginBottom: 12 }}>DETAILS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {([
                ['Zone', incident.zone?.name ?? '—'],
                ['Service', incident.service?.name ?? '—'],
                ['Created by', incident.createdBy?.fullName ?? '—'],
                ['Created', new Date(incident.createdAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })],
                ...(incident.resolvedBy ? [['Resolved by', incident.resolvedBy.fullName]] : []),
              ] as [string,string][]).map(([label, value]) => (
                <div key={label}>
                  <div className="form-label" style={{ marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
            {incident.description && (
              <><hr className="divider" /><div><div className="form-label" style={{ marginBottom: 6 }}>DESCRIPTION</div><div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{incident.description}</div></div></>
            )}
          </div>

          {!isTerminal && (
            <div className="card">
              <div className="form-label" style={{ marginBottom: 10 }}>ADD NOTE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea className="textarea" placeholder="Add to timeline..." value={noteText} onChange={e => setNoteText(e.target.value)} rows={3}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote() }} />
                <div className="flex-center">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>⌘+Enter to submit</span>
                  <button className="btn btn--primary btn--sm ml-auto" onClick={handleAddNote} disabled={submitting || !noteText.trim()}>
                    {submitting ? <span className="spinner" /> : 'ADD NOTE'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="form-label" style={{ marginBottom: 14 }}>
            TIMELINE {(incident.notes?.length ?? 0) > 0 && <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>({incident.notes!.length})</span>}
          </div>
          {(!incident.notes || incident.notes.length === 0)
            ? <div className="empty-state" style={{ padding: '24px 0' }}><div className="empty-state__title">No notes yet</div><div className="empty-state__desc">Notes appear here as incident progresses</div></div>
            : <div>{incident.notes.map(note => (
                <div key={note.id} className="timeline-item">
                  <div className="timeline-avatar">{initials(note.author?.fullName ?? '??')}</div>
                  <div className="timeline-content">
                    <div className="timeline-meta">
                      <span className="timeline-author">{note.author?.fullName}</span>
                      <span className="timeline-time">{new Date(note.createdAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                    <div className="timeline-body">{note.body}</div>
                  </div>
                </div>
              ))}</div>
          }
        </div>
      </div>
    </div>
  )
}
