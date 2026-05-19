import { db } from '@db'
import { exportArchitecture } from './exportArchitecture'

// ─── saveVersion ─────────────────────────────────────────────────
// Captures a full architecture snapshot for a MicroserviceNode and
// persists it to the IDB versions table with an auto-incrementing
// version number (per msId).
//
// Returns the version number that was saved.

export async function saveVersion(
  msId:      string,
  projectId: string,
): Promise<number> {
  // Build the full snapshot from current IDB state
  const rawSnapshot = await exportArchitecture(msId, projectId)

  // Determine the next version number for this msId
  const existing = await db.versions.where('msId').equals(msId).toArray()
  const maxVersion = existing.reduce((max, row) => Math.max(max, row.version), 0)
  const nextVersion = maxVersion + 1

  // Inject the version key into the snapshot
  const snapshot = { version: nextVersion, ...(rawSnapshot as Record<string, unknown>) }

  // Persist to IDB
  const id = `${msId}-v${nextVersion}`
  await db.versions.put({
    id,
    projectId,
    msId,
    version:  nextVersion,
    snapshot: JSON.stringify(snapshot),
    savedAt:  Date.now(),
  })

  console.group(`[archflow version] v${nextVersion} saved`)
  console.log(snapshot)
  console.groupEnd()

  return nextVersion
}
