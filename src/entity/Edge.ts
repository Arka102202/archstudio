import type { EdgeType } from './shared'

export interface Edge {
  id:         string
  projectId:  string
  fromNodeId: string
  toNodeId:   string
  type:       EdgeType
  label:      string
}
