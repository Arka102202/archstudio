// Regenerates and persists .claude/ context files into the generatedFiles store.
// Call after any generation (code gen or CodeChat) completes so the files
// always reflect the latest architecture + generated code.

import { db }                    from '@db'
import { useCodeEditorStore }    from '@store'
import { exportArchitecture }    from './exportArchitecture'
import { generateClaudeContext } from './generateClaudeContext'

export async function syncClaudeContext(msId: string, projectId: string): Promise<void> {
  try {
    const arch           = await exportArchitecture(msId, projectId)
    const generatedFiles = useCodeEditorStore.getState().generatedFiles
    const claudeFiles    = generateClaudeContext({ arch, generatedFiles })

    const now   = Date.now()
    const store = useCodeEditorStore.getState()

    await Promise.all(
      Object.entries(claudeFiles).map(async ([filePath, content]) => {
        await db.generatedFiles.put({
          id:          `${msId}:${filePath}`,
          msId,
          projectId,
          filePath,
          content,
          generatedAt: now,
        })
        store.setGeneratedFile(filePath, content)
      }),
    )
  } catch {
    // Non-fatal — context sync failure must never break the main flow
  }
}
