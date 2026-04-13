import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidentsApi } from '../../api/client'
import { Incident, IncidentStatus } from '../../types'
import { draftIncidents } from '../../utils/offline'

const STATUS_FILTERS: { label: string; value: IncidentStatus | 'ALL' }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'ESCALATED', value: 'ESCALATED' },
  { label: 'RESOLVED', value: 'RESOLVED' },
]

const TYPE_LABELS: Record<string, string> = {
  LOST_AND_FOUND: 'Lost & Found',
  COMPLAINT: 'Complaint',
  FLOW_DISRUPTION: 'Flow',
  OTHER: 'Other',
}

export function IncidentsPage() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [localDrafts, setLocalDrafts] = useState<ReturnType<typeof draftIncidents.getAll> extends Promise<infer T> ? T : never>([])
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await incidentsApi.list(filter !== 'ALL' ? { status: filter } : {})
        setIncidents(data)
      } catch { /* offline */ } finally {
        setLoading(false)
      }
      const drafts = await draftIncidents.getAll()
      setLocalDrafts(drafts as any)
    }
    load()
  }, [filter])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">INCIDENTS</div>
          <div className="page-subtitle">Capture and manage operational exceptions</div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/incidents/new')}>
          + NEW INCIDENT
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex-center gap-8" style={{ marginBottom: 16 }}>
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            className={`btn btn--ghost btn--sm${filter === value ? ' active' : ''}`}
            style={filter === value ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Local drafts warning */}
      {localDrafts.length > 0 && (
        <div className="offline-banner" style={{ marginBottom: 16 }}>
          <span>⏳</span>
          <span>{localDrafts.length} local draft(s) pending sync</span>
        </div>
      )}

      {loading ? (
        <div className="flex-center gap-12" style={{ padding: 40 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>LOADING...</span>
        </div>
      ) : incidents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⬡</div>
          <div className="empty-state__title">No incidents</div>
          <div className="empty-state__desc">
            {filter === 'ALL' ? 'No incidents recorded yet' : `No ${filter.toLowerCase()} incidents`}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>TYPE</th>
                  <th>TITLE</th>
                  <th>ZONE</th>
                  <th>SERVICE</th>
                  <th>CREATED BY</th>
                  <th>TIME</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                  >
                    <td>
                      <span className={`badge badge--${inc.status.toLowerCase()}`}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {TYPE_LABELS[inc.type]}
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{inc.title}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{inc.zone?.name ?? '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{inc.service?.name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{inc.createdBy.fullName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(inc.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--accent)' }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
