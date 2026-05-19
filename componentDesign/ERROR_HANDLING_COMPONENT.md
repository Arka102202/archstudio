# Shared Error Handling — Entity Update + Component Spec

> Claude Code: read this in full before writing a single line.
> This document covers three things:
>   1. The updated ErrorDefinition entity (already updated in CLAUDE.md — confirm it)
>   2. The shared ErrorHandlingSection component used in both inspectors
>   3. What to change in ControllerInspector and APIEndpointInspector

---

## 1. Updated Entity — Confirm in `src/entity/ControllerNode.ts`

The canonical definition is in CLAUDE.md. Ensure `src/entity/ControllerNode.ts`
matches exactly:

```typescript
// Shared by ControllerNode and APIEndpointNode
export interface ErrorDefinition {
  id:               string
  description:      string              // plain English — "User not found"
  httpStatus:       number              // e.g. 404, 400, 500
  message:          string              // client-facing response message
  includeTimestamp: boolean             // include timestamp in this error's response
  fields:           ErrorResponseField[] // extra key-value pairs in response body
}

export interface ErrorResponseField {
  key:   string
  value: string
}
```

**Remove from this file entirely:**
- `ErrorMatchStrategy` enum
- `exceptionClass` field
- `errorCode` field
- `createException` field
- `logLevel` field
- `LogLevel` enum — unless it is used elsewhere. Search the codebase.
  If LogLevel is only used in error definitions, remove it. If it is used
  in ServiceNode (ErrorContract) then keep it in `src/entity/ServiceNode.ts`
  but remove it from `ControllerNode.ts`.

**Update `ErrorHandlerConfig`** — no changes needed, it already uses `ErrorDefinition[]`.

---

## 2. Updated Entity — Confirm in `src/entity/APIEndpointNode.ts`

```typescript
export interface EndpointErrorHandling {
  inheritFromController: boolean
  errors:                ErrorDefinition[]  // same type — import from ControllerNode or shared
}
```

Remove `EndpointError` interface entirely from this file.
Remove any import of `ErrorMatchStrategy`.

**Import `ErrorDefinition`** from wherever it is defined.
If both files import it, consider moving `ErrorDefinition` and `ErrorResponseField`
to `src/entity/shared.ts` so there is one canonical source.

> Preferred approach: move `ErrorDefinition` + `ErrorResponseField` to `shared.ts`.
> Export them from there. Both `ControllerNode.ts` and `APIEndpointNode.ts` import from `shared.ts`.

After changes: `npx tsc --noEmit` — zero errors before continuing.

---

## 3. Shared Component

### File structure

```
src/components/shared/ErrorHandlingSection/
├── ErrorHandlingSection.tsx     JSX only — zero logic
├── useErrorHandling.ts          all state and handlers
├── types.ts                     props + local types
└── index.ts                     barrel export
```

### types.ts

```typescript
import type { ErrorDefinition } from '@entity'

export interface ErrorHandlingSectionProps {
  errors:         ErrorDefinition[]
  onChange:       (updated: ErrorDefinition[]) => void
  // Optional: label for the section header (default: "ERROR HANDLING")
  sectionLabel?:  string
}
```

`onChange` is called with the full updated `errors` array whenever anything changes.
The parent inspector is responsible for writing to RF state and IDB.
The component is fully controlled — it owns no state of its own.

### useErrorHandling.ts

