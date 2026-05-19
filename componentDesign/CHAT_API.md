# Chat — API Call & Message Sending

> Claude Code: read this in full before writing a single line.
> Look at how generateCode.ts and continueGeneration.ts make API calls.
> Follow the EXACT same pattern — same proxy URL, same fetch structure,
> same streaming approach. Do not invent a new pattern.
> This document describes WHAT the chat API call does. You implement it
> using the existing patterns in the codebase.

---

## 1. `src/utils/chatApi.ts`

Create this file. It makes one streaming API call per user message.

**Find:** how `generateCode.ts` or `regenerateWithDiff.ts` calls the proxy.
**Follow:** the exact same fetch pattern, same URL (`getMessagesUrl()`),
same streaming reader, same SSE parsing.

**Import:** `CHAT_SYSTEM_PROMPT` from `@/prompts/chatSystemPrompt.md?raw`

### Function signature

```typescript
sendChatMessage(params: {
  session:          ChatSession
  messages:         ChatMessage[]     // full history to send (last 10)
  userContent:      string            // current user input
  architecture:     object | null     // null when toggle is OFF
  signal:           AbortSignal
  onChunk:          (chunk: string) => void   // natural language chunks
  onDone:           (fullContent: string, actions: CanvasAction[]) => void
  onError:          (err: Error) => void
}): Promise<void>
```

### What it does

1. Build the messages array (see CHAT_SYSTEM_PROMPT.md for structure)
2. Call the proxy at `getMessagesUrl()` with streaming
3. Stream the response — append chunks to a buffer
4. When `[DONE]` arrives or stream closes:
   - Parse the `<actions>` block from the full buffer
   - Everything before `<actions>` = natural language content
   - Parse the JSON inside `<actions>...</actions>` = `CanvasAction[]`
   - Call `onDone(naturalLanguageContent, actions)`

### `<actions>` parsing

```
// From the full streamed response:
const actionsMatch = fullBuffer.match(/<actions>([\s\S]*?)<\/actions>/)
const actionsJson  = actionsMatch ? actionsMatch[1].trim() : '[]'
const actions      = JSON.parse(actionsJson) as CanvasAction[]
const content      = fullBuffer.replace(/<actions>[\s\S]*?<\/actions>/, '').trim()
```

### Streaming natural language chunks

While streaming, call `onChunk(chunk)` for each new piece of text ONLY if
the chunk is before the `<actions>` tag. Once `<actions>` appears in the
buffer, stop calling `onChunk` — the rest is JSON, not natural language.

```typescript
let actionTagStarted = false

// In the streaming loop:
if (!actionTagStarted) {
  if (chunk.includes('<actions>')) {
    actionTagStarted = true
    // emit the part before <actions>
    const beforeTag = chunk.split('<actions>')[0]
    if (beforeTag) params.onChunk(beforeTag)
  } else {
    params.onChunk(chunk)
  }
}
// Don't emit chunks after <actions> — it's JSON
```

---

## 2. `src/utils/executeCanvasActions.ts`

This is the action executor. It reads the `CanvasAction[]` from Claude's
response and applies them to the canvas.

**Find:** how nodes are created in the existing codebase.
Look at `useCanvas.ts` or wherever `onDrop` creates a node.
Find the factory functions in `src/utils/node.ts`.
Find how nodes are written to IDB.
Find how RF `setNodes` is called.
Find how edges are created (the `onConnect` handler or equivalent).

**Follow those exact patterns.** Do not invent new ways to create nodes or edges.

### Function signature

```typescript
executeCanvasActions(params: {
  actions:      CanvasAction[]
  msId:         string
  projectId:    string
  rfNodes:      RFNode[]         // current RF nodes — to find nodes by label
  setNodes:     Function         // RF setNodes
  setEdges:     Function         // RF setEdges
}): Promise<ExecutionResult>

interface ExecutionResult {
  createdNodeIds:  string[]   // IDs of newly created nodes
  createdEdgeIds:  string[]   // IDs of newly created edges
  updatedNodeIds:  string[]
  deletedNodeIds:  string[]
  errors:          string[]   // non-fatal errors, e.g. "node not found: Foo"
}
```

### For each action type:

**CREATE_NODE:**
1. Find the factory function for `action.nodeType` in `src/utils/node.ts`
   (e.g. `createEntityNode`, `createDTONode`, etc.)
2. Call it with `action.label` as label, `action.msId`, and spread `action.data`
3. Auto-position: find a free position that doesn't overlap existing nodes
   — look at how `onDrop` positions nodes and follow the same logic
4. Write to IDB — follow the exact same IDB write pattern used elsewhere
5. Add to RF state — follow the exact same `setNodes` pattern used elsewhere
6. Add created node ID to `createdNodeIds`

**For auto-positioning:**
Find the rightmost node in the current MS, place the new node 40px to its right
and at the same Y position. If no nodes exist, use `{ x: 100, y: 100 }` as default.

**CREATE_EDGE:**
1. Find source node: `rfNodes.find(n => (n.data as BaseNode).label === action.fromLabel)`
2. Find target node: same for `action.toLabel`
3. If either not found: add to `errors`, continue to next action
4. Look at how edges are created in the existing codebase — find the `onConnect`
   handler or the edge creation utility
