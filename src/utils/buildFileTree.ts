// ─── ArchitectureExport ───────────────────────────────────────────
// Minimal shape of what exportArchitecture() returns — enough for
// file-tree building. Only the microservice serviceName + packageName
// are required to construct Spring Boot paths.

export interface ArchitectureMicroservice {
  serviceName: string
  packageName: string
}

export interface ArchitectureExport {
  microservice: ArchitectureMicroservice
}

// ─── FileNode ─────────────────────────────────────────────────────

export interface FileNode {
  type:     'file' | 'folder'
  name:     string
  path:     string
  language: string
  content:  string
  children: FileNode[]
}

// ─── Language inference ───────────────────────────────────────────

const EXT_LANGUAGE: Record<string, string> = {
  java:       'java',
  yaml:       'yaml',
  yml:        'yaml',
  xml:        'xml',
  properties: 'ini',
  gradle:     'groovy',
  kts:        'kotlin',
  md:         'markdown',
  json:       'json',
  sql:        'sql',
  kt:         'kotlin',
}

export function inferLanguage(fileName: string): string {
  const lower = fileName.toLowerCase()

  // Special-case Dockerfile (no extension)
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile'

  const ext = lower.split('.').pop() ?? ''
  return EXT_LANGUAGE[ext] ?? 'plaintext'
}

// ─── buildFileTree ────────────────────────────────────────────────
// Converts a flat Record<filePath, content> into a root FileNode.
// The paths are relative to the MS root, e.g.:
//   "src/main/java/com/example/order/OrderApplication.java"
//
// The `arch` param is used to derive default paths when no files
// have been generated yet (returns a skeleton root node in that case).

export function buildFileTree(
  arch:           ArchitectureExport,
  generatedFiles: Record<string, string> = {},
): FileNode {
  const serviceName = arch.microservice?.serviceName ?? 'service'
  const rootName    = serviceName

  const root: FileNode = {
    type:     'folder',
    name:     rootName,
    path:     rootName,
    language: '',
    content:  '',
    children: [],
  }

  const filePaths = Object.keys(generatedFiles)

  if (filePaths.length === 0) {
    return root
  }

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part     = parts[i]
      const isLeaf   = i === parts.length - 1
      const nodePath = parts.slice(0, i + 1).join('/')

      if (isLeaf) {
        const fileNode: FileNode = {
          type:     'file',
          name:     part,
          path:     filePath,
          language: inferLanguage(part),
          content:  generatedFiles[filePath] ?? '',
          children: [],
        }
        current.children.push(fileNode)
      } else {
        let folder = current.children.find(
          (c): c is FileNode => c.type === 'folder' && c.name === part,
        )
        if (!folder) {
          folder = {
            type:     'folder',
            name:     part,
            path:     nodePath,
            language: '',
            content:  '',
            children: [],
          }
          current.children.push(folder)
        }
        current = folder
      }
    }
  }

  return root
}
