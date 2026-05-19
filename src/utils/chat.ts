import { db } from '../db'
import type { ChatSession, ChatMessage } from '../entity/Chat'
import { generateId } from './id'
import { getMessagesUrl } from './proxyUrl'
import { useChatStore } from '../store/chatStore'

export async function createChatSession(msId: string, projectId: string): Promise<ChatSession> {
  const session: ChatSession = {
    id:        generateId(),
    projectId,
    msId,
    title:     'New session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    summary:   null,
  }
  await db.chatSessions.put(session)
  return session
}

export async function loadChatSessions(msId: string, projectId: string): Promise<ChatSession[]> {
  const sessions = await db.chatSessions
    .where('msId')
    .equals(msId)
    .and((s) => s.projectId === projectId)
    .toArray()
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await db.chatMessages
    .where('sessionId')
    .equals(sessionId)
    .sortBy('timestamp')
  return rows.map((row) => ({
    ...row,
    role:    row.role as 'user' | 'assistant',
    actions: JSON.parse(row.actions) as ChatMessage['actions'],
  }))
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  await db.chatMessages.put({ ...message, actions: JSON.stringify(message.actions) })
  await db.chatSessions.update(message.sessionId, { updatedAt: Date.now() })
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await db.chatSessions.update(sessionId, { title })
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  await db.chatSessions.update(sessionId, { summary })
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await db.chatMessages.where('sessionId').equals(sessionId).delete()
  await db.chatSessions.delete(sessionId)
}

export function autoTitleFromMessage(content: string): string {
  return content.split(/\s+/).slice(0, 6).join(' ')
}

export async function autoSummariseSession(
  session: ChatSession,
  messages: ChatMessage[],
): Promise<void> {
  try {
    const messagesText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:    'claude-sonnet-4-5',
        stream:   false,
        messages: [
          {
            role:    'system',
            content: 'Summarise this conversation in 3-4 sentences. Focus on architectural decisions made, nodes and relationships created, and anything still pending.',
          },
          { role: 'user', content: messagesText },
        ],
      }),
    })

    const data = await response.json() as {
      content?: { text?: string }[]
      choices?: { message?: { content?: string } }[]
    }

    const summary = data.content?.[0]?.text ?? data.choices?.[0]?.message?.content
    if (!summary) return

    await updateSessionSummary(session.id, summary)
    useChatStore.getState().setChatSessions(
      useChatStore.getState().chatSessions.map(s =>
        s.id === session.id ? { ...s, summary } : s,
      ),
    )
  } catch (err) {
    console.warn('autoSummariseSession failed:', err)
  }
}