```typescript
import { useState, useCallback } from 'react'
import type { ErrorDefinition, ErrorResponseField } from '@entity'
import { generateId } from '@utils'

export function useErrorHandling(
  errors:   ErrorDefinition[],
  onChange: (updated: ErrorDefinition[]) => void,
) {
  // Which error card is expanded — local UI state only
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────

  const update = useCallback((id: string, patch: Partial<ErrorDefinition>) => {
    onChange(errors.map(e => e.id === id ? { ...e, ...patch } : e))
  }, [errors, onChange])

  const updateField = useCallback((
    errorId: string,
    fieldIdx: number,
    patch: Partial<ErrorResponseField>,
  ) => {
    onChange(errors.map(e =>
      e.id === errorId
        ? { ...e, fields: e.fields.map((f, i) => i === fieldIdx ? { ...f, ...patch } : f) }
        : e
    ))
  }, [errors, onChange])

  // ── Error CRUD ───────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    const newError: ErrorDefinition = {
      id:               generateId(),
      description:      '',
      httpStatus:       400,
      message:          '',
      includeTimestamp: true,
      fields:           [],
    }
    const updated = [...errors, newError]
    onChange(updated)
    setExpandedId(newError.id)  // auto-expand the new card
  }, [errors, onChange])

  const handleRemove = useCallback((id: string) => {
    onChange(errors.filter(e => e.id !== id))
    if (expandedId === id) setExpandedId(null)
  }, [errors, onChange, expandedId])

  const handleDescriptionChange = useCallback((id: string, value: string) => {
    update(id, { description: value })
  }, [update])

  const handleHttpStatusChange = useCallback((id: string, value: number) => {
    update(id, { httpStatus: value })
  }, [update])

  const handleMessageChange = useCallback((id: string, value: string) => {
    update(id, { message: value })
  }, [update])

  const handleTimestampToggle = useCallback((id: string) => {
    const error = errors.find(e => e.id === id)
    if (!error) return
    update(id, { includeTimestamp: !error.includeTimestamp })
  }, [errors, update])

  // ── Response fields ──────────────────────────────────────────────────────

  const handleAddField = useCallback((errorId: string) => {
    const error = errors.find(e => e.id === errorId)
    if (!error) return
    const newField: ErrorResponseField = { key: '', value: '' }
    update(errorId, { fields: [...error.fields, newField] })
  }, [errors, update])

  const handleRemoveField = useCallback((errorId: string, fieldIdx: number) => {
    const error = errors.find(e => e.id === errorId)
    if (!error) return
    update(errorId, { fields: error.fields.filter((_, i) => i !== fieldIdx) })
  }, [errors, update])

  const handleFieldKeyChange = useCallback((errorId: string, fieldIdx: number, key: string) => {
    updateField(errorId, fieldIdx, { key })
  }, [updateField])

  const handleFieldValueChange = useCallback((errorId: string, fieldIdx: number, value: string) => {
    updateField(errorId, fieldIdx, { value })
  }, [updateField])

  return {
    expandedId,
    setExpandedId,
    handleAdd,
    handleRemove,
    handleDescriptionChange,
    handleHttpStatusChange,
    handleMessageChange,
    handleTimestampToggle,
    handleAddField,
    handleRemoveField,
    handleFieldKeyChange,
    handleFieldValueChange,
  }
}
```

### ErrorHandlingSection.tsx

**Tailwind for all layout. Inline `style` only for dynamic CSS variable colours.**

```tsx
import { useErrorHandling } from './useErrorHandling'
import type { ErrorHandlingSectionProps } from './types'

export function ErrorHandlingSection({
  errors,
  onChange,
  sectionLabel = 'ERROR HANDLING',
}: ErrorHandlingSectionProps) {
  const {
    expandedId, setExpandedId,
    handleAdd, handleRemove,
    handleDescriptionChange, handleHttpStatusChange,
    handleMessageChange, handleTimestampToggle,
    handleAddField, handleRemoveField,
    handleFieldKeyChange, handleFieldValueChange,
  } = useErrorHandling(errors, onChange)

  return (
    <div className="flex flex-col gap-2">

      {/* Section header */}
      <p className="text-[9px] font-mono font-bold text-text-3 uppercase tracking-wider">
        {sectionLabel}
      </p>

      {/* Error cards */}
      {errors.map(error => (
        <ErrorCard
          key={error.id}
          error={error}
          isExpanded={expandedId === error.id}
          onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
          onRemove={() => handleRemove(error.id)}
          onDescriptionChange={v => handleDescriptionChange(error.id, v)}
          onHttpStatusChange={v => handleHttpStatusChange(error.id, v)}
          onMessageChange={v => handleMessageChange(error.id, v)}
          onTimestampToggle={() => handleTimestampToggle(error.id)}
          onAddField={() => handleAddField(error.id)}
          onRemoveField={i => handleRemoveField(error.id, i)}
          onFieldKeyChange={(i, k) => handleFieldKeyChange(error.id, i, k)}
          onFieldValueChange={(i, v) => handleFieldValueChange(error.id, i, v)}
        />
      ))}

      {/* Add error button */}
      <button
        onClick={handleAdd}
        className="w-full py-1.5 text-[11px] font-semibold border border-dashed
                   border-[var(--color-border-strong)] rounded-[var(--radius-sm)]
                   text-text-3 hover:border-[var(--color-accent)]
                   hover:text-[var(--color-accent)] transition-colors bg-transparent"
      >
        + Add error handler
      </button>
    </div>
  )
}
```

