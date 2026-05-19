# Fix — MS Switch Shows Files From Both Nodes

> Claude Code: apply this single targeted fix to useCodeEditor.ts.
> Do not change anything else.

---

## Root Cause

`populateVSCodeFiles` calls `registerFileSystemOverlay` to add files into VS
Code's memory filesystem. Each call **adds** files — it never removes previous
ones. When the user switches MS nodes, the new MS's files are added on top of
the old ones. VS Code shows both sets simultaneously.

---

## Fix — `useCodeEditor.ts`

### Step 1 — Add a ref to track the current provider

```typescript
import { useRef } from 'react'
import type { RegisteredFileSystemProvider } from '@codingame/monaco-vscode-files-service-override'

// Inside useCodeEditor():
const providerRef = useRef<RegisteredFileSystemProvider | null>(null)
```

### Step 2 — Update `populateVSCodeFiles` to dispose the old provider first

Replace the existing `populateVSCodeFiles` call site in `useCodeEditor.ts`
with a version that passes the ref:

```typescript
useEffect(() => {
  if (!ready || !msId || !projectId) return

  exportArchitecture(msId, projectId).then(async arch => {
    const tree = buildFileTree(arch as ArchitectureExport)

    // Dispose the previous provider before registering new files
    // This removes all files from the previous MS from VS Code's filesystem
    if (providerRef.current) {
      providerRef.current.dispose()
      providerRef.current = null
    }

    const newProvider = await populateVSCodeFiles(tree, generatedFiles)
    providerRef.current = newProvider
  })
}, [ready, msId, projectId, generatedFiles])
```

### Step 3 — Update `populateVSCodeFiles` to return the provider

In `src/lib/populateVSCodeFiles.ts`, change the function to return the
provider so the caller can hold a reference to it:

```typescript
import {
  RegisteredFileSystemProvider,
  RegisteredReadOnlyFile,
  registerFileSystemOverlay,
} from '@codingame/monaco-vscode-files-service-override'
import { URI } from 'monaco-editor'

export async function populateVSCodeFiles(
  tree:           FileNode,
  generatedFiles: Record<string, string>,
): Promise<RegisteredFileSystemProvider> {   // ← return the provider

  const provider = new RegisteredFileSystemProvider(false)

  const walk = (node: FileNode) => {
    if (node.type === 'file') {
      const content = generatedFiles[node.path] ?? node.content
      const bytes   = new TextEncoder().encode(content)
      const uri     = URI.parse(`memory:///archflow/${node.path}`)
      provider.registerFile(new RegisteredReadOnlyFile(uri, () => bytes))
    }
    node.children.forEach(walk)
  }
  walk(tree)

  registerFileSystemOverlay(1, provider)

  return provider   // ← caller stores this and calls .dispose() on next switch
}
```

---

## Result

- Switching MS in the dropdown → old provider disposed → old files gone from VS Code
- New provider registered → only new MS's files visible in Explorer
- No accumulation — each MS switch gives a clean slate

---

## Verification

- [ ] Two MS nodes exist with different entities (e.g. Order + Product)
- [ ] Code tab shows Order MS files → Explorer shows Order.java, OrderService.java etc.
- [ ] Switch dropdown to Product MS → Explorer immediately shows only Product files
- [ ] Order files are gone — not mixed with Product files
- [ ] Switch back to Order → Order files reappear, Product files gone
- [ ] Generated files for each MS are preserved correctly after switching
