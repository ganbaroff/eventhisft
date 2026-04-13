// OPSBOARD — Offline sync queue
// Attempts to sync pending local drafts when connection is restored.
// Honest about failures — marks rejected, never silently merges.

import { draftIncidents, draftOperations } from './offline'
import { incidentsApi, operationsApi } from '../api/client'
import { toast } from '../store/toast.store'

let syncInProgress = false

export async function syncPendingDrafts(shiftId?: string): Promise<void> {
  if (!navigator.onLine || syncInProgress) return
  syncInProgress = true

  try {
    await syncIncidentDrafts()
    if (shiftId) await syncOperationDrafts(shiftId)
  } finally {
    syncInProgress = false
  }
}

async function syncIncidentDrafts() {
  const drafts = await draftIncidents.getAll()
  const pending = drafts.filter((d) => d.syncState === 'PENDING_CONFIRMATION')
  if (pending.length === 0) return

  let synced = 0
  let failed = 0

  for (const draft of pending) {
    try {
      await incidentsApi.create({
        type: draft.type,
        title: draft.title,
        description: draft.description,
        zoneId: draft.zoneId,
        serviceId: draft.serviceId,
      })
      await draftIncidents.delete(draft.localId)
      synced++
    } catch {
      await draftIncidents.save({ ...draft, syncState: 'REJECTED', rejectionReason: 'Server rejected sync' })
      failed++
    }
  }

  if (synced > 0) toast.success(`${synced} draft incident${synced > 1 ? 's' : ''} synced`)
  if (failed > 0) toast.error(`${failed} incident draft${failed > 1 ? 's' : ''} failed to sync — review required`)
}

async function syncOperationDrafts(shiftId: string) {
  const drafts = await draftOperations.getAll()
  const pending = drafts.filter((d) => d.syncState === 'PENDING_CONFIRMATION')
  if (pending.length === 0) return

  let synced = 0
  let failed = 0

  for (const draft of pending) {
    try {
      const op = await operationsApi.create({
        shiftId,
        serviceId: draft.serviceId,
        zoneId: draft.zoneId,
        notes: draft.notes,
      })
      await operationsApi.submit(op.id)
      await draftOperations.delete(draft.localId)
      synced++
    } catch {
      await draftOperations.save({ ...draft, syncState: 'REJECTED', rejectionReason: 'Server rejected sync' })
      failed++
    }
  }

  if (synced > 0) toast.success(`${synced} draft operation${synced > 1 ? 's' : ''} synced`)
  if (failed > 0) toast.error(`${failed} operation draft${failed > 1 ? 's' : ''} failed — review required`)
}

// Register online event listener — call once at app boot
export function registerSyncOnReconnect(getShiftId: () => string | undefined) {
  window.addEventListener('online', () => {
    toast.info('Connection restored — syncing drafts...')
    setTimeout(() => syncPendingDrafts(getShiftId()), 1000)
  })
}
