import React from 'react'
import ReactDOM from 'react-dom'
import { RelationType } from '@entity'
import { Toggle } from '@components/shared/Toggle'
import { useRelationshipModal } from './useRelationshipModal'

// ─── RelationshipModal ────────────────────────────────────────────
// Always mounted. Reads open state from Zustand store.
// Rendered via portal at document.body to sit above React Flow canvas.

const inputClass =
  'w-full text-[12px] font-mono text-text bg-surface-alt border border-[var(--color-border)] ' +
  'rounded-[var(--radius-sm)] px-3 py-2 outline-none focus:border-[var(--color-border-focus)]'

const RelationshipModal = (): React.JSX.Element | null => {
  const {
    isOpen,
    entityALabel,
    entityBLabel,
    relationType,
    setRelationType,
    twoWayBinding,
    setTwoWayBinding,
    sourceFieldName,
    setSourceFieldName,
    targetFieldName,
    setTargetFieldName,
    inverseRelationType,
    setInverseRelationType,
    handleConfirm,
    handleCancel,
  } = useRelationshipModal()

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleCancel}
      />

      {/* Modal card */}
      <div
        className="relative bg-surface rounded-[var(--radius-lg)] shadow-modal w-[420px] max-w-[90vw] p-5 flex flex-col gap-4"
        style={{ border: '1px solid var(--color-border-strong)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-bold text-text">Entity Relationship</p>
            <p className="text-[11px] font-mono text-text-3 mt-0.5">
              {entityALabel} ↔ {entityBLabel}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-text-4 hover:text-text transition-colors bg-transparent border-none cursor-pointer text-[16px]"
          >
            ×
          </button>
        </div>

        {/* Relation type + field name on source */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1.5 w-[48%]">
            <label className="text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
              Relation type
            </label>
            <select
              value={relationType}
              onChange={e => setRelationType(e.target.value as RelationType)}
              className={inputClass}
            >
              <option value={RelationType.ONE_TO_ONE}>@OneToOne</option>
              <option value={RelationType.ONE_TO_MANY}>@OneToMany</option>
              <option value={RelationType.MANY_TO_ONE}>@ManyToOne</option>
              <option value={RelationType.MANY_TO_MANY}>@ManyToMany</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
              Field name on {entityALabel}
            </label>
            <input
              type="text"
              value={sourceFieldName}
              onChange={e => setSourceFieldName(e.target.value)}
              placeholder={entityBLabel.charAt(0).toLowerCase() + entityBLabel.slice(1)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Two-way binding */}
        <div
          className="flex flex-col gap-2.5 p-3 rounded-[var(--radius-sm)]"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-2">Two-way binding</span>
            <Toggle value={twoWayBinding} onChange={() => setTwoWayBinding(v => !v)} />
          </div>

          {twoWayBinding ? (
            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 w-[48%]">
                <label className="text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
                  Inverse type
                </label>
                <select
                  value={inverseRelationType}
                  onChange={e => setInverseRelationType(e.target.value as RelationType)}
                  className={inputClass}
                >
                  <option value={RelationType.ONE_TO_ONE}>@OneToOne</option>
                  <option value={RelationType.ONE_TO_MANY}>@OneToMany</option>
                  <option value={RelationType.MANY_TO_ONE}>@ManyToOne</option>
                  <option value={RelationType.MANY_TO_MANY}>@ManyToMany</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-mono font-bold text-text-3 uppercase tracking-wider">
                  Field name on {entityBLabel}
                </label>
                <input
                  type="text"
                  value={targetFieldName}
                  onChange={e => setTargetFieldName(e.target.value)}
                  placeholder={entityALabel.charAt(0).toLowerCase() + entityALabel.slice(1)}
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <p className="text-[10px] font-mono text-text-4">
              Only the field in {entityALabel} will be created.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-[11px] font-semibold text-text-3 bg-surface-alt rounded-[var(--radius-sm)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleConfirm() }}
            className="px-4 py-2 text-[11px] font-semibold rounded-[var(--radius-sm)] cursor-pointer transition-colors"
            style={{
              background: 'var(--color-accent)',
              color:      'var(--color-accent-text)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default RelationshipModal
