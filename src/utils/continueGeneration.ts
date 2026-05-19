import DIRECTORY_SPEC         from '@prompts/springBootDirectory.md?raw'
import { getMessagesUrl }     from './proxyUrl'
import { db }                 from '@db'
import { parseGenerationStream } from './generateCode'

// ─── System prompt ────────────────────────────────────────────────

const CONTINUE_SYSTEM_PROMPT = `You are an expert software developer continuing an incomplete code generation.
 
You will receive:
1. An architecture JSON describing a complete microservice
2. A directory structure specification defining exactly where every file must go
3. A list of files that have already been generated — some may be complete,
   some may be incomplete (truncated mid-file due to an interrupted stream)
 
Your job is to:
  a) Regenerate any incomplete files fully
  b) Generate any files that are entirely missing
 
═══════════════════════════════════════════════════════════
RULE 1 — FOLLOW THE ARCHITECTURE JSON EXACTLY
═══════════════════════════════════════════════════════════
 
The architecture JSON is the single source of truth.
Generate only what is defined in it. Nothing more.
 
- Only generate the entities that exist in the JSON
- Use the exact field names and types defined — do not rename, do not add
- Only generate the DTOs that exist in the JSON with their exact fields
- Only generate the services that exist in the JSON
- Only generate the methods listed in service.methods[] — do not add extras
- Only generate the controllers that exist in the JSON
- Only generate the endpoints listed in controller.endpoints[]
- Only generate error handlers for errors defined in errorHandling.errors[]
- Only generate security configuration if an AuthGuard node exists in the JSON
- Only generate a repository if entity.config.generateRepository = true
- Only generate a service interface if service.config.generateInterface = true
- Only generate Docker files if docker.generateDockerfile/generateDockerCompose = true
 
If something is not in the JSON, do not generate it.
Do not invent anything. Do not assume anything.
 
═══════════════════════════════════════════════════════════
RULE 2 — HANDLE INCOMPLETE AND MISSING FILES
═══════════════════════════════════════════════════════════
 
The already generated files are provided in the user message.
 
STEP 1 — Identify incomplete files:
Examine every already-generated file carefully.
A file is incomplete if ANY of the following are true:
- A class, interface, or enum body is not properly closed (missing final })
- A method body is cut off before its closing }
- An annotation is partially written
- A YAML or properties file ends mid-property or mid-value
- The file content ends abruptly with no logical conclusion
- The last line is not a valid final line for that file type
 
Regenerate every incomplete file in full from scratch.
Use the architecture JSON to generate the correct and complete content.
 
STEP 2 — Identify missing files:
Compare the directory structure specification and the architecture JSON
against the list of already-generated files.
Any file that should exist but is not in the list is missing.
Generate every missing file.
 
STEP 3 — Leave complete files alone:
Any file that exists AND is complete must NOT be included in your output.
Do not modify complete files. Do not re-output them.
 
OUTPUT ORDER:
Generate incomplete files first (Step 1), then missing files (Step 2).
This ensures the most critical fixes appear first in the stream.
 
═══════════════════════════════════════════════════════════
RULE 3 — FOLLOW THE DIRECTORY STRUCTURE EXACTLY
═══════════════════════════════════════════════════════════
 
The directory structure specification defines where every file must go.
Follow it exactly for all files you generate.
Every conditional rule in the directory spec (marked with ←) must be respected.
 
═══════════════════════════════════════════════════════════
RULE 4 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════
 
Output every incomplete or missing file using this exact format:
 
<file path="FULL/PATH/FROM/PROJECT/ROOT">
FILE CONTENT HERE
</file>
 
- No text outside of <file> tags
- No markdown code fences inside file content
- Full path from the project root for every file
- Complete file content — not partial, not summarised
- If nothing is incomplete or missing, output nothing at all`

// ─── continueGeneration ───────────────────────────────────────────

// ─── isFileComplete ───────────────────────────────────────────────
// Heuristic: a file is complete if it ends with a logical final line.
// Checks for closing brace (Java/Kotlin), final YAML/properties value, etc.

function isFileComplete(content: string): boolean {
  const trimmed = content.trimEnd()
  if (!trimmed) return false
  // Java / Kotlin / JSON — must end with } or ]
  if (trimmed.endsWith('}') || trimmed.endsWith(']')) return true
  // XML — must end with a closing tag
  if (trimmed.endsWith('>')) return true
  // properties / YAML — last non-empty line must not end with : or be mid-value
  const lastLine = trimmed.split('\n').pop() ?? ''
  if (lastLine.trim().endsWith(':')) return false
  return true
}

export async function continueGeneration(params: {
  architecture:         object
  msId:                 string
  projectId:            string
  signal:               AbortSignal
  onFileListReady?:     (allPaths: string[], completePaths: string[]) => void
  onFileStart:          (path: string) => void
  onFileChunk:          (path: string, chunk: string) => void
  onFileComplete:       (path: string, content: string) => void
  onDone:               () => void
  onError:              (err: Error) => void
  onTimeout?:           () => void
  onThinkingChunk?:     (chunk: string) => void
  onGenerationStarted?: () => void
}): Promise<void> {
  // 1. Load all already-generated files from IDB
  const existingRows = await db.generatedFiles
    .where('msId').equals(params.msId)
    .toArray()

  const existingFiles: Record<string, string> = {}
  existingRows.forEach(row => {
    existingFiles[row.filePath] = row.content
  })

  // 2. Classify which existing files are complete vs incomplete
  const allExistingPaths  = Object.keys(existingFiles)
  const completePaths     = allExistingPaths.filter(p => isFileComplete(existingFiles[p]))
  params.onFileListReady?.(allExistingPaths, completePaths)

  // 3. Build the already-generated XML block
  const alreadyGeneratedXml = Object.entries(existingFiles)
    .map(([path, content]) =>
      `<existing-file path="${path}">\n${content}\n</existing-file>`)
    .join('\n\n')

  // 4. Build user message
  const userMessage =
`ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

ALREADY GENERATED FILES (do not regenerate these):
${alreadyGeneratedXml}

Generate ONLY the files that are missing from the complete application.
Compare the directory structure and architecture against the already generated
files above to determine what is missing. Generate only those missing files.`

  // 5. Call the API + parse stream
  try {
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal:  params.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    'claude-sonnet-4-5',
        stream:   true,
        messages: [
          { role: 'system', content: CONTINUE_SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
      }),
    })

    if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
      const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const errMsg  = errBody.error?.message ?? `HTTP ${response.status}`
      if (errMsg.toLowerCase().includes('timed out') && params.onTimeout) {
        params.onTimeout()
      } else {
        params.onError(new Error(errMsg))
      }
      return
    }

    // 6. Parse the stream — same parser as generateCode
    await parseGenerationStream({
      response,
      msId:                params.msId,
      projectId:           params.projectId,
      onFileStart:         params.onFileStart,
      onFileChunk:         params.onFileChunk,
      onFileComplete:      params.onFileComplete,
      onThinkingChunk:     params.onThinkingChunk,
      onGenerationStarted: params.onGenerationStarted,
      onTimeout:           params.onTimeout,
    })

    params.onDone()
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return  // intentional abort — not an error
    }
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.toLowerCase().includes('timed out') && params.onTimeout) {
      params.onTimeout()
    } else {
      params.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
