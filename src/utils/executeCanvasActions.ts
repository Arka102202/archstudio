import { db }          from '@db'
import { NodeType, EdgeType, JavaType, FieldConstraint } from '@entity'
import { emptyAIPrompt } from '@entity/AIPrompt'
import { generateId }  from './id'
import {
  createEntityNode, createDTONode, createServiceNode, createControllerNode,
  createAPIEndpointNode, createDBNode, createTableNode, createCustomTypeNode,
} from './node'
import {
  applyDerivedFromEdge, applyStoredInEdge, applyConnectsToEdge, applyUsesEdge,
} from './autoPopulate'
import type { CanvasAction, EntityNode, DTONode, ServiceNode, TableNode, DBNode } from '@entity'
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react'

export interface ExecutionResult {
  createdNodeIds: string[]
  createdEdgeIds: string[]
  updatedNodeIds: string[]
  deletedNodeIds: string[]
  errors:         string[]
}

function findNodeByLabel(rfNodes: RFNode[], label: string): RFNode | undefined {
  return rfNodes.find(n => {
    const data = n.data as { label?: string } | undefined
    return data?.label === label
  })
}

function nodeTypeToRfType(nodeType: string): string {
  const map: Record<string, string> = {
    ENTITY:       'entity',
    DTO:          'dto',
    SERVICE:      'service',
    CONTROLLER:   'controller',
    API_ENDPOINT: 'endpoint',
    DB:           'db',
    TABLE:        'table',
    CUSTOM_TYPE:  'customType',
  }
  return map[nodeType] ?? 'entity'
}

function edgeTypeToRfType(edgeType: string): string {
  const map: Record<string, string> = {
    ROUTES_TO:        'routesTo',
    INVOKES:          'invokes',
    USES:             'uses',
    STORED_IN:        'storedIn',
    CONNECTS_TO:      'connectsTo',
    DERIVED_FROM:     'derivedFrom',
    ACCEPTS:          'accepts',
    RETURNS:          'returns',
    DEPENDS_ON:       'invokes',
    EMBEDS:           'embeds',
    RELATES_TO:       'relatesTo',
    USES_TYPE:        'usesType',
    USES_CUSTOM_TYPE: 'usesCustomType',
    DEFINED_IN:       'derivedFrom',
    SECURES:          'invokes',
  }
  return map[edgeType] ?? 'derivedFrom'
}

function autoPosition(rfNodes: RFNode[], msId: string): { x: number; y: number } {
  const msChildren = rfNodes.filter(n => n.parentId === msId)
  if (msChildren.length === 0) return { x: 100, y: 100 }
  const rightmost = msChildren.reduce((max, n) =>
    (n.position.x + (n.width ?? 200)) > (max.position.x + (max.width ?? 200)) ? n : max,
  )
  return { x: rightmost.position.x + (rightmost.width ?? 200) + 40, y: rightmost.position.y }
}

function callFactory(
  nodeType: string,
  label: string,
  msId: string,
  data: Record<string, unknown>,
  position: { x: number; y: number },
): Record<string, unknown> {
  const base = { label, msId, position, ...data }
  let result: Record<string, unknown>
  switch (nodeType) {
    case 'ENTITY':       result = createEntityNode(base as Parameters<typeof createEntityNode>[0]) as unknown as Record<string, unknown>; break
    case 'DTO':          result = createDTONode(base as Parameters<typeof createDTONode>[0]) as unknown as Record<string, unknown>; break
    case 'SERVICE':      result = createServiceNode(base as Parameters<typeof createServiceNode>[0]) as unknown as Record<string, unknown>; break
    case 'CONTROLLER':   result = createControllerNode(base as Parameters<typeof createControllerNode>[0]) as unknown as Record<string, unknown>; break
    case 'API_ENDPOINT': result = createAPIEndpointNode(base as Parameters<typeof createAPIEndpointNode>[0]) as unknown as Record<string, unknown>; break
    case 'DB':           result = createDBNode(base as Parameters<typeof createDBNode>[0]) as unknown as Record<string, unknown>; break
    case 'TABLE':        result = createTableNode(base as Parameters<typeof createTableNode>[0]) as unknown as Record<string, unknown>; break
    case 'CUSTOM_TYPE':  result = createCustomTypeNode(base as Parameters<typeof createCustomTypeNode>[0]) as unknown as Record<string, unknown>; break
    default:             result = createEntityNode(base as Parameters<typeof createEntityNode>[0]) as unknown as Record<string, unknown>; break
  }
  // Normalize field IDs and constraints — AI often emits duplicates/FK/missing enumValues
  // CustomTypeField uses EnumValues (entity format) same as EntityField — not plain string[]
  if (Array.isArray(result.fields)) {
    const useEntityNormalizer = result.type === NodeType.ENTITY || result.type === NodeType.CUSTOM_TYPE
    result = {
      ...result,
      fields: (result.fields as Record<string, unknown>[]).map(f =>
        useEntityNormalizer ? normalizeEntityField(f) : normalizeGenericField(f)
      ),
    }
  }
  return result
}

