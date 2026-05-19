// ─── Types ────────────────────────────────────────────────────────

export interface ArchDiff {
  version: number                         // version the current state is diffed against
  added:   Record<string, unknown>        // keys/values in current but not in saved
  removed: Record<string, unknown>        // keys/values in saved but not in current
  changed: Record<string, ChangedEntry>   // keys in both but with different values
}

interface ChangedEntry {
  from: unknown
  to:   unknown
}

// ─── Human-readable array key resolution ─────────────────────────
//
// Priority for objects:
//   edge (has from+to)  → "fromId->toId"
//   name                → used for fields, params, methods, swagger tags
//   methodName          → used for custom queries
//   label               → used for top-level nodes (entities, dtos, etc.)
//   type                → used for validations (NOT_NULL, MIN, MAX…)
//   id                  → fallback for anything with a uuid key
//   index               → last resort
//
// Primitive items (strings in tag arrays, etc.) are keyed by their value.

const itemKey = (item: unknown, index: number): string => {
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    return String(item)
  }
  if (item !== null && typeof item === 'object') {
    const obj = item as Record<string, unknown>

    // Edges are uniquely identified by their from→to pair
    if (typeof obj['from'] === 'string' && typeof obj['to'] === 'string') {
      return `${obj['from']}->${obj['to']}`
    }

    if (typeof obj['name']       === 'string' && obj['name'])       return obj['name']
    if (typeof obj['methodName'] === 'string' && obj['methodName']) return obj['methodName']
    if (typeof obj['label']      === 'string' && obj['label'])      return obj['label']
    if (typeof obj['type']       === 'string' && obj['type'])       return obj['type']
    if (typeof obj['id']         === 'string' && obj['id'])         return obj['id']
  }
  return String(index)
}

// ─── Core recursive differ ────────────────────────────────────────

function deepDiffValues(
  saved:   unknown,
  current: unknown,
  path:    string,
  added:   Record<string, unknown>,
  removed: Record<string, unknown>,
  changed: Record<string, ChangedEntry>,
): void {
  // Arrays — diff by human-readable item identity
  if (Array.isArray(saved) && Array.isArray(current)) {
    const savedMap   = new Map<string, unknown>()
    const currentMap = new Map<string, unknown>()

    saved.forEach((item, i)   => savedMap.set(itemKey(item, i),   item))
    current.forEach((item, i) => currentMap.set(itemKey(item, i), item))

    for (const [key, savedItem] of savedMap) {
      if (!currentMap.has(key)) {
        removed[`${path}[${key}]`] = savedItem
      } else {
        deepDiffValues(savedItem, currentMap.get(key), `${path}[${key}]`, added, removed, changed)
      }
    }
    for (const [key, currentItem] of currentMap) {
      if (!savedMap.has(key)) {
        added[`${path}[${key}]`] = currentItem
      }
    }
    return
  }

  // Plain objects — recurse over every key
  if (
    saved   !== null && typeof saved   === 'object' && !Array.isArray(saved) &&
    current !== null && typeof current === 'object' && !Array.isArray(current)
  ) {
    const savedObj   = saved   as Record<string, unknown>
    const currentObj = current as Record<string, unknown>
    const allKeys    = new Set([...Object.keys(savedObj), ...Object.keys(currentObj)])

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key
      if (!(key in savedObj)) {
        added[childPath] = currentObj[key]
      } else if (!(key in currentObj)) {
        removed[childPath] = savedObj[key]
      } else {
        deepDiffValues(savedObj[key], currentObj[key], childPath, added, removed, changed)
      }
    }
    return
  }

  // Primitives — record any change
  if (saved !== current) {
    changed[path] = { from: saved, to: current }
  }
}

// ─── diffArchitecture ─────────────────────────────────────────────
// Pure function. Takes the saved snapshot object and the current
// live snapshot object, returns a structured deep diff with
// human-readable paths.
//
// Example path:  dtos[StudentListReqDTO].fields[page_size].validations[MAX].message
//
// The `version` field in the result is the version number of the
// saved snapshot being diffed against.

export function diffArchitecture(
  saved:   Record<string, unknown>,
  current: Record<string, unknown>,
): ArchDiff {
  const added:   Record<string, unknown>      = {}
  const removed: Record<string, unknown>      = {}
  const changed: Record<string, ChangedEntry> = {}

  // Strip the 'version' key — it will always differ between snapshots
  const savedFiltered   = Object.fromEntries(Object.entries(saved).filter(([k]) => k !== 'version'))
  const currentFiltered = Object.fromEntries(Object.entries(current).filter(([k]) => k !== 'version'))

  deepDiffValues(savedFiltered, currentFiltered, '', added, removed, changed)

  // Strip any accidental leading dot from root-level keys
  const clean = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/^\./, ''), v]))

  return {
    version: typeof saved['version'] === 'number' ? saved['version'] : 0,
    added:   clean(added),
    removed: clean(removed),
    changed: clean(changed) as Record<string, ChangedEntry>,
  }
}
