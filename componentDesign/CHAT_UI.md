# Chat — UI Specification

> Claude Code: read this in full before writing a single line.
> Do NOT hardcode component patterns — look at existing inspector components
> and follow the exact same structure (ComponentName.tsx + useComponentName.ts + types.ts + index.ts).
> Look at how the existing inspector panel is structured and follow that pattern
> for the tab switcher and panel layout.

---

## 1. Right Panel Tab Switcher

**Find:** the right panel component that currently renders the inspector.
Look at how it is structured. Find where the inspector is rendered.

**Add** a tab switcher at the top of the right panel with two tabs:
- **Inspector** — shows the existing inspector content (unchanged)
- **Chat** — shows the new chat UI

The tab switcher must:
- Use the same styling tokens as the rest of the app (`var(--color-*)` etc.)
- Persist the active tab in the `canvasStore` or local state — your choice,
  but it must survive re-renders without resetting
- Not unmount the inspector when Chat is active — use `display: none` pattern
  to preserve inspector state (same pattern used for Canvas/Code tab switching)

---

## 2. Chat Panel Layout

The chat panel fills the entire right panel below the tab switcher.
Three vertical sections:

```
┌─────────────────────────────────────┐
│  SECTION A — Session header         │  fixed height, does not scroll
│  MS dropdown + New Session button   │
│  Session list (compact)             │
├─────────────────────────────────────┤
│  SECTION B — Message thread         │  flex-1, scrollable
│  Summary banner (if exists)         │
│  Messages                           │
├─────────────────────────────────────┤
│  SECTION C — Input area             │  fixed height, does not scroll
│  Textarea + controls                │
└─────────────────────────────────────┘
```

---

## 3. Section A — Session Header

### MS dropdown

Same MS dropdown used in the Code tab header.
Lists all MicroserviceNodes in the project by label.
When changed, loads sessions for the newly selected MS.

**Find:** how the MS dropdown is implemented in the Code tab.
**Reuse:** the same component or at minimum the same logic pattern.

### Session list

Compact horizontal scroll or vertical list below the MS dropdown.
Each session item shows:
- Session title (truncated to ~20 chars)
- Time ago (e.g. "2h ago", "Yesterday")
- Active indicator — highlighted/bold when this is the active session
- Options button `[···]` — opens a small menu

**Session options menu:**
- Rename — inline edit the title
- Summarise now — triggers manual summarisation
- Delete — confirm then delete session + messages

### New Session button

`[+ New Session]` — creates a new session for the current MS, makes it active,
clears the message thread. Writes to IDB via `createChatSession`.

---

## 4. Section B — Message Thread

Scrollable area. Scroll to bottom when a new message is added.
Auto-scroll only if the user is already at the bottom — don't force-scroll
if they've scrolled up to read history.

### Summary banner

Shown when `chatSession.summary` is not null.
Collapsible — collapsed by default, expand on click.

```
┌──────────────────────────────────────┐
│ ── Session summary ▼               │  ← collapsed state
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ── Session summary ▲               │  ← expanded state
│ Created Student, Teacher, Dept      │
│ entities. Added CRUD endpoints.     │
│ Auth setup still pending.           │
└──────────────────────────────────────┘
```

Styling: subtle background, small font, border.

### User message bubble

```
┌─────────────────────────────────────┐
│  You                    10:23 AM   │
│  Create a Student entity with       │
│  firstName, lastName, email, GPA    │
└─────────────────────────────────────┘
```

- Right-aligned or left-aligned — your choice, pick what looks best
- Background: `var(--color-surface-alt)` or accent-light
- Timestamp: small, muted, top-right

### Assistant message bubble

```
┌─────────────────────────────────────┐
│  Claude                 10:23 AM   │
│  Created Student entity with 4      │
│  fields. UUID primary key added     │
│  automatically.                     │
│                                     │
│  ✓ Student entity                   │  ← action chips
│  ✓ 4 fields added                   │
│  ✓ id: UUID (PK)                    │
└─────────────────────────────────────┘
```

- Background: different from user bubble
- Action chips: small, green checkmark, one per action
- Clicking an action chip: find the node that was created and select it
  on the canvas (call `canvasStore.setSelectedNode(id)`)
- Error state: red border, error message when `message.isError = true`

### Thinking / streaming state

While Claude is responding, show the last assistant message with a
streaming indicator:

```
┌─────────────────────────────────────┐
│  Claude                            │
│  ⟳ Thinking...                     │  ← before first chunk arrives
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Claude                            │
│  I'll create a Student entity       │
│  with the following fields...█      │  ← streaming, blinking cursor
└─────────────────────────────────────┘
```

The thinking text updates as chunks arrive (same streaming pattern as
code generation — append chunks to the last message).

