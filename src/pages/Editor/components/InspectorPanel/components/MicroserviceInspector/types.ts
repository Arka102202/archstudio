import type { MicroserviceNode, BuildTool, DockerConfig, AIPrompt } from '@entity'

export interface MicroserviceInspectorProps {
  nodeId: string
}

export interface MicroserviceInspectorHook {
  node:                      MicroserviceNode | null
  isLoading:                 boolean

  // Identity handlers
  handleLabelChange:         (value: string) => void
  handleServiceNameChange:   (value: string) => void
  handlePackageNameChange:   (value: string) => void
  handlePortChange:          (value: string) => void
  handleVersionChange:       (value: string) => void

  // Build handlers
  handleBuildToolChange:     (value: BuildTool) => void
  handleSpringVersionChange: (value: string) => void
  handleJavaVersionChange:   (value: '17' | '21') => void

  // Dependency handlers
  handleAddDependency:       (raw: string) => void
  handleRemoveDependency:    (index: number) => void

  // Docker handlers
  handleDockerToggle:        (field: keyof DockerConfig) => void
  handleBaseImageChange:     (value: string) => void

  // AI prompt handlers
  handleAIPromptChange:      (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle:    () => void

  // Lifecycle handlers
  handleClose:               () => void
  handleDelete:              () => void
}

// ─── Preset dependency definitions ────────────────────────────────

export interface PresetDep {
  label:      string
  artifactId: string
  groupId:    string
  colorVar:   string   // CSS var prefix e.g. "--dep-web"
}
