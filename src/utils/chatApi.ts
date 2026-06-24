import CHAT_SYSTEM_PROMPT from '@prompts/chatSystemPrompt.md?raw'
import { getMessagesUrl, getProxyHeaders } from './proxyUrl'
import type { ChatMessage, ChatSession, CanvasAction } from '@entity'

type ApiMsg = { role: 'user' | 'assistant'; content: string }

export async function sendChatMessage(params: {
  session:      ChatSession
  messages:     ChatMessage[]
  userContent:  string
  architecture: object | null
  signal:       AbortSignal
  onChunk:      (chunk: string) => void
  onDone:       (fullContent: string, actions: CanvasAction[]) => void
  onError:      (err: Error) => void
}): Promise<void> {
  const apiMessages: ApiMsg[] = []

  if (params.session.summary) {
    apiMessages.push({ role: 'user',      content: `Previous session summary: ${params.session.summary}` })
    apiMessages.push({ role: 'assistant', content: 'Understood. I have context from our previous conversation.' })
  }

  for (const m of params.messages.slice(-10)) {
    apiMessages.push({ role: m.role, content: m.content })
  }

  const userContent = params.architecture
    ? `${params.userContent}\n\nCURRENT ARCHITECTURE:\n${JSON.stringify(params.architecture, null, 2)}`
    : params.userContent
  apiMessages.push({ role: 'user', content: userContent })

  let response: Response
  try {
    response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal:  params.signal,
      headers: getProxyHeaders(),
      body:    JSON.stringify({
        model:    'claude-sonnet-4-5',
        stream:   true,
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...apiMessages],
      }),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    params.onError(err instanceof Error ? err : new Error(String(err)))
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
    params.onError(new Error(body.error?.message ?? `HTTP ${response.status}`))
    return
  }

  const reader = response.body?.getReader()
  if (!reader) { params.onError(new Error('No response body')); return }
  const decoder = new TextDecoder()
  let buffer           = ''
  let fullBuf          = ''
  let actionTagStarted = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue
        try {
          const ev    = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }
          const chunk = ev.choices?.[0]?.delta?.content ?? ''
          console.log('[chatApi] chunk:', JSON.stringify(chunk))
          if (!chunk) continue
          fullBuf += chunk

          if (!actionTagStarted) {
            if (chunk.includes('<actions>')) {
              actionTagStarted = true
              const beforeTag = chunk.split('<actions>')[0]
              if (beforeTag) params.onChunk(beforeTag)
            } else {
              params.onChunk(chunk)
            }
          }
        } catch { continue }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    params.onError(err instanceof Error ? err : new Error(String(err)))
    return
  }

  console.log('[chatApi] FULL RESPONSE:\n', fullBuf)

  const actionsMatch = fullBuf.match(/<actions>([\s\S]*?)<\/actions>/)
  const actionsJson  = actionsMatch ? actionsMatch[1].trim() : '[]'
  let actions: CanvasAction[] = []
  try { actions = JSON.parse(actionsJson) as CanvasAction[] } catch { actions = [] }
  const content = fullBuf.replace(/<actions>[\s\S]*?<\/actions>/, '').trim()

  console.log('[chatApi] PARSED ACTIONS:', JSON.stringify(actions, null, 2))
  params.onDone(content, actions)
}
