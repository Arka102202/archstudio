import JSZip    from 'jszip'
import { saveAs } from 'file-saver'

export async function downloadAsZip(params: {
  files:        Record<string, string>
  claudeFiles?: Record<string, string>
  serviceName:  string
  version:      string
}): Promise<void> {
  const zip = new JSZip()

  for (const [path, content] of Object.entries(params.files)) {
    zip.file(path, content)
  }

  for (const [path, content] of Object.entries(params.claudeFiles ?? {})) {
    zip.file(path, content)
  }

  const blob     = await zip.generateAsync({ type: 'blob' })
  const filename = `${params.serviceName}-${params.version}.zip`
  saveAs(blob, filename)
}
