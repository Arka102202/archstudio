import { getMessagesUrl, getProxyHeaders } from './proxyUrl'
import type { CodeChatMessage, CodeChatFileOp } from '@store/codeChatStore'

// ─── Stream parser state ──────────────────────────────────────────

type ParserState = 'text' | 'inFileContent'

interface ParseState {
  buffer:            string
  state:             ParserState
  currentPath:       string
  currentOp:         'create' | 'update' | 'delete'
  fileContentBuffer: string
  fullText:          string
}

function makeParseState(): ParseState {
  return { buffer: '', state: 'text', currentPath: '', currentOp: 'create', fileContentBuffer: '', fullText: '' }
}

function flush(
  ps: ParseState,
  onTextChunk:   (c: string) => void,
  onFileStart:   (path: string, op: 'create' | 'update' | 'delete') => void,
  onFileComplete:(path: string, op: 'create' | 'update' | 'delete', content: string) => void,
): void {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (ps.state === 'text') {
      const idx = ps.buffer.indexOf('<file ')
      if (idx === -1) {
        // No file tag — keep last 6 chars in case we're mid-tag
        const safe = ps.buffer.length > 6 ? ps.buffer.slice(0, ps.buffer.length - 6) : ''
        if (safe) { onTextChunk(safe); ps.fullText += safe }
        ps.buffer = ps.buffer.slice(safe.length)
        break
      }
      // Emit text before tag
      if (idx > 0) {
        const pre = ps.buffer.slice(0, idx)
        onTextChunk(pre)
        ps.fullText += pre
        ps.buffer = ps.buffer.slice(idx)
      }
      // Need the closing '>' of the opening tag
      const gtIdx = ps.buffer.indexOf('>')
      if (gtIdx === -1) break  // incomplete tag — wait
      const tag = ps.buffer.slice(0, gtIdx + 1)
      const pathM = /path="([^"]+)"/.exec(tag)
      const opM   = /\bop="([^"]+)"/.exec(tag)
      if (!pathM) { ps.buffer = ps.buffer.slice(gtIdx + 1); continue }  // malformed
      ps.currentPath = pathM[1]
      const opStr    = opM?.[1] ?? 'create'
      ps.currentOp   = opStr === 'delete' ? 'delete' : opStr === 'update' ? 'update' : 'create'
      ps.fileContentBuffer = ''
      ps.state  = 'inFileContent'
      ps.buffer = ps.buffer.slice(gtIdx + 1)
      if (ps.buffer.startsWith('\n')) ps.buffer = ps.buffer.slice(1)
      onFileStart(ps.currentPath, ps.currentOp)
    } else {
      const closeIdx = ps.buffer.indexOf('</file>')
      if (closeIdx === -1) {
        // No close tag — buffer all but potential partial close
        const keep = '</file>'.length - 1
        const safe = ps.buffer.length > keep ? ps.buffer.slice(0, ps.buffer.length - keep) : ''
        if (safe) ps.fileContentBuffer += safe
        ps.buffer = ps.buffer.slice(safe.length)
        break
      }
      ps.fileContentBuffer += ps.buffer.slice(0, closeIdx)
      ps.buffer = ps.buffer.slice(closeIdx + '</file>'.length)
      let content = ps.fileContentBuffer
      if (content.endsWith('\n')) content = content.slice(0, -1)
      onFileComplete(ps.currentPath, ps.currentOp, content)
      ps.state = 'text'
      ps.fileContentBuffer = ''
      ps.currentPath = ''
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────

export async function sendCodeChatMessage(params: {
  messages:      CodeChatMessage[]
  userText:      string
  systemPrompt:  string
  signal:        AbortSignal
  onTextChunk:   (chunk: string) => void
  onFileOp:      (op: CodeChatFileOp) => void
  onDone:        (fullText: string, fileOps: CodeChatFileOp[]) => void
  onError:       (err: Error) => void
}): Promise<void> {
  const { messages, userText, systemPrompt, signal, onTextChunk, onFileOp, onDone, onError } = params

  // Build conversation history — strip file content for brevity, keep prose + paths
  type ApiMsg = { role: 'user' | 'assistant'; content: string }
  const history: ApiMsg[] = messages.slice(-8).map(m => ({
    role: m.role,
    content: m.role === 'assistant'
      ? [
          m.content,
          ...m.fileOps.map(op =>
            op.op === 'delete'
              ? `<file path="${op.path}" op="delete"></file>`
              : `<file path="${op.path}" op="${op.op}">[content omitted for brevity]</file>`,
          ),
        ].join('\n').trim()
      : m.content,
  }))

  let response: Response
  try {
    response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal,
      headers: getProxyHeaders(),
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        stream:     true,
        max_tokens: 16000,
        messages:   [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user',   content: userText },
        ],
      }),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    onError(err instanceof Error ? err : new Error(String(err)))
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    onError(new Error((body.error?.message) ?? `HTTP ${response.status}`))
    return
  }

  const reader = response.body?.getReader()
  if (!reader) { onError(new Error('No response body')); return }

  const decoder  = new TextDecoder()
  const ps       = makeParseState()
  const fileOps: CodeChatFileOp[] = []

  const handleFileStart = (_path: string, _op: 'create' | 'update' | 'delete'): void => {
    // nothing — we wait for complete
  }

  const handleFileComplete = (path: string, op: 'create' | 'update' | 'delete', content: string): void => {
    const fileOp: CodeChatFileOp = { path, op, content: op === 'delete' ? null : content, status: 'applied' }
    fileOps.push(fileOp)
    onFileOp(fileOp)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const raw = decoder.decode(value, { stream: true })
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const chunk  = parsed.choices?.[0]?.delta?.content
          if (chunk) {
            ps.buffer += chunk
            flush(ps, onTextChunk, handleFileStart, handleFileComplete)
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }
    // Flush remaining text
    if (ps.buffer.trim() && ps.state === 'text') {
      onTextChunk(ps.buffer)
      ps.fullText += ps.buffer
      ps.buffer = ''
    }
    onDone(ps.fullText.trim(), fileOps)
  } catch (err) {
    if (signal.aborted) return
    onError(err instanceof Error ? err : new Error('Stream error'))
  }
}
