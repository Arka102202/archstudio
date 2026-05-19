import { useState, useCallback, useEffect, useRef } from 'react'
import type { ErrorDefinition, ErrorResponseField } from '@entity'
import { generateId } from '@utils'

// ─── Hook ─────────────────────────────────────────────────────────

export function useErrorHandling(
  errors:   ErrorDefinition[],
  onChange: (updated: ErrorDefinition[]) => void,
): {
  expandedId:                string | null
  setExpandedId:             (id: string | null) => void
  handleAdd:                 () => void
  handleRemove:              (id: string) => void
  handleDescriptionChange:   (id: string, value: string) => void
  handleHttpStatusChange:    (id: string, value: number) => void
  handleMessageChange:       (id: string, value: string) => void
  handleTimestampToggle:     (id: string) => void
  handleAddField:            (errorId: string) => void
  handleRemoveField:         (errorId: string, fieldIdx: number) => void
  handleFieldKeyChange:      (errorId: string, fieldIdx: number, key: string) => void
  handleFieldValueChange:    (errorId: string, fieldIdx: number, value: string) => void
} {
  // Which error card is expanded — local UI state only
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Deduplicate IDs — AI-generated errors often arrive with identical IDs ──
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const seen = new Set<string>()
    let dirty = false
    const fixed = errors.map(e => {
      if (!e.id || seen.has(e.id)) {
        dirty = true
        const id = generateId()
        seen.add(id)
        return { ...e, id }
      }
      seen.add(e.id)
      return e
    })
    if (dirty) onChangeRef.current(fixed)
  }, [errors])

  // ── Helpers ─────────────────────────────────────────────────────────────

  const update = useCallback((id: string, patch: Partial<ErrorDefinition>): void => {
    onChange(errors.map(e => e.id === id ? { ...e, ...patch } : e))
  }, [errors, onChange])

  const updateField = useCallback((
    errorId:  string,
    fieldIdx: number,
    patch:    Partial<ErrorResponseField>,
  ): void => {
    onChange(errors.map(e =>
      e.id === errorId
        ? { ...e, fields: e.fields.map((f, i) => i === fieldIdx ? { ...f, ...patch } : f) }
        : e,
    ))
  }, [errors, onChange])

  // ── Error CRUD ───────────────────────────────────────────────────────────

  const handleAdd = useCallback((): void => {
    const newError: ErrorDefinition = {
      id:               generateId(),
      description:      '',
      httpStatus:       400,
      message:          '',
      includeTimestamp: true,
      fields:           [],
    }
    onChange([...errors, newError])
    setExpandedId(newError.id)  // auto-expand the new card
  }, [errors, onChange])

  const handleRemove = useCallback((id: string): void => {
    onChange(errors.filter(e => e.id !== id))
    setExpandedId(prev => prev === id ? null : prev)
  }, [errors, onChange])

  const handleDescriptionChange = useCallback((id: string, value: string): void => {
    update(id, { description: value })
  }, [update])

  const handleHttpStatusChange = useCallback((id: string, value: number): void => {
    update(id, { httpStatus: value })
  }, [update])

  const handleMessageChange = useCallback((id: string, value: string): void => {
    update(id, { message: value })
  }, [update])

  const handleTimestampToggle = useCallback((id: string): void => {
    const error = errors.find(e => e.id === id)
    if (!error) return
    update(id, { includeTimestamp: !error.includeTimestamp })
  }, [errors, update])

  // ── Response fields ──────────────────────────────────────────────────────

  const handleAddField = useCallback((errorId: string): void => {
    const error = errors.find(e => e.id === errorId)
    if (!error) return
    const newField: ErrorResponseField = { key: '', value: '' }
    update(errorId, { fields: [...error.fields, newField] })
  }, [errors, update])

  const handleRemoveField = useCallback((errorId: string, fieldIdx: number): void => {
    const error = errors.find(e => e.id === errorId)
    if (!error) return
    update(errorId, { fields: error.fields.filter((_, i) => i !== fieldIdx) })
  }, [errors, update])

  const handleFieldKeyChange = useCallback((
    errorId:  string,
    fieldIdx: number,
    key:      string,
  ): void => {
    updateField(errorId, fieldIdx, { key })
  }, [updateField])

  const handleFieldValueChange = useCallback((
    errorId:  string,
    fieldIdx: number,
    value:    string,
  ): void => {
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
