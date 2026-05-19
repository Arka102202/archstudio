import type {
  DBNode,
  DBType,
  DDLAuto,
  AIPrompt,
} from '@entity'

export interface DBInspectorProps {
  nodeId: string
}

// ─── Connected table entry for the CONNECTIONS section ───────────

export interface ConnectedTable {
  edgeId:     string
  tableId:    string
  tableLabel: string
}

// ─── Hook return type ─────────────────────────────────────────────

export interface DBInspectorHook {
  node: DBNode | null

  // Identity
  handleLabelChange:   (value: string) => void
  handleDbNameChange:  (value: string) => void
  handleDbTypeChange:  (value: DBType)  => void

  // Connection
  handleHostChange:     (value: string) => void
  handlePortChange:     (value: string) => void
  handleSchemaChange:   (value: string) => void
  handleUsernameChange: (value: string) => void
  handlePasswordChange: (value: string) => void
  showPassword:         boolean
  toggleShowPassword:   () => void

  // Config
  handleDdlAutoChange:   (value: DDLAuto) => void
  handlePoolSizeChange:  (value: string)  => void
  handleShowSqlToggle:   () => void
  handleFlywayToggle:    () => void
  handleRedisToggle:     () => void

  // Connections — TableNodes connected via CONNECTS_TO edges
  connectedTables:       ConnectedTable[]
  handleDisconnectTable: (edgeId: string) => Promise<void>

  // AI Prompt (node-level)
  handleAIPromptChange:   (field: keyof AIPrompt, value: string) => void
  handleAIGenerateToggle: () => void

  // Lifecycle
  handleClose:  () => void
  handleDelete: () => void
}
