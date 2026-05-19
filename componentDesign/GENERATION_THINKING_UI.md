# Generation Thinking Phase UI

> Claude Code: read this in full before writing a single line.
> This document adds three small targeted changes only.
> Do not change anything not explicitly mentioned here.

---

## What This Fixes

Claude writes plain text before the first `<file>` tag — planning the
structure, listing what it will generate. The parser correctly ignores this
text but the UI shows nothing, making it look frozen.

Fix: capture that pre-file raw output and display it live in the modal so
the user can see Claude thinking. Once the first `<file>` tag arrives,
the thinking display disappears and normal file progress takes over.

Also fix the two-phase timeout so it does not fire during the thinking phase.

---

## Change 1 — `codeEditorStore.ts`

Add two fields:

```typescript
// Thinking phase — raw Claude output before first <file> tag
thinkingText:        string
appendThinkingChunk: (chunk: string) => void
clearThinkingText:   () => void
```

Implementation:

```typescript
thinkingText: '',

appendThinkingChunk: (chunk) => set(s => ({
  thinkingText: s.thinkingText + chunk
})),

clearThinkingText: () => set({ thinkingText: '' }),
```

Also add the two-phase timeout flag:

```typescript
generationStarted:    boolean   // true once first <file> tag seen
setGenerationStarted: (v: boolean) => void
```

```typescript
generationStarted:    false,
setGenerationStarted: v => set({ generationStarted: v }),
```

Reset both in `clearGeneratedFiles`:

```typescript
clearGeneratedFiles: () => set({
  generatedFiles:    {},
  thinkingText:      '',
  generationStarted: false,
}),
```

---

## Change 2 — `generateCode.ts`

### 2a — Two-phase timeout

Replace the single `readWithTimeout(reader, 30000)` call with a dynamic
timeout based on whether generation has started:

```typescript
// Track whether first <file> tag has been seen
let generationStarted = false

// In the stream loop, use dynamic timeout:
const THINKING_TIMEOUT   = 120000  // 2 minutes — Claude is planning
const GENERATION_TIMEOUT = 30000   // 30 seconds — mid-stream silence

const result = await readWithTimeout(
  reader,
  generationStarted ? GENERATION_TIMEOUT : THINKING_TIMEOUT
)
```

### 2b — Capture pre-file chunks

In the chunk processing section, before the `<file>` tag parser runs,
check if generation has started. If not, send the raw chunk to the store
as thinking text:

```typescript
const chunk = event.choices?.[0]?.delta?.content ?? ''
if (!chunk) continue

// If no <file> tag seen yet, display raw chunk as thinking text
if (!generationStarted && !chunk.includes('<file ')) {
  params.onThinkingChunk?.(chunk)
}

// If this chunk contains the first <file> tag — generation has started
if (!generationStarted && chunk.includes('<file ')) {
  generationStarted = true
  params.onGenerationStarted?.()
}

// ... rest of existing chunk processing (parseGenerationStream) unchanged ...
```

### 2c — Add new optional callbacks to params

```typescript
export async function generateCode(params: {
  // ... existing params unchanged ...
  onThinkingChunk?:    (chunk: string) => void   // raw pre-file output
  onGenerationStarted?: () => void               // first <file> tag seen
  onStreamTimeout?:    () => void
}): Promise<void>
```

Do the same for `continueGeneration.ts` and `regenerateWithDiff.ts` —
add the same three optional callbacks and the same two-phase timeout logic.

### 2d — Wire callbacks in `makeGenerationCallbacks`

In `src/utils/generationCallbacks.ts`, add:

```typescript
onThinkingChunk: (chunk: string) => {
  codeStore.appendThinkingChunk(chunk)
},

onGenerationStarted: () => {
  codeStore.setGenerationStarted(true)
  codeStore.clearThinkingText()   // clear thinking text once files start
},
```

---

## Change 3 — `GenerationProgressModal.tsx`

### 3a — Thinking phase display

When `fileProgress.length === 0` AND `isGenerating` is true, show the
thinking UI instead of the empty file list:

