export interface ChatSession {
  id:        string
  projectId: string
  msId:      string
  title:     string
  createdAt: number
  updatedAt: number
  summary:   string | null
}

export interface ChatMessage {
  id:        string
  sessionId: string
  projectId: string
  msId:      string
  role:      'user' | 'assistant'
  content:   string
  actions:   CanvasAction[]
  timestamp: number
  isError:   boolean
}

export type CanvasAction =
  | CreateNodeAction
  | CreateEdgeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | AddFieldAction

export interface CreateNodeAction {
  type:     'CREATE_NODE'
  nodeType: string
  label:    string
  data:     Record<string, unknown>
}

export interface CreateEdgeAction {
  type:      'CREATE_EDGE'
  fromLabel: string
  toLabel:   string
  edgeType:  string
}

export interface UpdateNodeAction {
  type:  'UPDATE_NODE'
  label: string
  patch: Record<string, unknown>
}

export interface DeleteNodeAction {
  type:  'DELETE_NODE'
  label: string
}

export interface AddFieldAction {
  type:      'ADD_FIELD'
  nodeLabel: string
  field:     Record<string, unknown>
}
