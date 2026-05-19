import React, { useRef, useEffect } from 'react'
import { useCodeChatInput } from './useCodeChatInput'
import type { CodeChatInputProps, TreeFolder, TreeFile, CheckState } from './types'

// ─── Shared checkbox icon ─────────────────────────────────────────────────────

const CheckBox = ({ state, size = 14 }: { state: CheckState; size?: number }): React.JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    {state === 'none' ? (
      <rect x="2" y="2" width="16" height="16" rx="3"
        stroke="var(--color-border)" strokeWidth="1.5" fill="none" />
    ) : state === 'all' ? (
      <>
        <rect x="2" y="2" width="16" height="16" rx="3" fill="var(--color-accent)" />
        <polyline points="5,10 8,14 15,6"
          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : (
      <>
        <rect x="2" y="2" width="16" height="16" rx="3" fill="var(--color-accent)" />
        <line x1="5" y1="10" x2="15" y2="10"
          stroke="white" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
  </svg>
)

// ─── Chevron for folder expand ────────────────────────────────────────────────

const Chevron = ({ open }: { open: boolean }): React.JSX.Element => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.12s', flexShrink: 0 }}>
    <polyline points="3,2 7,5 3,8" />
  </svg>
)

// ─── Tree row for a file ──────────────────────────────────────────────────────

const FileRow = ({
  node, depth, checked, onToggle,
}: {
  node:     TreeFile
  depth:    number
  checked:  boolean
  onToggle: (path: string) => void
}): React.JSX.Element => (
  <button
    onMouseDown={e => { e.preventDefault(); onToggle(node.path) }}
    className="w-full flex items-center gap-1.5 px-2 py-1 cursor-pointer border-none text-left transition-colors"
    style={{
      paddingLeft: 8 + depth * 16,
      background:  'transparent',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
  >
    <CheckBox state={checked ? 'all' : 'none'} size={13} />
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {node.name}
    </span>
  </button>
)

// ─── Tree row for a folder ────────────────────────────────────────────────────

const FolderRow = ({
  node, depth, checkState, expanded, onToggleExpand, onTogglePick,
  attachedPathSet, isFolderExpanded, getFolderState, onToggleFilePick,
}: {
  node:            TreeFolder
  depth:           number
  checkState:      CheckState
  expanded:        boolean
  onToggleExpand:  (path: string) => void
  onTogglePick:    (folder: TreeFolder) => void
  attachedPathSet: Set<string>
  isFolderExpanded:(path: string) => boolean
  getFolderState:  (folder: TreeFolder) => CheckState
  onToggleFilePick:(path: string) => void
}): React.JSX.Element => (
  <>
    <div
      className="flex items-center gap-1 py-1 cursor-default"
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {/* Expand arrow */}
      <button
        onMouseDown={e => { e.preventDefault(); onToggleExpand(node.path) }}
        className="flex items-center justify-center w-4 h-4 cursor-pointer border-none p-0"
        style={{ background: 'transparent', color: 'var(--color-text-3)' }}
      >
        <Chevron open={expanded} />
      </button>

      {/* Folder checkbox */}
      <button
        onMouseDown={e => { e.preventDefault(); onTogglePick(node) }}
        className="flex items-center gap-1.5 flex-1 cursor-pointer border-none p-0 text-left"
        style={{ background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <CheckBox state={checkState} size={13} />
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)', fontWeight: 600 }}>
          {node.name}/
        </span>
      </button>
    </div>

    {/* Children */}
    {expanded && node.children.map((child, i) =>
      child.kind === 'folder' ? (
        <FolderRow
          key={i}
          node={child}
          depth={depth + 1}
          checkState={getFolderState(child)}
          expanded={isFolderExpanded(child.path)}
          onToggleExpand={onToggleExpand}
          onTogglePick={onTogglePick}
          attachedPathSet={attachedPathSet}
          isFolderExpanded={isFolderExpanded}
          getFolderState={getFolderState}
          onToggleFilePick={onToggleFilePick}
        />
      ) : (
        <FileRow
          key={i}
          node={child as TreeFile}
          depth={depth + 1}
          checked={attachedPathSet.has((child as TreeFile).path)}
          onToggle={onToggleFilePick}
        />
      ),
    )}
  </>
)

// ─── Main component ───────────────────────────────────────────────────────────

const CodeChatInput = (props: CodeChatInputProps): React.JSX.Element => {
  const {
    isLoading,
    isSendingArchitecture,
    hasActiveMsId,
    attachedFiles,
    availableFiles,
    onToggleArchitecture,
    onAbort,
  } = props

  const {
    text, textareaRef,
    handleChange, handleKeyDown, handleSubmit, handleDetach,
    // @ mention
    dropdownVisible, dropdownFiles, dropdownHighlight, setDropdownHighlight, selectFile,
    // Rich picker
    pickerOpen, setPickerOpen,
    pickerView, setPickerView,
    fileTree, attachedPathSet, globalCheckState,
    toggleFilePick, toggleFolderPick, toggleAllPick,
    getFolderState, isFolderExpanded, toggleFolderExpand,
  } = useCodeChatInput(props)

  const atDropdownRef  = useRef<HTMLDivElement>(null)
  const pickerRef      = useRef<HTMLDivElement>(null)

  // Close @ dropdown and picker on outside click
  useEffect(() => {
    if (!pickerOpen && !dropdownVisible) return
    const handler = (e: MouseEvent): void => {
      if (atDropdownRef.current && !atDropdownRef.current.contains(e.target as Node)) {
        // handled in useCodeChatInput via handleChange
      }
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen, dropdownVisible, setPickerOpen])

  const fileName = (path: string): string => path.split('/').pop() ?? path

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-2 p-3 border-t"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* ── Attached file chips ──────────────────────────────────── */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attachedFiles.map(f => (
            <span
              key={f.path}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono"
              style={{
                background: 'var(--color-accent)1a',
                border:     '1px solid var(--color-accent)44',
                color:      'var(--color-accent)',
              }}
            >
              @{f.name}
              <button
                onClick={() => handleDetach(f.path)}
                className="flex-shrink-0 cursor-pointer border-none p-0 leading-none"
                style={{ background: 'transparent', color: 'var(--color-accent)', opacity: 0.7, fontSize: 11 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Dropdowns + textarea ─────────────────────────────────── */}
      <div className="relative flex flex-col gap-1.5">

        {/* ── @ mention autocomplete (simple) ──────────────────── */}
        {dropdownVisible && (
          <div
            ref={atDropdownRef}
            className="absolute bottom-full mb-1 left-0 right-0 z-20 rounded-[var(--radius-sm)] overflow-hidden"
            style={{
              background: 'var(--color-surface-raised)',
              border:     '1px solid var(--color-border)',
              boxShadow:  'var(--shadow-md)',
              maxHeight:  180,
              overflowY:  'auto',
            }}
          >
            {dropdownFiles.length === 0 ? (
              <div className="px-3 py-2 text-[11px] font-mono" style={{ color: 'var(--color-text-4)' }}>
                No files match
              </div>
            ) : (
              dropdownFiles.map((path, i) => (
                <button
                  key={path}
                  onMouseDown={e => { e.preventDefault(); selectFile(path) }}
                  onMouseEnter={() => setDropdownHighlight(i)}
                  className="w-full flex flex-col px-3 py-1.5 cursor-pointer border-none text-left transition-colors"
                  style={{ background: i === dropdownHighlight ? 'var(--color-surface-alt)' : 'transparent' }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                    {fileName(path)}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-4)' }}>
                    {path}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Rich file picker ─────────────────────────────────── */}
        {pickerOpen && availableFiles.length > 0 && (
          <div
            ref={pickerRef}
            className="absolute bottom-full mb-1 left-0 right-0 z-20 rounded-[var(--radius-sm)] flex flex-col overflow-hidden"
            style={{
              background: 'var(--color-surface-raised)',
              border:     '1px solid var(--color-border)',
              boxShadow:  'var(--shadow-md)',
              maxHeight:  260,
            }}
          >
            {/* Picker header */}
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 flex-shrink-0 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {/* Global "All" checkbox */}
              <button
                onMouseDown={e => { e.preventDefault(); toggleAllPick() }}
                className="flex items-center gap-1.5 cursor-pointer border-none p-0"
                style={{ background: 'transparent' }}
              >
                <CheckBox state={globalCheckState} size={14} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}>
                  All
                </span>
              </button>

              <div style={{ flex: 1 }} />

              {/* Tree / Flat toggle */}
              <div
                className="flex rounded-sm overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                {(['flat', 'tree'] as const).map(v => (
                  <button
                    key={v}
                    onMouseDown={e => { e.preventDefault(); setPickerView(v) }}
                    className="px-2 py-0.5 text-[9px] font-mono cursor-pointer border-none transition-colors"
                    style={{
                      background: pickerView === v ? 'var(--color-accent)' : 'transparent',
                      color:      pickerView === v ? '#fff' : 'var(--color-text-3)',
                    }}
                  >
                    {v === 'flat' ? '≡ Flat' : '⊞ Tree'}
                  </button>
                ))}
              </div>

              {/* Selected count badge */}
              {attachedFiles.length > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-mono"
                  style={{ background: 'var(--color-accent)22', color: 'var(--color-accent)' }}
                >
                  {attachedFiles.length} selected
                </span>
              )}
            </div>

            {/* Picker list */}
            <div className="overflow-y-auto flex-1">
              {pickerView === 'flat' ? (
                // ── Flat view ────────────────────────────────────
                availableFiles.map(path => (
                  <button
                    key={path}
                    onMouseDown={e => { e.preventDefault(); toggleFilePick(path) }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-none text-left"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <CheckBox state={attachedPathSet.has(path) ? 'all' : 'none'} size={13} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName(path)}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-4)', flexShrink: 0, maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {path.split('/').slice(0, -1).join('/')}
                    </span>
                  </button>
                ))
              ) : (
                // ── Tree view ─────────────────────────────────────
                fileTree.children.map((child, i) =>
                  child.kind === 'folder' ? (
                    <FolderRow
                      key={i}
                      node={child as TreeFolder}
                      depth={0}
                      checkState={getFolderState(child as TreeFolder)}
                      expanded={isFolderExpanded((child as TreeFolder).path)}
                      onToggleExpand={toggleFolderExpand}
                      onTogglePick={toggleFolderPick}
                      attachedPathSet={attachedPathSet}
                      isFolderExpanded={isFolderExpanded}
                      getFolderState={getFolderState}
                      onToggleFilePick={toggleFilePick}
                    />
                  ) : (
                    <FileRow
                      key={i}
                      node={child as TreeFile}
                      depth={0}
                      checked={attachedPathSet.has((child as TreeFile).path)}
                      onToggle={toggleFilePick}
                    />
                  ),
                )
              )}
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={availableFiles.length > 0 ? 'Describe what to create or change… (type @ to reference a file)' : 'Describe what to create or change…'}
          rows={3}
          className="w-full resize-none rounded-[var(--radius-sm)] p-2 text-[12px] font-mono outline-none"
          style={{
            background: 'var(--color-surface-alt)',
            border:     '1px solid var(--color-border)',
            color:      'var(--color-text)',
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* ── Bottom row: toggles + file picker button + send ──────── */}
      <div className="flex items-center gap-2">
        {/* Architecture toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <div
            onClick={() => onToggleArchitecture(!isSendingArchitecture)}
            className="relative flex-shrink-0"
            style={{ width: 26, height: 14 }}
          >
            <div
              className="absolute inset-0 rounded-full transition-colors duration-150"
              style={{ background: isSendingArchitecture ? 'var(--color-accent)' : 'var(--color-border)' }}
            />
            <div
              className="absolute top-[2px] rounded-full transition-all duration-150"
              style={{ width: 10, height: 10, background: 'white', left: isSendingArchitecture ? 14 : 2 }}
            />
          </div>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--color-text-3)' }}>
            Arch
          </span>
          {!hasActiveMsId && isSendingArchitecture && (
            <span style={{ fontSize: 9, color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
              (no MS)
            </span>
          )}
        </label>

        {/* Files button */}
        {availableFiles.length > 0 && (
          <button
            onClick={() => setPickerOpen(v => !v)}
            title="Attach files"
            className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] cursor-pointer border transition-colors text-[10px] font-mono"
            style={{
              background:  pickerOpen ? 'var(--color-surface-alt)' : 'transparent',
              borderColor: 'var(--color-border)',
              color:       'var(--color-text-3)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            Files
            {attachedFiles.length > 0 && (
              <span
                className="px-1 rounded-full text-[8px]"
                style={{ background: 'var(--color-accent)', color: '#fff', minWidth: 14, textAlign: 'center' }}
              >
                {attachedFiles.length}
              </span>
            )}
          </button>
        )}

        <div className="flex-1" />

        {/* Stop / Send */}
        {isLoading ? (
          <button
            onClick={onAbort}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-semibold cursor-pointer border-none"
            style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <rect x="1" y="1" width="7" height="7" rx="1" />
            </svg>
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-semibold cursor-pointer border-none disabled:opacity-40 disabled:cursor-default"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Send
          </button>
        )}
      </div>
    </div>
  )
}

export default CodeChatInput