### ErrorCard sub-component (inside the same file — not exported)

**Collapsed state** — flex row, click anywhere to expand:

```
┌─────────────────────────────────────────────────────┐
│  [404]  User not found                         [×]  │
└─────────────────────────────────────────────────────┘
```

- Status chip: 3xx = muted, 4xx = amber, 5xx = red
- Description text truncated to 1 line (muted mono)
- `×` button top-right, removes the error

```tsx
// Collapsed view
<div
  className="rounded-[var(--radius-sm)] border border-[var(--color-border)]
             px-3 py-2 cursor-pointer hover:border-[var(--color-border-strong)]
             transition-colors"
  onClick={onToggle}
>
  <div className="flex items-center gap-2 min-w-0">
    <StatusChip status={error.httpStatus} />
    <span className="text-[11px] font-mono text-text-2 flex-1 truncate">
      {error.description || <span className="text-text-4 italic">no description</span>}
    </span>
    <button
      onClick={e => { e.stopPropagation(); onRemove() }}
      className="text-[10px] text-text-4 hover:text-[var(--color-danger)]
                 transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
    >
      ×
    </button>
  </div>
</div>
```

**Expanded state** — all fields shown:

```
┌─────────────────────────────────────────────────────┐
│  [404]  User not found                         [×]  │  ← collapsed header still shows
├─────────────────────────────────────────────────────┤
│  Description                                        │
│  ┌──────────────────────────────────────────────┐   │
│  │ This error fires when the requested user     │   │
│  │ does not exist in the database.              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  HTTP status          [404              ]           │
│  Message              [User not found   ]           │
│  Include timestamp    [toggle]                      │
│                                                     │
│  RESPONSE FIELDS                                    │
│  detail  The user ID {id} was not found  [×]        │
│  [key input         ] [value input       ] [+]      │
└─────────────────────────────────────────────────────┘
```

Fields breakdown for the expanded card:

**Description textarea:**
```tsx
<textarea
  value={error.description}
  onChange={e => onDescriptionChange(e.target.value)}
  placeholder="Describe when this error occurs — e.g. User not found in the database"
  rows={3}
  className="w-full text-[11px] font-mono text-text bg-surface-alt
             border border-[var(--color-border)] rounded-[var(--radius-sm)]
             px-2 py-1.5 resize-none focus:border-[var(--color-border-focus)]
             outline-none placeholder:text-text-4"
/>
```

**HTTP status input:**
```tsx
<div className="flex items-center justify-between">
  <label className="text-[10px] text-text-3">HTTP status</label>
  <input
    type="number"
    value={error.httpStatus}
    min={100}
    max={599}
    onChange={e => onHttpStatusChange(Number(e.target.value))}
    className="w-20 text-[11px] font-mono text-text bg-surface-alt
               border border-[var(--color-border)] rounded-[var(--radius-sm)]
               px-2 py-1 text-right outline-none
               focus:border-[var(--color-border-focus)]"
  />
</div>
```

**Message input:**
```tsx
<div className="flex items-center justify-between gap-2">
  <label className="text-[10px] text-text-3 flex-shrink-0">Message</label>
  <input
    type="text"
    value={error.message}
    onChange={e => onMessageChange(e.target.value)}
    placeholder="Client-facing error message"
    className="flex-1 text-[11px] font-mono text-text bg-surface-alt
               border border-[var(--color-border)] rounded-[var(--radius-sm)]
               px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
               placeholder:text-text-4"
  />
</div>
```

**Include timestamp toggle:**
```tsx
<div className="flex items-center justify-between">
  <label className="text-[10px] text-text-3">Include timestamp</label>
  <Toggle value={error.includeTimestamp} onChange={onTimestampToggle} />
</div>
```