```tsx
{codeStore.fileProgress.length === 0 && codeStore.isGenerating ? (
  // ── Thinking phase ──────────────────────────────────────────
  <div className="px-5 py-3 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="text-[11px] animate-pulse"
            style={{ color: 'var(--color-accent)' }}>
        ⟳
      </span>
      <span className="text-[11px] font-mono text-text-3">
        Analysing architecture...
      </span>
    </div>

    {codeStore.thinkingText && (
      <div className="rounded-[var(--radius-sm)] p-3"
           style={{
             background: 'var(--color-surface-alt)',
             border:     '1px solid var(--color-border)',
           }}>
        {/* Show last 6 lines of thinking text */}
        {codeStore.thinkingText
          .split('\n')
          .filter(l => l.trim())
          .slice(-6)
          .map((line, i) => (
            <div key={i}
                 className="text-[10px] font-mono text-text-3 leading-relaxed truncate">
              {line}
            </div>
          ))
        }
        {/* Blinking cursor */}
        <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse align-middle"
              style={{ background: 'var(--color-accent)' }} />
      </div>
    )}
  </div>
) : (
  // ── Normal file list (existing code unchanged) ───────────────
  <div className="px-5 py-3 flex flex-col gap-1 max-h-[240px] overflow-y-auto">
    {codeStore.fileProgress.map(item => (
      <FileProgressRow key={item.path} item={item} />
    ))}
  </div>
)}
```

### 3b — Hide progress bar during thinking phase

Only show the progress bar when files have started appearing:

```tsx
{codeStore.fileProgress.length > 0 && totalCount > 0 && (
  <div className="px-5 pb-2">
    {/* ... existing progress bar code unchanged ... */}
  </div>
)}
```

### 3c — Update modal subtitle during thinking

```tsx
<p className="text-[10px] font-mono text-text-3 mt-0.5">
  {store.msLabel}  ·  claude-sonnet-4
  {codeStore.fileProgress.length === 0 && codeStore.isGenerating
    ? '  ·  thinking...'
    : ''}
</p>
```

---

## Summary of Files Changed

```
src/store/codeEditorStore.ts
  → add thinkingText, appendThinkingChunk, clearThinkingText
  → add generationStarted, setGenerationStarted
  → reset both in clearGeneratedFiles

src/utils/generateCode.ts
  → two-phase timeout: 120s before first file, 30s after
  → capture pre-file chunks → params.onThinkingChunk?.()
  → detect first <file> tag → params.onGenerationStarted?.()
  → add onThinkingChunk, onGenerationStarted, onStreamTimeout to params

src/utils/continueGeneration.ts
  → same two-phase timeout
  → same onThinkingChunk + onGenerationStarted callbacks

src/utils/regenerateWithDiff.ts
  → same two-phase timeout
  → same onThinkingChunk + onGenerationStarted callbacks

src/utils/generationCallbacks.ts
  → add onThinkingChunk → codeStore.appendThinkingChunk
  → add onGenerationStarted → codeStore.setGenerationStarted(true)
                             + codeStore.clearThinkingText()

src/components/shared/GenerationProgressModal/GenerationProgressModal.tsx
  → show thinking UI when fileProgress is empty and isGenerating
  → show last 6 lines of thinkingText with blinking cursor
  → hide progress bar during thinking phase
  → add "thinking..." to subtitle
```

---

## Verification

- [ ] Click Generate → modal opens immediately
- [ ] Before first file: "Analysing architecture..." + spinning icon shown
- [ ] Raw Claude planning text appears line by line in the preview box
- [ ] Blinking cursor visible in the thinking preview
- [ ] Subtitle shows "thinking..."
- [ ] No progress bar during thinking phase
- [ ] Once first `<file>` tag arrives → thinking display disappears instantly
- [ ] File list starts populating normally
- [ ] Progress bar appears and fills
- [ ] Thinking text does NOT appear once files are generating
- [ ] Timeout does NOT fire during thinking phase (2 minute grace period)
- [ ] If stream goes truly silent mid-file → timeout fires at 30s
- [ ] Works the same for Continue and Apply Diff
