# Chat — IDB Schema & Store

> Claude Code: read this in full before writing a single line.
> Do NOT hardcode any function signatures, store shapes, or IDB patterns.
> Look at the existing codebase first — find how nodes are stored, how stores
> are defined, how IDB tables are declared — then follow those exact patterns.
> This document describes WHAT to build. You figure out HOW from the codebase.

---

## 1. Two New IDB Tables

Add two new tables to the existing Dexie schema.

**Find:** the file where the Dexie schema is defined (likely `src/db/db.ts` or similar).
**Look at:** how existing tables (`nodes`, `edges`, `versions`, `generatedFiles`) are declared.
**Follow:** the exact same pattern for these two new tables.

### `chatSessions` table

Each row represents one chat session. Fields:

```
id:          string   primary key
projectId:   string   indexed
msId:        string   indexed — every session belongs to exactly one MS node
title:       string   auto-generated from first message (first 6 words)
createdAt:   number   timestamp
updatedAt:   number   timestamp — update on every new message
summary:     string   null until auto-summarised
```

### `chatMessages` table

Each row is one message in a session. Fields:

```
id:          string   primary key
sessionId:   string   indexed
projectId:   string   indexed
msId:        string   indexed
role:        string   'user' | 'assistant'
content:     string   the natural language text
actions:     string   JSON.stringify of CanvasAction[] — empty array for user messages
timestamp:   number
isError:     boolean
```

### Schema version

Bump the Dexie schema version number. Follow the existing versioning pattern.
Add both tables in the same version bump.

---

## 2. New Entity Types

**Find:** `src/entity/` — look at how existing node types and shared types are defined.
**Create:** `src/entity/Chat.ts`
**Export:** from `src/entity/index.ts` barrel

```typescript
// The shape of one chat session
interface ChatSession {
  id:        string
  projectId: string
  msId:      string
  title:     string
  createdAt: number
  updatedAt: number
  summary:   string | null
}

// The shape of one message
interface ChatMessage {
  id:        string
  sessionId: string
  projectId: string
  msId:      string
  role:      'user' | 'assistant'
  content:   string
  actions:   CanvasAction[]
  timestamp: number
  isError:   boolean
}

// The five action types Claude can return
type CanvasAction =
  | CreateNodeAction
  | CreateEdgeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | AddFieldAction

interface CreateNodeAction {
  type:     'CREATE_NODE'
  nodeType: string          // matches NodeType enum values
  label:    string
  data:     Record<string, unknown>
}

interface CreateEdgeAction {
  type:      'CREATE_EDGE'
  fromLabel: string
  toLabel:   string
  edgeType:  string         // matches EdgeType enum values
}

interface UpdateNodeAction {
  type:  'UPDATE_NODE'
  label: string
  patch: Record<string, unknown>
}

interface DeleteNodeAction {
  type:  'DELETE_NODE'
  label: string
}

interface AddFieldAction {
  type:       'ADD_FIELD'
  nodeLabel:  string
  field:      Record<string, unknown>
}
```

---

## 3. Zustand Store — `chatStore`

**Find:** how existing Zustand stores are defined in `src/store/`.
**Look at:** the shape and pattern of `canvasStore`, `codeEditorStore`, or any other store.
**Follow:** the exact same pattern — same file structure, same create() call, same export.
**Add export:** to `src/store/index.ts`

The store needs to hold:

```
// Active session state
activeChatSessionId:   string | null
activeChatMessages:    ChatMessage[]    // loaded messages for the active session

// Session list for current MS
chatSessions:          ChatSession[]    // sessions for the active MS

// UI state
isLoading:             boolean          // Claude is responding
isSendingArchitecture: boolean          // arch toggle state — default true
                                        // persisted in localStorage

// Actions
setActiveChatSession:   (id: string | null) => void
setActiveChatMessages:  (messages: ChatMessage[]) => void
setChatSessions:        (sessions: ChatSession[]) => void
setIsLoading:           (v: boolean) => void
toggleSendArchitecture: () => void
addMessage:             (msg: ChatMessage) => void
updateLastMessage:      (patch: Partial<ChatMessage>) => void  // for streaming
```

**For `isSendingArchitecture`:** read initial value from localStorage on store creation.
Write to localStorage whenever it changes.

---

## 4. Session Management Functions

**Find:** `src/utils/` — look at existing utility functions for patterns.
**Create:** `src/utils/chat.ts`
**Export:** from `src/utils/index.ts`

These are pure async functions — no React, no hooks. They interact with IDB only.

### `createChatSession(msId, projectId): Promise<ChatSession>`

Creates a new session in IDB with a default title "New session".
Returns the created session.

### `loadChatSessions(msId, projectId): Promise<ChatSession[]>`

Loads all sessions for a given MS, ordered by `updatedAt` descending.

### `loadChatMessages(sessionId): Promise<ChatMessage[]>`

Loads all messages for a session, ordered by `timestamp` ascending.

### `saveChatMessage(message: ChatMessage): Promise<void>`

Writes one message to IDB. Also updates `chatSessions.updatedAt` for the session.

### `updateSessionTitle(sessionId, title): Promise<void>`

Updates the session title in IDB.

### `updateSessionSummary(sessionId, summary): Promise<void>`

Updates the session summary in IDB.

### `deleteChatSession(sessionId): Promise<void>`

Deletes the session and all its messages from IDB.

### `autoTitleFromMessage(content: string): string`

Takes the first message content, returns the first 6 words joined.
Pure function — no IDB.

---

## 5. Verification

- [ ] Dexie schema version bumped
- [ ] `chatSessions` and `chatMessages` tables exist in IDB (check DevTools → Application → IndexedDB)
- [ ] `ChatSession`, `ChatMessage`, `CanvasAction` types exported from `src/entity/`
- [ ] `chatStore` exported from `src/store/index.ts`
- [ ] `isSendingArchitecture` defaults to `true` and persists across page refreshes
- [ ] `createChatSession` creates a row in IDB and returns it
- [ ] `loadChatSessions` returns sessions ordered by `updatedAt` desc
- [ ] `loadChatMessages` returns messages ordered by `timestamp` asc
- [ ] `npx tsc --noEmit` — zero errors