---

## 5. Section C — Input Area

### Textarea

Multi-line text input. 
- `Enter` = send message
- `Shift+Enter` = newline
- `placeholder="Describe what to build..."`
- Auto-resize up to ~4 lines, then scroll
- Disabled while `isLoading` is true

### Controls row below textarea

```
[🏗 Send arch]                    [↑ Send]
```

**Left — Architecture toggle button:**
- Shows current state of `isSendingArchitecture`
- When ON (true): amber/accent background, filled icon, tooltip "Architecture JSON included"
- When OFF (false): muted background, outline icon, tooltip "Architecture JSON excluded"
- Clicking toggles `chatStore.toggleSendArchitecture()`

**Right — Send button:**
- Arrow up icon + "Send" text
- Disabled when textarea is empty or `isLoading` is true
- Shows spinner when `isLoading` is true

---

## 6. File Structure

**Follow the exact file structure pattern of existing components.**
Look at any existing inspector component for the pattern.

```
src/pages/Editor/components/ChatPanel/
├── ChatPanel.tsx
├── useChatPanel.ts
├── types.ts
├── index.ts
└── components/
    ├── SessionHeader/
    │   ├── SessionHeader.tsx
    │   ├── useSessionHeader.ts
    │   ├── types.ts
    │   └── index.ts
    ├── MessageThread/
    │   ├── MessageThread.tsx
    │   ├── useMessageThread.ts
    │   ├── types.ts
    │   └── index.ts
    ├── MessageBubble/
    │   ├── MessageBubble.tsx
    │   ├── types.ts
    │   └── index.ts
    ├── ActionChip/
    │   ├── ActionChip.tsx
    │   ├── types.ts
    │   └── index.ts
    └── ChatInput/
        ├── ChatInput.tsx
        ├── useChatInput.ts
        ├── types.ts
        └── index.ts
```

---

## 7. `useChatPanel.ts` — Main Hook

This is the orchestrator. It coordinates session management, message loading,
and wires everything together.

**On mount / when activeMsId changes:**
1. Load sessions for active MS via `loadChatSessions(msId, projectId)`
2. Store in `chatStore.setChatSessions(sessions)`
3. If sessions exist, auto-select the most recently updated one
4. Load messages for the selected session via `loadChatMessages(sessionId)`
5. Store in `chatStore.setActiveChatMessages(messages)`

**`handleNewSession()`:**
1. Call `createChatSession(msId, projectId)`
2. Add to `chatStore.chatSessions`
3. Set as active session
4. Clear `chatStore.activeChatMessages`

**`handleSelectSession(sessionId)`:**
1. Set `chatStore.activeChatSessionId = sessionId`
2. Load messages via `loadChatMessages(sessionId)`
3. Set in `chatStore.setActiveChatMessages`

**`handleDeleteSession(sessionId)`:**
1. Call `deleteChatSession(sessionId)`
2. Remove from `chatStore.chatSessions`
3. If it was active, select the next available session or clear

**`handleSendMessage(content)`:**
Described in CHAT_API.md — this is the main send flow.

---

## 8. `useSessionHeader.ts`

Handles the session list and MS switching.

**`handleMsChange(msId)`:**
1. Update `chatStore.activeMsId` (or derive from codeEditorStore if shared)
2. Load sessions for new MS
3. Auto-select most recent session

**`handleRenameSession(sessionId, newTitle)`:**
1. Call `updateSessionTitle(sessionId, newTitle)`
2. Update in `chatStore.chatSessions`

---

## 9. `useMessageThread.ts`

Handles scroll behaviour and message display.

- `messagesEndRef` — ref to bottom of thread for auto-scroll
- `shouldAutoScroll` — true when user is at bottom of scroll area
- On `activeChatMessages` change: if `shouldAutoScroll`, scroll to bottom
- On scroll: update `shouldAutoScroll` based on scroll position

---

## 10. Verification

- [ ] Tab switcher visible at top of right panel
- [ ] Clicking Chat tab shows chat panel, clicking Inspector shows inspector
- [ ] Inspector state preserved when switching to Chat and back
- [ ] MS dropdown populated with all MS nodes
- [ ] Switching MS loads correct sessions
- [ ] New Session button creates session, appears in session list
- [ ] Clicking session in list loads its messages
- [ ] Summary banner appears when session has summary, collapses/expands on click
- [ ] User messages and assistant messages styled differently
- [ ] Action chips appear on assistant messages
- [ ] Input: Enter sends, Shift+Enter adds newline
- [ ] Architecture toggle changes visual state and persists across refresh
- [ ] Send button disabled when input empty or loading
- [ ] Scroll stays at bottom as new messages arrive
- [ ] Session options menu: rename, summarise, delete all work
