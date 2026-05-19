# Continue Generation — Three Targeted Fixes

> Claude Code: read this in full before writing a single line.
> Three surgical fixes only — do not change anything else.

---

## Fix 1 — Strip accidental `</file>` from stored file content

### Problem

When the stream is aborted or interrupted mid-generation, the closing `</file>`
tag of a subsequent file can bleed into the content of the current file being
parsed. This means the file stored in IDB contains the literal string `</file>`
at the end of its content.

### Where to fix

In `src/utils/generateCode.ts` (and `src/utils/parseGenerationStream.ts` if
extracted), inside the `onFileComplete` callback invocation — before writing
to IDB, clean the content:

```typescript
// When closing tag is found and file is complete:
const completedContent = currentContent

// Strip any accidentally included </file> tag from the end
const cleanContent = completedContent
  .replace(/<\/file>\s*$/, '')
  .trimEnd()

// Use cleanContent everywhere — both in the callback and in the IDB write
params.onFileComplete(completedPath, cleanContent)

await db.generatedFiles.put({
  id:          `${params.msId}:${completedPath}`,
  msId:        params.msId,
  projectId:   params.projectId,
  filePath:    completedPath,
  content:     cleanContent,      // ← use cleanContent, not completedContent
  generatedAt: Date.now(),
})
```

Apply the same fix in `continueGeneration.ts` and `regenerateWithDiff.ts`
wherever files are written to IDB.

---

## Fix 2 — Escape XML closing tags inside existing file content

### Problem

When `continueGeneration.ts` builds the user message, it wraps each existing
file in `<existing-file path="...">...</existing-file>` tags. If any file
content contains the literal strings `</file>` or `</existing-file>`, it
breaks the XML structure and confuses Claude's parsing.

### Where to fix

In `src/utils/continueGeneration.ts`, in the section that builds
`alreadyGeneratedXml`:

```typescript
// BEFORE (unsafe):
const alreadyGeneratedXml = Object.entries(existingFiles)
  .map(([path, content]) =>
    `<existing-file path="${path}">\n${content}\n</existing-file>`)
  .join('\n\n')

// AFTER (safe):
const alreadyGeneratedXml = Object.entries(existingFiles)
  .map(([path, content]) => {
    // Escape any closing XML tags inside file content
    // so they don't interfere with the outer XML structure
    const safeContent = content
      .replace(/<\/file>/g,          '<\\/file>')
      .replace(/<\/existing-file>/g, '<\\/existing-file>')
    return `<existing-file path="${path}">\n${safeContent}\n</existing-file>`
  })
  .join('\n\n')
```

---

## Fix 3 — Also clean content when loading from IDB

### Problem

Files that were stored with corrupted content before Fix 1 was applied are
already in IDB. Loading them as-is still sends the `</file>` string to Claude.

### Where to fix

In `continueGeneration.ts`, after loading files from IDB but before building
the XML, clean any existing corruption:

```typescript
const existingFiles: Record<string, string> = {}
existingRows.forEach(row => {
  // Clean any corruption from previous generations
  // (accidental </file> tags stored before this fix was applied)
  const cleanContent = row.content
    .replace(/<\/file>\s*$/, '')
    .trimEnd()
  existingFiles[row.filePath] = cleanContent
})
```

---

## Summary of Files Changed

```
src/utils/generateCode.ts  (or parseGenerationStream.ts if extracted)
  → strip </file> from completedContent before onFileComplete + IDB write

src/utils/continueGeneration.ts
  → escape </file> and </existing-file> in alreadyGeneratedXml
  → clean loaded IDB content before building user message

src/utils/regenerateWithDiff.ts
  → strip </file> from completedContent before onFileComplete + IDB write
  → escape </file> and </existing-file> in affectedFiles XML
```

---

## Verification

- [ ] Generate code, abort mid-stream
- [ ] Open IDB in DevTools → check `generatedFiles` table
- [ ] File content does NOT end with `</file>` string
- [ ] Click Continue → no `</file>` appearing inside `<existing-file>` blocks
  in the network request payload
- [ ] Claude correctly identifies complete vs incomplete files
- [ ] StudentService.java or any other interface file stored cleanly
- [ ] Continue generates only incomplete/missing files as expected
