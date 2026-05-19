import React from 'react'
import { MESSAGES } from '@constants/messages'
import { useCreateProjectModal } from './useCreateProjectModal'
import type { CreateProjectModalProps } from './types'

const CreateProjectModal = ({ onSubmit, onClose }: CreateProjectModalProps): React.JSX.Element => {
  const {
    name,
    description,
    isSubmitting,
    canSubmit,
    nameInputRef,
    setName,
    setDescription,
    handleSubmit,
    handleKeyDown,
  } = useCreateProjectModal({ onSubmit, onClose })

  return (
    /* Overlay */
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center backdrop-blur-[4px]"
      style={{ background: 'rgba(0,0,0,0.28)' }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-[440px] bg-surface rounded-lg shadow-modal p-7 flex flex-col gap-5"
      >
        {/* Header */}
        <div>
          <p className="text-base font-bold text-text mb-1">
            {MESSAGES.project.modalTitle}
          </p>
          <p className="text-[13px] text-text-3">
            {MESSAGES.project.modalSubtitle}
          </p>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3.5">
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-medium text-text-2 mb-1.5"
            >
              {MESSAGES.project.nameLabel}
            </label>
            <input
              id="project-name"
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={MESSAGES.project.namePlaceholder}
              className="w-full py-2 px-2.5 text-[13px] outline-none font-ui border border-border-strong bg-surface-alt text-text rounded-sm"
              onFocus={e => {
                e.target.style.borderColor = 'var(--color-border-focus)'
                e.target.style.background  = 'var(--color-surface)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--color-border-strong)'
                e.target.style.background  = 'var(--color-surface-alt)'
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="project-description"
              className="block text-xs font-medium text-text-2 mb-1.5"
            >
              {MESSAGES.project.descriptionLabel}
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={MESSAGES.project.descriptionPlaceholder}
              rows={3}
              className="w-full py-2 px-2.5 text-[13px] outline-none font-ui border border-border-strong bg-surface-alt text-text resize-y rounded-sm"
              onFocus={e => {
                e.target.style.borderColor = 'var(--color-border-focus)'
                e.target.style.background  = 'var(--color-surface)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--color-border-strong)'
                e.target.style.background  = 'var(--color-surface-alt)'
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-[7px] bg-transparent border border-border-strong rounded-sm text-[13px] text-text-2 cursor-pointer"
          >
            {MESSAGES.project.cancelButton}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="px-4 py-[7px] bg-accent text-accent-text border-none rounded-sm text-[13px] font-semibold transition-opacity duration-150"
            style={{
              cursor:  canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {isSubmitting ? 'Creating…' : MESSAGES.project.createButton}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateProjectModal
