import React from 'react'
import type { AIPrompt } from '@entity'
import { emptyAIPrompt } from '@entity/AIPrompt'
import { Toggle } from '../Toggle'
import type { AIPromptBoxProps } from './types'

const FIELDS: { field: keyof AIPrompt; label: string; rows: number; placeholder: string }[] = [
  { field: 'description',       label: 'Description',        rows: 3, placeholder: 'What should this do…' },
  { field: 'businessRules',     label: 'Business Rules',     rows: 2, placeholder: 'Domain-specific rules and constraints…' },
  { field: 'edgeCases',         label: 'Edge Cases',         rows: 2, placeholder: "What to handle that isn't obvious…" },
  { field: 'expectedBehaviour', label: 'Expected Behaviour', rows: 2, placeholder: "What 'done' looks like…" },
]

const AIPromptBox = ({ value: rawValue, onChange, onGenerateToggle }: AIPromptBoxProps): React.JSX.Element => {
  const value: AIPrompt = rawValue ?? emptyAIPrompt()
  return (
  <div
    className="rounded-md p-3 border"
    style={{
      background:  'linear-gradient(135deg, var(--ai-box-bg-from), var(--ai-box-bg-to))',
      borderColor: 'var(--ai-box-border)',
    }}
  >
    {/* Header */}
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
          style={{ background: 'var(--ai-dot-color)' }}
        />
        <span className="text-[9px] font-bold font-ui uppercase tracking-[0.10em] text-text-3">
          AI Prompt
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-text-3 font-ui">AI generates code</span>
        <Toggle value={value.aiGenerate} onChange={onGenerateToggle} />
      </div>
    </div>

    {/* Fields — shown only when aiGenerate is on */}
    {value.aiGenerate && (
      <div className="flex flex-col gap-2">
        {FIELDS.map(({ field, label, rows, placeholder }) => (
          <div key={field}>
            <p className="text-[9px] font-semibold font-ui uppercase tracking-[0.08em] text-text-3 mb-1">
              {label}
            </p>
            <textarea
              rows={rows}
              value={String(value[field] ?? '')}
              onChange={e => onChange(field, e.target.value)}
              placeholder={placeholder}
              className="w-full outline-none resize-none bg-transparent border rounded-sm px-2 py-1.5 text-[10px] text-text font-ui leading-relaxed"
              style={{ borderColor: 'var(--ai-box-border)' }}
            />
          </div>
        ))}
      </div>
    )}
  </div>
  )
}

export default AIPromptBox