function normalizeErrorDefinition(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    id:     generateId(),   // always regenerate — AI often emits duplicate/placeholder IDs
    fields: ((raw.fields as Record<string, unknown>[] | undefined) ?? []),
  }
}

function normalizeEntityField(
  raw: Record<string, unknown>,
  existingId?: string,
): Record<string, unknown> {
  // FK is not a valid user-facing constraint — strip it
  const constraint = raw.constraint === FieldConstraint.FK
    ? FieldConstraint.NONE
    : (raw.constraint ?? FieldConstraint.NONE)
  // ENUM fields must always have an enumValues object
  const enumValues = raw.type === JavaType.ENUM
    ? (raw.enumValues as Record<string, unknown> | null | undefined ?? { values: [], columnDefinition: 'VARCHAR(20)' })
    : null
  return { ...raw, constraint, enumValues, id: existingId ?? generateId() }
}

function normalizeGenericField(
  raw: Record<string, unknown>,
  existingId?: string,
): Record<string, unknown> {
  let enumValues: string[] | null = null
  if (raw.type === JavaType.ENUM) {
    const ev = raw.enumValues
    if (Array.isArray(ev)) {
      enumValues = ev as string[]
    } else if (ev !== null && typeof ev === 'object' && Array.isArray((ev as Record<string, unknown>).values)) {
      // AI sent entity-format { values: [], columnDefinition } — extract the array
      enumValues = (ev as Record<string, unknown>).values as string[]
    } else {
      enumValues = []
    }
  }
  return { ...raw, enumValues, id: existingId ?? generateId() }
}

function normalizeServiceMethod(raw: Record<string, unknown>): Record<string, unknown> {
  const rawReturn = (raw.returnType as Record<string, unknown> | undefined) ?? {}
  // Accept either 'type' (entity field) or 'primitiveType' (old AI output) — store as 'type'
  const returnType = {
    type:              rawReturn.type ?? rawReturn.primitiveType ?? null,
    entityTypeId:      rawReturn.entityTypeId ?? rawReturn.entityId ?? null,
    arraySubType:      rawReturn.arraySubType      ?? null,
    arrayEntityTypeId: rawReturn.arrayEntityTypeId ?? null,
    isList:            rawReturn.isList     ?? false,
    isPage:            rawReturn.isPage     ?? false,
    isOptional:        rawReturn.isOptional ?? false,
    isVoid:            rawReturn.isVoid     ?? false,
  }

  const params = ((raw.params as Record<string, unknown>[] | undefined) ?? []).map(p => ({
    name:              p.name ?? '',
    // Accept either 'type' or 'primitiveType' — store as 'type'
    type:              p.type ?? p.primitiveType ?? JavaType.STRING,
    entityTypeId:      p.entityTypeId ?? p.entityId ?? null,
    customTypeId:      p.customTypeId      ?? null,
    arraySubType:      p.arraySubType      ?? null,
    arrayEntityTypeId: p.arrayEntityTypeId ?? null,
    arrayCustomTypeId: p.arrayCustomTypeId ?? null,
    isPageable:        p.isPageable ?? false,
    enumValues:        p.enumValues ?? null,
  }))

  return {
    id:            raw.id           ?? generateId(),
    name:          raw.name         ?? '',
    returnType,
    params,
    transactional: raw.transactional ?? false,
    async:         raw.async         ?? false,
    aiPrompt:      raw.aiPrompt      ?? emptyAIPrompt(),
    throwsErrors:  raw.throwsErrors  ?? [],
  }
}

