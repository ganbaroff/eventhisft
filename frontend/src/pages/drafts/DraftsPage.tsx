import { useEffect, useState } from 'react'
import { draftIncidents, draftOperations } from '../../utils/offline'
import { syncPendingDrafts } from '../../utils/sync'
import { toast } from '../../store/toast.store'

export function DraftsPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = async () => {
    const [incs, ops] = await Promise.all([draftIncidents.getAll(), draftOperations.getAll()])
    setIncidents(incs as any[])
    setOperations(ops as any[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSyncAll = async () => {
    setSyncing(true)
    try { await syncPendingDrafts(); toast.success('Sync complete'); await load() }
    catch { toast.error('Sync failed — check connection') }
    finally { setSyncing(false) }
  }

  const handleDelete = async (type: 'incident' | 'operation', localId: string) => {
    if (!confirm('Delete this draft?')) return
    if (type === 'incident') await draftIncidents.delete(localId)
    else await draftOperations.delete(localId)
    toast.success('Draft deleted')
    await load()
  }

  const total = incidents.length + operations.length

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><div className="page-title">DRAFTS</div><div className="page-subtitle">{total} pending local drafts</div></div>
        {total > 0 && (
          <button className="btn btn--primary" onClick={handleSyncAll} disabled={syncing || !navigator.onLine}>
            {syncing ? <span className="spinner" /> : `↑ SYNC ALL (${total})`}
          </button>
        )}
      </div>

      {!navigator.onLine && (
        <div className="offline-banner" style={{ marginBottom: 16 }}>
          <span>⚠</span>OFFLINE — connect to sync drafts
        </div>
      )}

      {loading ? (
        <div className="flex-center gap-12" style={{ padding: 40 }}><div className="spinner" /></div>
      ) : total === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✓</div>
          <div className="empty-state__title">No pending drafts</div>
          <div className="empty-state__desc">All entries have been synced to the server</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {incidents.length > 0 && (
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>INCIDENT DRAFTS ({incidents.length})</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead><tr><th>SYNC STATE</th><th>TYPE</th><th>TITLE</th><th>CREATED</th><th></th></tr></thead>
                  <tbody>
                    {incidents.map(d => (
                      <tr key={d.localId}>
                        <td>
                          <span className={`badge ${d.syncState === 'REJECTED' ? 'badge--escalated' : 'badge--pending'}`}>
                            {d.syncState}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{d.type}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.title}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(d.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <button className="btn btn--ghost btn--sm" onClick={() => handleDelete('incident', d.localId)}
                            style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,90,0.3)' }}>
                            DELETE
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {operations.length > 0 && (
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>OPERATION DRAFTS ({operations.length})</div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead><tr><th>SYNC STATE</th><th>NOTES</th><th>CREATED</th><th></th></tr></thead>
                  <tbody>
                    {operations.map(d => (
                      <tr key={d.localId}>
                        <td>
                          <span className={`badge ${d.syncState === 'REJECTED' ? 'badge--escalated' : 'badge--pending'}`}>
                            {d.syncState}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{d.notes ?? '—'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(d.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <button className="btn btn--ghost btn--sm" onClick={() => handleDelete('operation', d.localId)}
                            style={{ color: 'var(--danger)', borderColor: 'rgba(255,61,90,0.3)' }}>
                            DELETE
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
