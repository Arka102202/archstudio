import Dexie, { type Table } from 'dexie'

// ─── Row shapes ───────────────────────────────────────────────────
// These are plain row types for the IDB tables.
// Full domain types (Project, NodeRecord, EdgeRecord) live in src/entity/
// and will be imported here in Step 5 when the entity layer exists.
// For now we use minimal inline types so the schema compiles cleanly.

export interface ProjectRow {
  id:          string
  name:        string
  description: string
  createdAt:   number
  updatedAt:   number
}

export interface NodeRow {
  id:        string
  projectId: string
  type:      string
  label:     string
  position:  { x: number; y: number }
  size:      { w: number; h: number }
  data:      string   // JSON.stringify of the full typed node object
  createdAt: number
  updatedAt: number
}

export interface EdgeRow {
  id:         string
  projectId:  string
  fromNodeId: string
  toNodeId:   string
  type:       string
  label:      string
  fromHandle: string   // handle id on the fromNode (DTO side)
  toHandle:   string   // handle id on the toNode (Entity side)
}

export interface SettingsRow {
  key:   string   // primary key — e.g. 'theme', 'inspectorWidth', 'sidebarWidth'
  value: string   // JSON.stringify of the actual value
}

export interface VersionRow {
  id:        string   // `${msId}-v${version}`  e.g. "ms-abc123-v3"
  projectId: string
  msId:      string   // MicroserviceNode.id (indexed)
  version:   number   // 1, 2, 3… per msId
  snapshot:  string   // JSON.stringify of exportArchitecture() output + version key
  savedAt:   number   // timestamp
}

export interface GeneratedFileRow {
  id:          string    // `${msId}:${filePath}`
  msId:        string
  projectId:   string
  filePath:    string    // virtual path e.g. "src/main/java/com/example/Order.java"
  content:     string
  generatedAt: number    // timestamp
}

export interface ChatSessionRow {
  id:        string
  projectId: string
  msId:      string
  title:     string
  createdAt: number
  updatedAt: number
  summary:   string | null
}

export interface ChatMessageRow {
  id:        string
  sessionId: string
  projectId: string
  msId:      string
  role:      string
  content:   string
  actions:   string
  timestamp: number
  isError:   boolean
}

export interface CodeChatSessionRow {
  id:           string   // session.id
  msId:         string
  projectId:    string
  title:        string
  createdAt:    number
  updatedAt:    number
  messagesJson: string   // JSON of messages, isStreaming forced false, fileOp content stripped
}

// ─── Database class ───────────────────────────────────────────────

class ArchflowDB extends Dexie {
  projects!:       Table<ProjectRow,       string>
  nodes!:          Table<NodeRow,          string>
  edges!:          Table<EdgeRow,          string>
  settings!:       Table<SettingsRow,      string>
  versions!:       Table<VersionRow,       string>
  generatedFiles!: Table<GeneratedFileRow, string>
  chatSessions!:    Table<ChatSessionRow,      string>
  chatMessages!:    Table<ChatMessageRow,      string>
  codeChatSessions!:Table<CodeChatSessionRow,  string>

  constructor() {
    super('archflow')

    this.version(1).stores({
      projects: 'id, updatedAt',
      nodes:    'id, projectId, type, [projectId+type]',
      edges:    'id, projectId, fromNodeId, toNodeId',
    })

    // Version 2 — adds the settings key-value store
    this.version(2).stores({
      projects: 'id, updatedAt',
      nodes:    'id, projectId, type, [projectId+type]',
      edges:    'id, projectId, fromNodeId, toNodeId',
      settings: 'key',
    })

    // Version 3 — adds the versions table for MS architecture snapshots
    this.version(3).stores({
      projects: 'id, updatedAt',
      nodes:    'id, projectId, type, [projectId+type]',
      edges:    'id, projectId, fromNodeId, toNodeId',
      settings: 'key',
      versions: 'id, msId, projectId',
    })

    // Version 4 — adds generatedFiles table for code generation output
    this.version(4).stores({
      projects:       'id, updatedAt',
      nodes:          'id, projectId, type, [projectId+type]',
      edges:          'id, projectId, fromNodeId, toNodeId',
      settings:       'key',
      versions:       'id, msId, projectId',
      generatedFiles: 'id, msId, projectId',
    })

    // Version 5 — adds chat sessions and messages tables
    this.version(5).stores({
      projects:       'id, updatedAt',
      nodes:          'id, projectId, type, [projectId+type]',
      edges:          'id, projectId, fromNodeId, toNodeId',
      settings:       'key',
      versions:       'id, msId, projectId',
      generatedFiles: 'id, msId, projectId',
      chatSessions:   'id, projectId, msId, updatedAt',
      chatMessages:   'id, sessionId, projectId, msId, timestamp',
    })

    // Version 6 — adds codeChatSessions for CodeChat persistence
    this.version(6).stores({
      projects:          'id, updatedAt',
      nodes:             'id, projectId, type, [projectId+type]',
      edges:             'id, projectId, fromNodeId, toNodeId',
      settings:          'key',
      versions:          'id, msId, projectId',
      generatedFiles:    'id, msId, projectId',
      chatSessions:      'id, projectId, msId, updatedAt',
      chatMessages:      'id, sessionId, projectId, msId, timestamp',
      codeChatSessions:  'id, msId, projectId, [msId+projectId]',
    })
  }
}

// ─── Singleton instance ───────────────────────────────────────────
// Import `db` anywhere in the app to access IndexedDB.
// Never instantiate ArchflowDB directly outside this file.

export const db = new ArchflowDB()