5. Call that same function/logic with the resolved source and target
6. This must trigger auto-population — the same auto-population that fires
   when a user manually draws an edge on the canvas
7. Add created edge ID to `createdEdgeIds`

**UPDATE_NODE:**
1. Find node by label in `rfNodes`
2. Deep merge `action.patch` into the existing node data
   — For fields array patches: append new fields, don't replace the whole array
   — For config patches: merge the config object
3. Write updated data to IDB — follow existing update pattern
4. Update RF state — follow existing `setNodes` update pattern
5. Add to `updatedNodeIds`

**DELETE_NODE:**
1. Find node by label
2. Delete from IDB — follow existing delete pattern
3. Delete all edges connected to this node — follow existing pattern
4. Update RF state — follow existing pattern
5. Add to `deletedNodeIds`

**ADD_FIELD:**
1. Find node by label
2. Generate a new field ID (use `generateId()` from utils)
3. Create the full field object with defaults for any missing properties:
   - `nullable`: true unless constraint is PK
   - `columnName`: same as field name
   - `defaultValue`: empty string
   - `enumValues`: null
   - `entityTypeId`: null
   - `customTypeId`: null
   - `relation`: null
   - `entityTypeWarning`: false
4. Append the new field to `node.fields`
5. Update IDB and RF state — follow existing patterns
6. Add to `updatedNodeIds`

---

## 3. `handleSendMessage()` in `useChatPanel.ts`

This is the main send flow. Wire everything together.

```
1. Validate: content not empty, active session exists, not already loading

2. Create user message object and save to IDB via saveChatMessage()
   Add to chatStore.activeChatMessages

3. Create empty assistant message (streaming placeholder)
   Add to chatStore.activeChatMessages with empty content

4. Set chatStore.isLoading = true

5. Get last 10 messages from chatStore.activeChatMessages (excluding the
   just-added user and empty assistant messages)

6. Get architecture (if toggle is ON):
   Call exportArchitecture(msId, projectId) — find this function in utils

7. Create AbortController, store it somewhere accessible for cancellation

8. Call sendChatMessage({
     session, messages (last 10), userContent,
     architecture (or null),
     signal,
     onChunk: (chunk) => {
       // append chunk to the last assistant message in chatStore
       chatStore.updateLastMessage({ content: prev + chunk })
     },
     onDone: async (content, actions) => {
       // Update the assistant message with final content
       chatStore.updateLastMessage({ content, actions })

       // Save the completed assistant message to IDB
       saveChatMessage(assistantMessage)

       // Execute canvas actions
       const result = await executeCanvasActions({
         actions, msId, projectId, rfNodes, setNodes, setEdges
       })

       // Update assistant message with action chips info
       chatStore.updateLastMessage({ actions })

       // Check if auto-summarise should run (>= 20 messages)
       const msgCount = chatStore.activeChatMessages.length
       if (msgCount >= 20 && !session.summary) {
         autoSummariseSession(session, chatStore.activeChatMessages)
         // fire and forget — don't await
       }

       // Auto-title the session if it still has the default title
       if (session.title === 'New session') {
         const title = autoTitleFromMessage(userContent)
         updateSessionTitle(session.id, title)
         chatStore.setChatSessions(sessions.map(s =>
           s.id === session.id ? { ...s, title } : s
         ))
       }

       chatStore.setIsLoading(false)
     },
     onError: (err) => {
       chatStore.updateLastMessage({ isError: true, content: err.message })
       chatStore.setIsLoading(false)
     }
   })
```

---

## 4. `autoSummariseSession()` in `src/utils/chat.ts`

Fires in the background after 20+ messages.

**Find:** the proxy call pattern in the codebase.
**Follow** the same pattern but NON-streaming (no need to stream a summary).

```typescript
async function autoSummariseSession(
  session: ChatSession,
  messages: ChatMessage[],
): Promise<void>
```

Call the proxy with:
- System prompt: `"Summarise this conversation in 3-4 sentences. Focus on architectural decisions made, nodes and relationships created, and anything still pending."`
- User message: all messages formatted as `role: content` pairs
- `stream: false`

On success: call `updateSessionSummary(session.id, summary)` and update the store.
Fire and forget — errors are silently logged, not shown to the user.

---

## 5. Verification

- [ ] Sending a message calls the proxy at the correct URL
- [ ] Natural language response streams into the assistant bubble in real time
- [ ] `<actions>` block is correctly parsed from the response
- [ ] `executeCanvasActions` creates nodes on the canvas
- [ ] Created nodes appear in the correct MS
- [ ] Created nodes are written to IDB (survive page refresh)
- [ ] CREATE_EDGE triggers auto-population (e.g. DERIVED_FROM copies DTO fields)
- [ ] UPDATE_NODE patches the node without replacing the whole thing
- [ ] ADD_FIELD adds a field to an entity
- [ ] Action chips appear in the assistant message
- [ ] Clicking an action chip selects the node on canvas
- [ ] Auto-title fires after first message
- [ ] Auto-summarise fires after 20th message
- [ ] Architecture toggle ON → architecture JSON in request
- [ ] Architecture toggle OFF → architecture JSON NOT in request
- [ ] Abort signal cancels the request
- [ ] Error state shown in message bubble on API error