import { useState, useRef, useCallback, useMemo } from 'react'
import type { CodeChatInputProps, TreeFolder, PickerView, CheckState } from './types'
import type { AttachedFile } from '@store'

// ─── @ mention detection ──────────────────────────────────────────────────────

function getAtQuery(text: string, cursorPos: number): { query: string; start: number } | null {
  const before  = text.slice(0, cursorPos)
  const lastAt  = before.lastIndexOf('@')
  if (lastAt === -1) return null
  const fragment = before.slice(lastAt + 1)
  if (/\s/.test(fragment)) return null
  return { query: fragment.toLowerCase(), start: lastAt }
}

// ─── Tree building ────────────────────────────────────────────────────────────

function buildTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [] }

  for (const filePath of [...paths].sort()) {
    const parts   = filePath.split('/')
    let current   = root

    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/')
      let folder = current.children.find(
        (c): c is TreeFolder => c.kind === 'folder' && c.name === parts[i],
      )
      if (!folder) {
        folder = { kind: 'folder', name: parts[i], path: folderPath, children: [] }
        current.children.push(folder)
      }
      current = folder
    }

    current.children.push({
      kind: 'file',
      name: parts[parts.length - 1],
      path: filePath,
    })
  }

  return root
}

function getAllFilePaths(node: TreeFolder): string[] {
  const paths: string[] = []
  for (const child of node.children) {
    if (child.kind === 'folder') paths.push(...getAllFilePaths(child))
    else paths.push(child.path)
  }
  return paths
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useCodeChatInput = (props: CodeChatInputProps) => {
  const { onSend, isLoading, availableFiles, onAttachFile, onDetachFile, attachedFiles } = props

  // ─── Text + @ mention state ───────────────────────────────────────────────
  const [text, setText]             = useState('')
  const [atQuery, setAtQuery]       = useState<{ query: string; start: number } | null>(null)
  const [dropdownHighlight, setDropdownHighlight] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── File picker state ────────────────────────────────────────────────────
  const [pickerOpen, setPickerOpen]         = useState(false)
  const [pickerView, setPickerView]         = useState<PickerView>('flat')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  // ─── @ mention: filtered list ─────────────────────────────────────────────
  const mentionFiles: string[] = useMemo(() => {
    if (!atQuery) return []
    const q = atQuery.query
    return availableFiles
      .filter(p => p.toLowerCase().includes(q) || (p.split('/').pop() ?? '').toLowerCase().includes(q))
      .slice(0, 10)
  }, [atQuery, availableFiles])

  const dropdownVisible = atQuery !== null && mentionFiles.length > 0

  // ─── Derived: tree + attached set ─────────────────────────────────────────
  const fileTree = useMemo(() => buildTree(availableFiles), [availableFiles])

  const attachedPathSet: Set<string> = useMemo(
    () => new Set(attachedFiles.map(f => f.path)),
    [attachedFiles],
  )

  // ─── Select @ mention file ────────────────────────────────────────────────
  const selectMentionFile = useCallback((path: string): void => {
    const name: string   = path.split('/').pop() ?? path
    const file: AttachedFile = { path, name }

    if (atQuery !== null) {
      const before  = text.slice(0, atQuery.start)
      const after   = text.slice(atQuery.start + 1 + atQuery.query.length)
      setText(`${before}@${name}${after}`)
      setAtQuery(null)
    }
    onAttachFile(file)
    setDropdownHighlight(0)
    textareaRef.current?.focus()
  }, [text, atQuery, onAttachFile])

  // ─── Rich picker: toggle individual file ─────────────────────────────────
  const toggleFilePick = useCallback((path: string): void => {
    if (attachedPathSet.has(path)) {
      onDetachFile(path)
    } else {
      onAttachFile({ path, name: path.split('/').pop() ?? path })
    }
  }, [attachedPathSet, onAttachFile, onDetachFile])

  // ─── Rich picker: toggle entire folder ───────────────────────────────────
  const toggleFolderPick = useCallback((folder: TreeFolder): void => {
    const all        = getAllFilePaths(folder)
    const allChecked = all.every(p => attachedPathSet.has(p))
    if (allChecked) {
      all.forEach(p => onDetachFile(p))
    } else {
      all.filter(p => !attachedPathSet.has(p))
        .forEach(p => onAttachFile({ path: p, name: p.split('/').pop() ?? p }))
    }
  }, [attachedPathSet, onAttachFile, onDetachFile])

  // ─── Rich picker: toggle all ──────────────────────────────────────────────
  const toggleAllPick = useCallback((): void => {
    const allChecked = availableFiles.every(p => attachedPathSet.has(p))
    if (allChecked) {
      availableFiles.forEach(p => onDetachFile(p))
    } else {
      availableFiles.filter(p => !attachedPathSet.has(p))
        .forEach(p => onAttachFile({ path: p, name: p.split('/').pop() ?? p }))
    }
  }, [availableFiles, attachedPathSet, onAttachFile, onDetachFile])

  // ─── Rich picker: folder check state ─────────────────────────────────────
  const getFolderState = useCallback((folder: TreeFolder): CheckState => {
    const all   = getAllFilePaths(folder)
    if (all.length === 0) return 'none'
    const count = all.filter(p => attachedPathSet.has(p)).length
    if (count === 0)          return 'none'
    if (count === all.length) return 'all'
    return 'some'
  }, [attachedPathSet])

  // ─── Rich picker: global check state ─────────────────────────────────────
  const globalCheckState: CheckState = useMemo((): CheckState => {
    if (availableFiles.length === 0) return 'none'
    const count = availableFiles.filter(p => attachedPathSet.has(p)).length
    if (count === 0)                    return 'none'
    if (count === availableFiles.length) return 'all'
    return 'some'
  }, [availableFiles, attachedPathSet])

  // ─── Rich picker: folder expand / collapse ───────────────────────────────
  const toggleFolderExpand = useCallback((path: string): void => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const isFolderExpanded = useCallback((path: string): boolean =>
    !collapsedFolders.has(path),
  [collapsedFolders])

  // ─── Textarea change — detect @ mentions ─────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setText(val)
    const mention = getAtQuery(val, cursor)
    setAtQuery(mention)
    setDropdownHighlight(0)
    if (mention && pickerOpen) setPickerOpen(false)
  }, [pickerOpen])

  // ─── Keyboard navigation in @ mention dropdown ───────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (dropdownVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdownHighlight(i => Math.min(i + 1, mentionFiles.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdownHighlight(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const chosen = mentionFiles[dropdownHighlight]
        if (chosen) selectMentionFile(chosen)
        return
      }
      if (e.key === 'Escape') {
        setAtQuery(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim() && !isLoading) {
        onSend(text)
        setText('')
        setAtQuery(null)
        setPickerOpen(false)
      }
    }
  }, [dropdownVisible, mentionFiles, dropdownHighlight, selectMentionFile, text, isLoading, onSend])

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback((): void => {
    if (text.trim() && !isLoading) {
      onSend(text)
      setText('')
      setAtQuery(null)
      setPickerOpen(false)
      textareaRef.current?.focus()
    }
  }, [text, isLoading, onSend])

  // ─── Detach ───────────────────────────────────────────────────────────────
  const handleDetach = useCallback((path: string): void => {
    onDetachFile(path)
    const name = path.split('/').pop() ?? path
    if (text.includes(`@${name}`)) {
      setText(t => t.replace(`@${name}`, '').replace(/  +/g, ' ').trim())
    }
  }, [text, onDetachFile])

  return {
    // Text
    text,
    textareaRef,
    handleChange,
    handleKeyDown,
    handleSubmit,
    handleDetach,
    // @ mention dropdown
    dropdownVisible,
    dropdownFiles: mentionFiles,
    dropdownHighlight,
    setDropdownHighlight,
    selectFile: selectMentionFile,
    // Rich picker
    pickerOpen,
    setPickerOpen,
    pickerView,
    setPickerView,
    fileTree,
    attachedPathSet,
    globalCheckState,
    toggleFilePick,
    toggleFolderPick,
    toggleAllPick,
    getFolderState,
    isFolderExpanded,
    toggleFolderExpand,
  }
}