**Response fields sub-section:**
```tsx
<div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--color-border)]">
  <p className="text-[9px] font-mono font-bold text-text-4 uppercase">
    Response Fields
  </p>

  {error.fields.map((field, idx) => (
    <div key={idx} className="flex items-center gap-1.5 min-w-0">
      <input
        value={field.key}
        onChange={e => onFieldKeyChange(idx, e.target.value)}
        placeholder="key"
        className="w-24 flex-shrink-0 text-[10px] font-mono text-text bg-surface-alt
                   border border-[var(--color-border)] rounded-[var(--radius-sm)]
                   px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
                   placeholder:text-text-4"
      />
      <input
        value={field.value}
        onChange={e => onFieldValueChange(idx, e.target.value)}
        placeholder="value"
        className="flex-1 text-[10px] font-mono text-text bg-surface-alt
                   border border-[var(--color-border)] rounded-[var(--radius-sm)]
                   px-2 py-1 outline-none focus:border-[var(--color-border-focus)]
                   placeholder:text-text-4"
      />
      <button
        onClick={() => onRemoveField(idx)}
        className="text-[10px] text-text-4 hover:text-[var(--color-danger)]
                   transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
      >
        ×
      </button>
    </div>
  ))}

  <button
    onClick={onAddField}
    className="text-[10px] font-mono text-text-4 hover:text-[var(--color-accent)]
               transition-colors text-left bg-transparent border-none cursor-pointer"
  >
    + add field
  </button>
</div>
```

### StatusChip helper (inside the same file — not exported)

```tsx
function StatusChip({ status }: { status: number }) {
  const is4xx = status >= 400 && status < 500
  const is5xx = status >= 500

  return (
    <span
      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
      style={{
        background: is5xx
          ? 'var(--color-danger-light)'
          : is4xx
          ? 'var(--color-warning-light)'
          : 'var(--color-surface-alt)',
        color: is5xx
          ? 'var(--color-danger)'
          : is4xx
          ? 'var(--color-warning)'
          : 'var(--color-text-3)',
      }}
    >
      {status}
    </span>
  )
}
```

---

## 4. ControllerInspector — update error handling section

### In `useControllerInspector.ts`

Remove all old error handlers:
- `handleAddError`, `handleRemoveError`
- `handleErrorMatchStrategyChange`, `handleErrorExceptionClassChange`
- `handleErrorCodeChange`, `handleErrorMessageChange`
- `handleErrorAddField`, `handleErrorRemoveField`
- `handleErrorFieldKeyChange`, `handleErrorFieldValueChange`
- `handleErrorCreateExceptionToggle`, `handleErrorLogLevelChange`

Replace with a single handler:

```typescript
const handleErrorsChange = useCallback((updated: ErrorDefinition[]) => {
  const updatedNode = {
    ...node,
    errorHandlerConfig: { ...node.errorHandlerConfig, errors: updated },
  }
  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: updatedNode } : n
  ))
  debouncedUpdate(nodeId, updatedNode)
}, [node, nodeId, setNodes, debouncedUpdate])
```

Return `handleErrorsChange` from the hook.

Also keep:
- `handleIncludeTimestampToggle` — for the global `errorHandlerConfig.includeTimestamp`
- `handleIncludeRequestPathToggle` — for `errorHandlerConfig.includeRequestPath`

### In `ControllerInspector.tsx`

Replace the entire old error section with:

```tsx
{/* Section 5 — Error Handling */}
<div className="flex flex-col gap-3 px-4 py-3 border-t border-[var(--color-border)]">

  {/* Global toggles */}
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-text-3">Include timestamp globally</span>
    <Toggle
      value={node.errorHandlerConfig.includeTimestamp}
      onChange={handleIncludeTimestampToggle}
    />
  </div>
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-text-3">Include request path globally</span>
    <Toggle
      value={node.errorHandlerConfig.includeRequestPath}
      onChange={handleIncludeRequestPathToggle}
    />
  </div>

  {/* Shared component */}
  <ErrorHandlingSection
    errors={node.errorHandlerConfig.errors}
    onChange={handleErrorsChange}
  />
</div>
```

