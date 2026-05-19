import { db }                        from '@db'
import DIRECTORY_SPEC                  from '@prompts/springBootDirectory.md?raw'
import { exportArchitecture }          from './exportArchitecture'
import { diffArchitecture }            from './diffArchitecture'
import { getMessagesUrl }              from './proxyUrl'
import { parseGenerationStream }       from './generateCode'
import { makeGenerationCallbacks, openGenerationSession } from './generationCallbacks'

// ─── DIFF_SYSTEM_PROMPT ───────────────────────────────────────────

const DIFF_SYSTEM_PROMPT = `You are an expert software developer maintaining an existing codebase.

You will receive:
1. A diff showing exactly what changed in the microservice architecture
2. The current content of files affected by those changes
3. The full current architecture JSON for context
4. A directory structure specification defining where every file must go

═══════════════════════════════════════════════════════════
RULE 1 — FOLLOW THE ARCHITECTURE JSON EXACTLY
═══════════════════════════════════════════════════════════

The architecture JSON is the single source of truth.
Every decision must be based on what is in the JSON.

- Do not add fields, methods, or endpoints that are not in the JSON
- Do not remove fields, methods, or endpoints that are still in the JSON
- Do not rename anything unless the diff explicitly shows a rename
- Do not generate files for things that are not in the JSON

If something is not in the JSON, do not generate it.
Do not invent anything. Do not assume anything.

═══════════════════════════════════════════════════════════
RULE 2 — ONLY OUTPUT CHANGED FILES
═══════════════════════════════════════════════════════════

Update ONLY the files that are directly affected by the diff.
Do NOT output files that are unchanged.
Do NOT regenerate the entire application.

A file is affected if the diff changes something it depends on:
- A new entity → its entity file, repository file, mapper file, and any
  service or controller that references it
- A field added to an entity → the entity file, its mapper, and any DTO
  derived from it
- An endpoint added to a controller → only that controller file
- A new DTO → only that DTO file
- An error definition changed → GlobalExceptionHandler and the relevant
  exception class only
- A service method added → the service interface (if exists) and impl file only
- A new custom type → only the custom type file and files that use it

If a file is not affected by the diff → do not include it. Not even as a
courtesy. Silence means unchanged.

═══════════════════════════════════════════════════════════
RULE 3 — FOLLOW THE DIRECTORY STRUCTURE EXACTLY
═══════════════════════════════════════════════════════════

The directory structure specification defines where every file must go.
Follow it exactly for any new files created by this diff.
Every conditional rule in the directory spec (marked with ←) must be respected.

═══════════════════════════════════════════════════════════
RULE 4 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════

Output every changed or new file using this exact format:

<file path="FULL/PATH/FROM/PROJECT/ROOT">
FILE CONTENT HERE
</file>

- No text outside of <file> tags
- No markdown code fences inside file content
- Output the COMPLETE file content — not just the changed lines
- Only include files that changed or are newly created
- If nothing needs to change, output nothing at all`

// ─── regenerateWithDiff ───────────────────────────────────────────

export async function regenerateWithDiff(params: {
  msId:      string
  projectId: string
  msLabel:   string
  signal:    AbortSignal
}): Promise<void> {
  const { msId, projectId, msLabel } = params

  // 1. Open progress modal + switch to Code tab
  openGenerationSession({ msId, msLabel, clearFiles: false })

  const callbacks = makeGenerationCallbacks({ msId, projectId, diffMode: true })

  try {
    // 2. Build current live architecture
    const currentArchitecture = await exportArchitecture(msId, projectId) as Record<string, unknown>

    // 3. Find the latest saved version for this MS
    const existing = await db.versions.where('msId').equals(msId).toArray()

    let lastVersion: Record<string, unknown> = {}
    if (existing.length > 0) {
      const latest = existing.reduce((best, row) => row.version > best.version ? row : best)
      lastVersion  = JSON.parse(latest.snapshot) as Record<string, unknown>
    }

    // 4. Compute diff
    const diff = diffArchitecture(lastVersion, currentArchitecture)

    // 5. Load all previously generated files from IDB
    const existingRows = await db.generatedFiles
      .where('msId').equals(msId)
      .toArray()

    const affectedFiles: Record<string, string> = {}
    existingRows.forEach(row => { affectedFiles[row.filePath] = row.content })

    // 6. Build user message
    const userMessage =
`ARCHITECTURE CHANGES (diff):
${JSON.stringify(diff, null, 2)}

AFFECTED EXISTING FILES:
${Object.entries(affectedFiles)
  .map(([path, content]) =>
    `<existing-file path="${path}">\n${content}\n</existing-file>`)
  .join('\n\n')}

FULL CURRENT ARCHITECTURE:
${JSON.stringify(currentArchitecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Update only the files affected by the changes. Skip unchanged files.`

    // 7. Call the API
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal:  params.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'claude-sonnet-4-5',
        stream:   true,
        messages: [
          { role: 'system', content: DIFF_SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(errBody.error?.message ?? `HTTP ${response.status}`)
    }

    // 8. Parse the stream with the shared buffer-based parser
    await parseGenerationStream({
      response,
      msId,
      projectId,
      onFileStart:         callbacks.onFileStart,
      onFileChunk:         callbacks.onFileChunk,
      onFileComplete:      callbacks.onFileComplete,
      onThinkingChunk:     callbacks.onThinkingChunk,
      onGenerationStarted: callbacks.onGenerationStarted,
    })

    callbacks.onDone()

  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return  // intentional abort — not an error
    }
    callbacks.onError(err instanceof Error ? err : new Error(String(err)))
  }
}
