import { MarkerType, type Node as RFNode, type Edge as RFEdge } from '@xyflow/react'
import { NodeType, EdgeType } from '@entity'
import type { NodeRow, EdgeRow } from '@db'

// ─── nodeRowToRfNode ──────────────────────────────────────────────
// Converts a raw IDB NodeRow into a React Flow node.
// Mirrors the loadNodes logic in useCanvas — keep in sync if that changes.

export function nodeRowToRfNode(row: NodeRow): RFNode | null {
  const data = JSON.parse(row.data) as Record<string, unknown> & { msId?: string | null }

  const makeChildNode = (type: string): RFNode => {
    const n: RFNode = {
      id:       row.id,
      type,
      position: row.position,
      data:     data as Record<string, unknown>,
      width:    row.size.w,
      height:   row.size.h,
    }
    if (data.msId) {
      n.parentId = data.msId as string
      n.extent   = 'parent'
    }
    return n
  }

  switch (row.type) {
    case NodeType.MICROSERVICE:
      return {
        id:         row.id,
        type:       'microservice',
        position:   row.position,
        data:       data as Record<string, unknown>,
        dragHandle: '.ms-drag-handle',
        width:      row.size.w,
        height:     row.size.h,
        style:      { width: row.size.w, height: row.size.h },
      }
    case NodeType.ENTITY: {
      // Backfill fields added in later versions
      const entityData = data as { fields?: Record<string, unknown>[] }
      if (Array.isArray(entityData.fields)) {
        entityData.fields = entityData.fields.map(f => ({
          ...(!('arraySubType'      in f) ? { arraySubType:      null } : {}),
          ...(!('arrayEntityTypeId' in f) ? { arrayEntityTypeId: null } : {}),
          ...f,
        }))
      }
      return makeChildNode('entity')
    }
    case NodeType.DTO: {
      const dtoData = data as { fields?: Record<string, unknown>[] }
      if (Array.isArray(dtoData.fields)) {
        dtoData.fields = dtoData.fields.map(f => ({
          ...(!('arraySubType'      in f) ? { arraySubType:      null } : {}),
          ...(!('arrayEntityTypeId' in f) ? { arrayEntityTypeId: null } : {}),
          ...f,
        }))
      }
      return makeChildNode('dto')
    }
    case NodeType.DB:          return makeChildNode('db')
    case NodeType.TABLE:       return makeChildNode('table')
    case NodeType.SERVICE:     return makeChildNode('service')
    case NodeType.CONTROLLER:  return makeChildNode('controller')
    case NodeType.API_ENDPOINT: return makeChildNode('endpoint')
    case NodeType.CUSTOM_TYPE: return makeChildNode('customType')
    default:                   return null
  }
}

// ─── edgeRowToRfEdge ──────────────────────────────────────────────
// Converts a raw IDB EdgeRow into a React Flow edge.
// Mirrors the loadEdges flatMap in useCanvas — keep in sync if that changes.

const EDGE_MAP: Partial<Record<EdgeType, { type: string; color: string }>> = {
  [EdgeType.STORED_IN]:        { type: 'storedIn',        color: 'var(--node-db-accent)'     },
  [EdgeType.CONNECTS_TO]:      { type: 'connectsTo',      color: 'var(--node-db-accent)'     },
  [EdgeType.USES]:             { type: 'uses',             color: 'var(--node-svc-accent)'    },
  [EdgeType.INVOKES]:          { type: 'invokes',          color: 'var(--node-ctrl-accent)'   },
  [EdgeType.ROUTES_TO]:        { type: 'routesTo',         color: 'var(--node-ep-accent)'     },
  [EdgeType.ACCEPTS]:          { type: 'accepts',          color: 'var(--node-dto-accent)'    },
  [EdgeType.RETURNS]:          { type: 'returns',          color: 'var(--node-dto-accent)'    },
  [EdgeType.EMBEDS]:           { type: 'embeds',           color: 'var(--node-entity-accent)' },
  [EdgeType.RELATES_TO]:       { type: 'relatesTo',        color: 'var(--color-warning)'      },
  [EdgeType.USES_TYPE]:        { type: 'usesType',         color: 'var(--node-dto-accent)'    },
  [EdgeType.USES_CUSTOM_TYPE]: { type: 'usesCustomType',   color: 'var(--node-entity-accent)' },
  [EdgeType.DERIVED_FROM]:     { type: 'derivedFrom',      color: 'var(--node-dto-accent)'    },
}

const FALLBACK = { type: 'derivedFrom', color: 'var(--node-dto-accent)' }

export function edgeRowToRfEdge(row: EdgeRow): RFEdge {
  const m = EDGE_MAP[row.type as EdgeType] ?? FALLBACK
  const isUnsided = row.type === EdgeType.USES_CUSTOM_TYPE || row.type === EdgeType.USES_TYPE

  return {
    id:           row.id,
    source:       row.fromNodeId,
    target:       row.toNodeId,
    sourceHandle: row.fromHandle || (isUnsided ? '' : 'right'),
    targetHandle: row.toHandle   || (isUnsided ? '' : 'left'),
    type:         m.type,
    data:         row as unknown as Record<string, unknown>,
    markerEnd: { type: MarkerType.ArrowClosed, color: m.color, width: 12, height: 12 },
  }
}