---

## 5. APIEndpointInspector — update error handling section

### In `useAPIEndpointInspector.ts`

Remove all old endpoint error handlers.

Replace with:

```typescript
const handleErrorsChange = useCallback((updated: ErrorDefinition[]) => {
  const updatedNode = {
    ...node,
    errorHandling: { ...node.errorHandling, errors: updated },
  }
  setNodes(nodes => nodes.map(n =>
    n.id === nodeId ? { ...n, data: updatedNode } : n
  ))
  debouncedUpdate(nodeId, updatedNode)
}, [node, nodeId, setNodes, debouncedUpdate])
```

Return `handleErrorsChange` from the hook.

Keep:
- `handleInheritFromControllerToggle` — flips `errorHandling.inheritFromController`

### In `APIEndpointInspector.tsx`

```tsx
{/* Section 6 — Error Handling */}
<div className="flex flex-col gap-3 px-4 py-3 border-t border-[var(--color-border)]">

  {/* Inherit toggle */}
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-text-3">Inherit from controller</span>
    <Toggle
      value={node.errorHandling.inheritFromController}
      onChange={handleInheritFromControllerToggle}
    />
  </div>

  {/* Only show error cards when not inheriting */}
  {!node.errorHandling.inheritFromController && (
    <ErrorHandlingSection
      errors={node.errorHandling.errors}
      onChange={handleErrorsChange}
      sectionLabel="ENDPOINT ERRORS"
    />
  )}
</div>
```

---

## 6. Update canvas card — ControllerNode errors row

The canvas card errors row currently shows `matchStrategy` badge + identifier.
Replace with: httpStatus chip + truncated description.

In `useControllerNode.ts`, update `errorSummary` derivation:

```typescript
const errorSummary = node.errorHandlerConfig.errors.slice(0, 2).map(e => ({
  httpStatus:  e.httpStatus,
  identifier:  e.description || `${e.httpStatus} error`,  // plain English, truncated
}))
```

No other changes to the canvas card — `StatusChip` colours already handle 4xx/5xx.

---

## 7. Export `ErrorHandlingSection` from shared barrel

In `src/components/shared/index.ts`:

```typescript
export { ErrorHandlingSection } from './ErrorHandlingSection'
```

---

## 8. Verification

### TypeScript
```bash
npx tsc --noEmit
```
Zero errors. `EndpointError`, `ErrorMatchStrategy`, `LogLevel` (if removed) — none of these should appear in TypeScript errors.

### Shared component

- [ ] `ErrorHandlingSection` renders identically in both ControllerInspector and APIEndpointInspector
- [ ] Clicking "+ Add error handler" adds a new collapsed card, auto-expanded
- [ ] Collapsed card shows: httpStatus chip (colour-coded) + description (truncated)
- [ ] Expanding a card shows all fields
- [ ] Description textarea: 3 rows, placeholder text visible when empty
- [ ] HTTP status number input: min 100, max 599
- [ ] Message input: one line text
- [ ] Include timestamp toggle works
- [ ] Add response field → key + value inputs appear in a row
- [ ] Remove response field `×` → row disappears
- [ ] Remove error card `×` → card disappears
- [ ] Empty description shows "no description" italic placeholder in collapsed view

### ControllerInspector

- [ ] Error section shows global timestamp + request path toggles above error cards
- [ ] Error cards use the shared component
- [ ] No matchStrategy, no exception class, no error code fields anywhere
- [ ] Changes persist to IDB after debounce
- [ ] Canvas card errors row shows description text (not exception class)

### APIEndpointInspector

- [ ] "Inherit from controller" toggle at top of error section
- [ ] When inherit is ON → no error cards shown
- [ ] When inherit is OFF → `ErrorHandlingSection` appears with "ENDPOINT ERRORS" label
- [ ] Adding errors to endpoint does not affect controller errors
- [ ] Changes persist to IDB after debounce

### IDB persistence

- [ ] Add error to controller → refresh → error still there with description, httpStatus, message, fields
- [ ] Add error to endpoint → refresh → error still there
- [ ] Toggle includeTimestamp → refresh → value persists
