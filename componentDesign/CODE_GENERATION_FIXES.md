# Code Generation — Three Targeted Fixes

> Claude Code: apply these three changes to the existing generateCode.ts.
> Do not change anything else in CODE_GENERATION_V2.md.

---

## Fix 1 — Add `max_tokens: 32000`

In `src/utils/generateCode.ts`, in the fetch body, add `max_tokens`:

```typescript
body: JSON.stringify({
  model:      'claude-sonnet-4',
  stream:     true,
  max_tokens: 32000,   // ADD THIS — without it the proxy defaults to a small limit
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userMessage },
  ],
}),
```

---

## Fix 2 — Replace system prompt

In `src/utils/generateCode.ts`, replace `SYSTEM_PROMPT` entirely:

```typescript
const SYSTEM_PROMPT = `You are an expert Spring Boot developer.
Analyse the provided microservice architecture JSON completely and generate
a full, production-ready Spring Boot application.

Output each file using this exact format:
<file path="FULL_PATH">
CONTENT
</file>

Do not include any text outside of <file> tags.
Do not include markdown code fences inside file content.`
```

---

## Fix 3 — Defensive `</file>` tag parser

The current parser processes chunks as they arrive. If a `</file>` closing tag
is split across two chunks — e.g. `</fi` in one event and `le>` in the next —
it is never detected and corrupts all subsequent output.

Replace the entire inner stream-processing loop in `generateCode.ts` with a
buffer-based approach that scans the accumulated full text:

```typescript
// Replace everything from "// File parsing state" down to params.onDone()
// with this:

let accumulated = ''   // full raw text accumulated across ALL chunks
let parsedUpTo  = 0    // how far into accumulated we've already processed

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
      const event = JSON.parse(data)
      const chunk = event.choices?.[0]?.delta?.content ?? ''
      if (!chunk) continue
      accumulated += chunk
    } catch { continue }
  }

  // Process accumulated text from where we left off
  let text = accumulated.slice(parsedUpTo)

  while (true) {
    if (!insideFile) {
      // Look for opening tag in unprocessed text
      const openMatch = text.match(/<file path="([^"]+)">/)
      if (!openMatch) break   // no opening tag yet — wait for more chunks

      const idx = text.indexOf(openMatch[0])
      currentPath    = openMatch[1]
      currentContent = ''
      insideFile     = true
      params.onFileStart(currentPath)

      // Advance past the opening tag
      const consumed = idx + openMatch[0].length
      parsedUpTo    += consumed
      text           = text.slice(consumed)

    } else {
      // Look for closing tag in unprocessed text
      const closeIdx = text.indexOf('</file>')
      if (closeIdx === -1) {
        // No closing tag yet — emit what we have as a chunk and wait
        if (text.length > 0) {
          currentContent += text
          params.onFileChunk(currentPath, text)
          parsedUpTo += text.length
          text        = ''
        }
        break
      }

      // Closing tag found — emit the final content chunk
      const finalChunk = text.slice(0, closeIdx)
      if (finalChunk) {
        currentContent += finalChunk
        params.onFileChunk(currentPath, finalChunk)
      }

      // File complete
      const completedPath    = currentPath
      const completedContent = currentContent
      params.onFileComplete(completedPath, completedContent)

      // Write to IDB
      await db.generatedFiles.put({
        id:          `${params.msId}:${completedPath}`,
        msId:        params.msId,
        projectId:   params.projectId,
        filePath:    completedPath,
        content:     completedContent,
        generatedAt: Date.now(),
      })

      // Advance past </file>
      const consumed = closeIdx + '</file>'.length
      parsedUpTo    += consumed
      text           = text.slice(consumed)

      insideFile     = false
      currentPath    = ''
      currentContent = ''
    }
  }
}

params.onDone()
```

**Why this is better than the old parser:**

The old parser processed chunks as individual units. If `</file>` was split
across two chunks, neither chunk contained the full tag and it was never detected.

The new parser accumulates ALL text into a single `accumulated` string and tracks
`parsedUpTo` — how far it has processed. It scans the full unprocessed text on
every new chunk. A `</file>` tag that arrives in two pieces will be in
`accumulated` as a whole string by the next iteration and will be found correctly.