export async function executeCanvasActions(params: {
  actions:   CanvasAction[]
  msId:      string
  projectId: string
  rfNodes:   RFNode[]
  setNodes:  (updater: (nodes: RFNode[]) => RFNode[]) => void
  setEdges:  (updater: (edges: RFEdge[]) => RFEdge[]) => void
}): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    createdNodeIds: [],
    createdEdgeIds: [],
    updatedNodeIds: [],
    deletedNodeIds: [],
    errors:         [],
  }
  let currentNodes = [...params.rfNodes]

  for (const action of params.actions) {
    if (action.type === 'CREATE_NODE') {
      const position = autoPosition(currentNodes, params.msId)
      const newNode  = callFactory(action.nodeType, action.label, params.msId, action.data, position) as Record<string, unknown>
      const typedNode = newNode as { id: string; size: { w: number; h: number } }

      const resolvedNodeType = action.nodeType === 'API_ENDPOINT'
        ? NodeType.API_ENDPOINT
        : NodeType[action.nodeType as keyof typeof NodeType]

      await db.nodes.add({
        id:        typedNode.id,
        projectId: params.projectId,
        type:      resolvedNodeType,
        label:     action.label,
        position,
        size:      typedNode.size,
        data:      JSON.stringify(newNode),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const rfType = nodeTypeToRfType(action.nodeType)
      const rfNode: RFNode = {
        id:       typedNode.id,
        type:     rfType as RFNode['type'],
        position,
        data:     newNode,
        width:    typedNode.size.w,
        height:   typedNode.size.h,
        parentId: params.msId,
        extent:   'parent' as const,
      }
      currentNodes = [...currentNodes, rfNode]
      params.setNodes(nodes => [...nodes, rfNode])
      result.createdNodeIds.push(typedNode.id)

    } else if (action.type === 'CREATE_EDGE') {
      const fromNode = findNodeByLabel(currentNodes, action.fromLabel)
      const toNode   = findNodeByLabel(currentNodes, action.toLabel)
      if (!fromNode || !toNode) {
        result.errors.push(`Node not found: ${!fromNode ? action.fromLabel : action.toLabel}`)
        continue
      }

      const edgeId  = generateId()
      const edgeRow = {
        id:         edgeId,
        projectId:  params.projectId,
        fromNodeId: fromNode.id,
        toNodeId:   toNode.id,
        type:       action.edgeType,
        label:      action.edgeType,
        fromHandle: 'right',
        toHandle:   'left',
      }
      await db.edges.add(edgeRow)

      if (action.edgeType === EdgeType.DERIVED_FROM) {
        const dtoNode    = fromNode.data as unknown as DTONode
        const entityNode = toNode.data   as unknown as EntityNode
        const updatedDTO = applyDerivedFromEdge(dtoNode, entityNode)
        await db.nodes.update(fromNode.id, { data: JSON.stringify(updatedDTO), updatedAt: Date.now() })
        currentNodes = currentNodes.map(n =>
          n.id === fromNode.id ? { ...n, data: updatedDTO as unknown as Record<string, unknown> } : n,
        )
        params.setNodes(nodes =>
          nodes.map(n => n.id === fromNode.id ? { ...n, data: updatedDTO as unknown as Record<string, unknown> } : n),
        )
      }
      if (action.edgeType === EdgeType.STORED_IN) {
        const entityNode   = fromNode.data as unknown as EntityNode
        const tableNode    = toNode.data   as unknown as TableNode
        const updatedTable = applyStoredInEdge(entityNode, tableNode)
        await db.nodes.update(toNode.id, { data: JSON.stringify(updatedTable), updatedAt: Date.now() })
        currentNodes = currentNodes.map(n =>
          n.id === toNode.id ? { ...n, data: updatedTable as unknown as Record<string, unknown> } : n,
        )
        params.setNodes(nodes =>
          nodes.map(n => n.id === toNode.id ? { ...n, data: updatedTable as unknown as Record<string, unknown> } : n),
        )
      }
      if (action.edgeType === EdgeType.CONNECTS_TO) {
        const tableNode    = fromNode.data as unknown as TableNode
        const dbNode       = toNode.data   as unknown as DBNode
        const updatedTable = applyConnectsToEdge(tableNode, dbNode)
        await db.nodes.update(fromNode.id, { data: JSON.stringify(updatedTable), updatedAt: Date.now() })
        currentNodes = currentNodes.map(n =>
          n.id === fromNode.id ? { ...n, data: updatedTable as unknown as Record<string, unknown> } : n,
        )
        params.setNodes(nodes =>
          nodes.map(n => n.id === fromNode.id ? { ...n, data: updatedTable as unknown as Record<string, unknown> } : n),
        )
      }
      if (action.edgeType === EdgeType.USES) {
        const serviceNode = fromNode.data as unknown as ServiceNode
        const entityNode  = toNode.data   as unknown as EntityNode
        const updatedSvc  = applyUsesEdge(serviceNode, entityNode)
        await db.nodes.update(fromNode.id, { data: JSON.stringify(updatedSvc), updatedAt: Date.now() })
        currentNodes = currentNodes.map(n =>
          n.id === fromNode.id ? { ...n, data: updatedSvc as unknown as Record<string, unknown> } : n,
        )
        params.setNodes(nodes =>
          nodes.map(n => n.id === fromNode.id ? { ...n, data: updatedSvc as unknown as Record<string, unknown> } : n),
        )
      }

      const rfEdgeType = edgeTypeToRfType(action.edgeType)
      params.setEdges(edges => [
        ...edges,
        {
          id:           edgeId,
          source:       fromNode.id,
          target:       toNode.id,
          type:         rfEdgeType,
          sourceHandle: 'right',
          targetHandle: 'left',
          data:         edgeRow as unknown as Record<string, unknown>,
        },
      ])
      result.createdEdgeIds.push(edgeId)

    } else if (action.type === 'UPDATE_NODE') {
      const node = findNodeByLabel(currentNodes, action.label)
      if (!node) { result.errors.push(`Node not found: ${action.label}`); continue }

      const existingData = node.data as Record<string, unknown>
      let updatedData: Record<string, unknown> = { ...existingData }
      for (const [key, value] of Object.entries(action.patch)) {
        if (key === 'fields' && Array.isArray(value)) {
          const existingFields = Array.isArray(updatedData.fields)
            ? (updatedData.fields as Record<string, unknown>[])
            : []
          // Build a name→id map so we can preserve IDs for fields the AI is editing (not adding)
          const existingIdByName = new Map(existingFields.map(f => [f.name as string, f.id as string]))
          const useEntityNormalizer = (updatedData.type as string) === NodeType.ENTITY || (updatedData.type as string) === NodeType.CUSTOM_TYPE
          const normalized = (value as Record<string, unknown>[]).map(f => {
            const existingId = existingIdByName.get(f.name as string)
            return useEntityNormalizer ? normalizeEntityField(f, existingId) : normalizeGenericField(f, existingId)
          })
          // REPLACE not append — the AI sends the full desired fields list
          updatedData = { ...updatedData, fields: normalized }
        } else if (key === 'methods' && Array.isArray(value)) {
          const existingMethods = Array.isArray(updatedData.methods)
            ? (updatedData.methods as Record<string, unknown>[])
            : []
          // Filter out methods marked for deletion before merging
          const toDelete = new Set(
            (value as Record<string, unknown>[])
              .filter(m => m._delete === true)
              .map(m => m.name as string)
          )
          const afterDeletion = existingMethods.filter(m => !toDelete.has(m.name as string))
          const incomingUpdates = (value as Record<string, unknown>[]).filter(m => !m._delete)
          const existingByName = new Map(afterDeletion.map(m => [m.name as string, m]))
          const normalized = incomingUpdates.map(m => {
            // _from lets the AI rename a method: look up by old name, apply new name
            const lookupName = (m._from as string | undefined) ?? (m.name as string)
            const existing = existingByName.get(lookupName)
            if (!existing) return normalizeServiceMethod(m)

            // Deep-merge returnType: don't overwrite existing non-null values with null
            const existingRT = (existing.returnType as Record<string, unknown>) ?? {}
            const incomingRT = (m.returnType && typeof m.returnType === 'object')
              ? (m.returnType as Record<string, unknown>)
              : {}
            const mergedReturnType: Record<string, unknown> = { ...existingRT }
            for (const [k, v] of Object.entries(incomingRT)) {
              if (v !== null && v !== undefined) mergedReturnType[k] = v
            }

            // Merge params by name: preserve existing param type info when AI sends null
            const existingParams = Array.isArray(existing.params)
              ? (existing.params as Record<string, unknown>[])
              : []
            const incomingParams = Array.isArray(m.params)
              ? (m.params as Record<string, unknown>[])
              : existingParams
            const existingParamByName = new Map(existingParams.map(p => [p.name as string, p]))
            const mergedParams = incomingParams.map(p => {
              const ep = existingParamByName.get(p.name as string)
              if (!ep) return p
              const merged: Record<string, unknown> = { ...ep }
              for (const [k, v] of Object.entries(p)) {
                if (v !== null && v !== undefined) merged[k] = v
              }
              return merged
            })

            const merged = { ...existing, ...m, returnType: mergedReturnType, params: mergedParams }
            return normalizeServiceMethod(merged)
          })
          // Rebuild in original order: replace updated methods in-place, append new ones at end
          // For renames, map by _from (old name) so the slot is found correctly
          const normalizedByOldName = new Map(
            incomingUpdates.map((raw, i) => {
              const oldName = (raw._from as string | undefined) ?? (raw.name as string)
              return [oldName, normalized[i]]
            })
          )
          const inPlace = afterDeletion.map(m => normalizedByOldName.get(m.name as string) ?? m)
          const existingNames = new Set(afterDeletion.map(m => m.name as string))
          const brandNew = normalized.filter((_, i) => {
            const oldName = (incomingUpdates[i]._from as string | undefined) ?? (incomingUpdates[i].name as string)
            return !existingNames.has(oldName)
          })
          updatedData = { ...updatedData, methods: [...inPlace, ...brandNew] }
        } else if (
          (key === 'errorHandlerConfig' || key === 'errorHandling') &&
          typeof value === 'object' && value !== null
        ) {
          const cfg = value as Record<string, unknown>
          const targetKey = 'errorHandlerConfig' in updatedData ? 'errorHandlerConfig' : 'errorHandling'
          const existing  = (updatedData[targetKey] as Record<string, unknown>) ?? {}
          let errors = existing.errors
          if (Array.isArray(cfg.errors)) {
            const existingErrors  = Array.isArray(existing.errors) ? (existing.errors as Record<string, unknown>[]) : []
            const incomingErrors  = (cfg.errors as Record<string, unknown>[]).map(normalizeErrorDefinition)
            const toDeleteErrors  = new Set(incomingErrors.filter(e => e._delete).map(e => e.id as string ?? e.description as string))
            const afterDelErrors  = existingErrors.filter(e => !toDeleteErrors.has((e.id ?? e.description) as string))
            const updatingErrors  = incomingErrors.filter(e => !e._delete)
            const errorByDesc     = new Map(updatingErrors.map(e => [(e.description ?? e.id) as string, e]))
            const inPlaceErrors   = afterDelErrors.map(e => errorByDesc.get((e.description ?? e.id) as string) ?? e)
            const existingDescs   = new Set(afterDelErrors.map(e => (e.description ?? e.id) as string))
            const newErrors       = updatingErrors.filter(e => !existingDescs.has((e.description ?? e.id) as string))
            errors = [...inPlaceErrors, ...newErrors]
          }
          updatedData = { ...updatedData, [targetKey]: { ...existing, ...cfg, errors } }
        } else if (key === 'customQueries' && Array.isArray(value)) {
          const existingQueries = Array.isArray(updatedData.customQueries)
            ? (updatedData.customQueries as Record<string, unknown>[])
            : []
          const toDeleteQ   = new Set((value as Record<string, unknown>[]).filter(q => q._delete).map(q => q.methodName as string))
          const afterDelQ   = existingQueries.filter(q => !toDeleteQ.has(q.methodName as string))
          const incomingQ   = (value as Record<string, unknown>[]).filter(q => !q._delete)
          const existingQByName = new Map(afterDelQ.map(q => [q.methodName as string, q]))
          const normalizedQ = incomingQ.map(q => {
            const existing = existingQByName.get(q.methodName as string)
            const merged   = existing ? { ...existing, ...q } : q
            return { ...merged, id: (merged.id as string | undefined) ?? generateId() } as Record<string, unknown>
          })
          const normalizedQByName = new Map(normalizedQ.map(q => [q.methodName as string, q]))
          const inPlaceQ    = afterDelQ.map(q => normalizedQByName.get(q.methodName as string) ?? q)
          const existingQNames = new Set(afterDelQ.map(q => q.methodName as string))
          const brandNewQ   = normalizedQ.filter(q => !existingQNames.has(q.methodName as string))
          updatedData = { ...updatedData, customQueries: [...inPlaceQ, ...brandNewQ] }
        } else if (
          key === 'config' &&
          typeof value === 'object' && value !== null &&
          typeof updatedData.config === 'object' && updatedData.config !== null
        ) {
          updatedData = {
            ...updatedData,
            config: { ...(updatedData.config as Record<string, unknown>), ...(value as Record<string, unknown>) },
          }
        } else {
          updatedData = { ...updatedData, [key]: value }
        }
      }

      await db.nodes.update(node.id, { data: JSON.stringify(updatedData), updatedAt: Date.now() })
      currentNodes = currentNodes.map(n => n.id === node.id ? { ...n, data: updatedData } : n)
      params.setNodes(nodes => nodes.map(n => n.id === node.id ? { ...n, data: updatedData } : n))
      result.updatedNodeIds.push(node.id)

    } else if (action.type === 'DELETE_NODE') {
      const node = findNodeByLabel(currentNodes, action.label)
      if (!node) { result.errors.push(`Node not found: ${action.label}`); continue }

      await db.nodes.delete(node.id)
      await db.edges.where('fromNodeId').equals(node.id).delete()
      await db.edges.where('toNodeId').equals(node.id).delete()

      currentNodes = currentNodes.filter(n => n.id !== node.id)
      params.setNodes(nodes => nodes.filter(n => n.id !== node.id))
      params.setEdges(edges => edges.filter(e => e.source !== node.id && e.target !== node.id))
      result.deletedNodeIds.push(node.id)

    } else if (action.type === 'ADD_FIELD') {
      const node = findNodeByLabel(currentNodes, action.nodeLabel)
      if (!node) { result.errors.push(`Node not found: ${action.nodeLabel}`); continue }

      const nodeData = node.data as unknown as { fields: unknown[]; type?: string }
      const rawField = {
        nullable:          (action.field['constraint'] as string) !== 'PK',
        columnName:        (action.field['name'] as string) ?? '',
        defaultValue:      '',
        enumValues:        null,
        entityTypeId:      null,
        customTypeId:      null,
        relation:          null,
        entityTypeWarning: false,
        ...action.field,
      }
      const isEntity = (node.data as Record<string, unknown>).type === NodeType.ENTITY
      const newField = isEntity ? normalizeEntityField(rawField) : normalizeGenericField(rawField)
      const updatedFields   = [...nodeData.fields, newField]
      const updatedNodeData = { ...node.data as Record<string, unknown>, fields: updatedFields }

      await db.nodes.update(node.id, { data: JSON.stringify(updatedNodeData), updatedAt: Date.now() })
      currentNodes = currentNodes.map(n => n.id === node.id ? { ...n, data: updatedNodeData } : n)
      params.setNodes(nodes => nodes.map(n => n.id === node.id ? { ...n, data: updatedNodeData } : n))
      result.updatedNodeIds.push(node.id)
    }
  }

  const hasNodeChanges = result.createdNodeIds.length > 0 || result.updatedNodeIds.length > 0 || result.deletedNodeIds.length > 0
  const hasEdgeChanges = result.createdEdgeIds.length > 0

  if (hasNodeChanges || hasEdgeChanges) {
    const bc = new BroadcastChannel('archflow-sync')
    if (hasNodeChanges) {
      bc.postMessage({ type: 'IDB_CHANGED', table: 'nodes', projectId: params.projectId })
    }
    if (hasEdgeChanges) {
      bc.postMessage({ type: 'IDB_CHANGED', table: 'edges', projectId: params.projectId })
    }
    bc.close()
  }

  return result
}
