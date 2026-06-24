import { getMessagesUrl, getProxyHeaders } from './proxyUrl'
import { db }             from '@db'
import DIRECTORY_SPEC     from '@prompts/springBootDirectory.md?raw'

// ─── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert software developer.

You will receive:
1. An architecture JSON describing a complete microservice
2. A directory structure specification defining exactly where every file must go

Your job is to generate a complete, production-ready application.

═══════════════════════════════════════════════════════════
RULE 1 — FOLLOW THE ARCHITECTURE JSON EXACTLY
═══════════════════════════════════════════════════════════

The architecture JSON is the single source of truth.
Generate only what is defined in it. Nothing more.

- Only generate the entities that exist in the JSON
- Use the exact field names and types defined — do not rename, do not add
- Only generate the DTOs that exist in the JSON with their exact fields
- Only generate the services that exist in the JSON
- Only generate the methods that are listed in service.methods[] — do not add extras
- Only generate the controllers that exist in the JSON
- Only generate the endpoints listed in controller.endpoints[] — correct paths and HTTP methods
- Only generate error handlers for the errors defined in errorHandling.errors[]
- Only generate a security configuration if an AuthGuard node exists in the JSON
- Only generate a repository if entity.config.generateRepository = true
- Only generate a service interface if service.config.generateInterface = true
- Only generate Docker files if docker.generateDockerfile / generateDockerCompose = true
- Only generate custom query infrastructure if customQueries[] has entries

If something is not in the JSON, do not generate it.
Do not invent anything. Do not assume anything.

═══════════════════════════════════════════════════════════
RULE 2 — FOLLOW THE DIRECTORY STRUCTURE EXACTLY
═══════════════════════════════════════════════════════════

The directory structure specification defines where every file must go.
Follow it exactly. Do not invent new folders or file placements.
Every conditional rule in the directory spec (marked with ←) must be respected.

═══════════════════════════════════════════════════════════
RULE 3 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════

Output every file using this exact format:

<file path="FULL/PATH/FROM/PROJECT/ROOT">
FILE CONTENT HERE
</file>

- No text outside of <file> tags
- No markdown code fences inside file content
- Full path from the project root for every file
- Complete file content — not partial, not summarised`

// ─── parseGenerationStream ────────────────────────────────────────
// Buffer-based SSE stream parser. Tags split across chunk boundaries
// are always detected because the full accumulated text is scanned.
// On AbortError: flushes any partial file in progress, then re-throws.

export async function parseGenerationStream(params: {
  response:             Response
  msId:                 string
  projectId:            string
  onFileStart:          (path: string) => void
  onFileChunk:          (path: string, chunk: string) => void
  onFileComplete:       (path: string, content: string) => void
  onThinkingChunk?:     (chunk: string) => void
  onGenerationStarted?: () => void
  onTimeout?:           () => void
}): Promise<void> {
  const reader  = params.response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let   buffer  = ''

  let currentPath       = ''
  let currentContent    = ''
  let insideFile        = false
  let accumulated       = ''
  let parsedUpTo        = 0
  let generationStarted = false

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
          const event = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string } }

          // API returned an error event mid-stream (e.g. timeout)
          if (event.error) {
            const errMsg = event.error.message ?? 'API error'
            if (errMsg.toLowerCase().includes('timed out') && params.onTimeout) {
              params.onTimeout()
            } else {
              throw new Error(errMsg)
            }
            return
          }

          const chunk = event.choices?.[0]?.delta?.content ?? ''
          if (!chunk) continue

          if (!generationStarted && !chunk.includes('<file ')) {
            params.onThinkingChunk?.(chunk)
          }

          if (!generationStarted && chunk.includes('<file ')) {
            generationStarted = true
            params.onGenerationStarted?.()
          }

          accumulated += chunk
        } catch { continue }
      }

      // Scan unprocessed text from where we left off
      let text = accumulated.slice(parsedUpTo)

      while (true) {
        if (!insideFile) {
          const openMatch = text.match(/<file path="([^"]+)">/)
          if (!openMatch) break

          const idx      = text.indexOf(openMatch[0])
          currentPath    = openMatch[1]
          currentContent = ''
          insideFile     = true
          params.onFileStart(currentPath)

          const consumed = idx + openMatch[0].length
          parsedUpTo    += consumed
          text           = text.slice(consumed)

        } else {
          const closeIdx = text.indexOf('</file>')
          if (closeIdx === -1) {
            if (text.length > 0) {
              currentContent += text
              params.onFileChunk(currentPath, text)
              parsedUpTo += text.length
              text        = ''
            }
            break
          }

          const finalChunk = text.slice(0, closeIdx)
          if (finalChunk) {
            currentContent += finalChunk
            params.onFileChunk(currentPath, finalChunk)
          }

          const completedPath    = currentPath
          const completedContent = currentContent
          params.onFileComplete(completedPath, completedContent)

          await db.generatedFiles.put({
            id:          `${params.msId}:${completedPath}`,
            msId:        params.msId,
            projectId:   params.projectId,
            filePath:    completedPath,
            content:     completedContent,
            generatedAt: Date.now(),
          })

          const consumed = closeIdx + '</file>'.length
          parsedUpTo    += consumed
          text           = text.slice(consumed)

          insideFile     = false
          currentPath    = ''
          currentContent = ''
        }
      }
    }
  } catch (err) {
    // On abort: flush any partial file that was in progress
    if ((err as Error).name === 'AbortError') {
      if (insideFile && currentContent) {
        params.onFileComplete(currentPath, currentContent)
        await db.generatedFiles.put({
          id:          `${params.msId}:${currentPath}`,
          msId:        params.msId,
          projectId:   params.projectId,
          filePath:    currentPath,
          content:     currentContent,
          generatedAt: Date.now(),
        })
      }
      throw err  // re-throw so caller can detect the abort
    }
    throw err
  }
}

// ─── generateCode ─────────────────────────────────────────────────

export async function generateCode(params: {
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
  // Full generation — no pre-existing files, fire with empty complete list
  params.onFileListReady?.([], [])

  const userMessage =
`ARCHITECTURE:
${JSON.stringify(params.architecture, null, 2)}

DIRECTORY STRUCTURE:
${DIRECTORY_SPEC}

Generate the complete application following both documents above.`

  try {
    const response = await fetch(getMessagesUrl(), {
      method:  'POST',
      signal:  params.signal,
      headers: getProxyHeaders(),
      body: JSON.stringify({
        model:    'claude-sonnet-4-5',
        stream:   true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
