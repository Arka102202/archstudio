import { db } from '@db'
import { NodeType } from '@entity'
import { formatReturnType } from './format'
import type {
  MicroserviceNode,
  EntityNode,
  DTONode,
  DBNode,
  TableNode,
  ServiceNode,
  ControllerNode,
  APIEndpointNode,
  CustomTypeNode,
  AIPrompt,
} from '@entity'

// Returns true when the user has filled in at least one aiPrompt field
const hasAIPromptContent = (p: AIPrompt | null | undefined): boolean => {
  if (!p) return false
  return !!(p.description || p.businessRules || p.edgeCases || p.expectedBehaviour)
}

const aiPromptOut = (p: AIPrompt | null | undefined): AIPrompt | undefined =>
  hasAIPromptContent(p) ? (p as AIPrompt) : undefined

// ─── Internal types ──────────────────────────────────────────────────────────

interface ParsedNodeEntry {
  id:   string
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any  // deliberately loose — narrowed immediately after via type-check partitioning
}

// ─── Main export function ────────────────────────────────────────────────────

export async function exportArchitecture(
  msId:      string,
  projectId: string,
): Promise<object> {

  // ── Step 1: Fetch the MicroserviceNode itself ──────────────────────────────
  const msRow = await db.nodes.get(msId)
  if (!msRow) {
    console.warn('[archflow] MicroserviceNode not found:', msId)
    return {}
  }
  const ms = JSON.parse(msRow.data) as MicroserviceNode

  // ── Step 2: Fetch all project nodes, filter to this MS's children ──────────
  // msId is stored inside the data blob for Entity, DTO, DB, Table, Service,
  // Controller nodes. We parse all project nodes and keep those whose
  // data.msId matches this microservice. This avoids needing a Dexie index.
  const allProjectNodeRows = await db.nodes
    .where('projectId')
    .equals(projectId)
    .toArray()

  const childNodes: ParsedNodeEntry[] = []

  for (const row of allProjectNodeRows) {
    if (row.id === msId) continue // skip the MS node itself
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(row.data)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (parsed.msId === msId) {
        childNodes.push({ id: row.id, type: row.type, node: parsed })
      }
    } catch {
      // malformed data blob — skip
    }
  }

  // ── Step 3: Partition by node type ─────────────────────────────────────────
  const getAll = <T>(type: string): T[] =>
    childNodes.filter(n => n.type === type).map(n => n.node as T)

  const entities    = getAll<EntityNode>    (NodeType.ENTITY)
  const dtos        = getAll<DTONode>       (NodeType.DTO)
  const tables      = getAll<TableNode>     (NodeType.TABLE)
  const databases   = getAll<DBNode>        (NodeType.DB)
  const services    = getAll<ServiceNode>   (NodeType.SERVICE)
  const controllers = getAll<ControllerNode>(NodeType.CONTROLLER)
  const customTypes = getAll<CustomTypeNode>(NodeType.CUSTOM_TYPE)

  // ── Step 4: Fetch all project edges ───────────────────────────────────────
  const allEdgeRows = await db.edges
    .where('projectId')
    .equals(projectId)
    .toArray()

  // Build a Set of all child node IDs + the MS node itself for fast lookup
  const childIdSet = new Set(childNodes.map(n => n.id))
  childIdSet.add(msId)

  // Filter to edges where at least one end belongs to this MS
  const msEdges = allEdgeRows.filter(e =>
    childIdSet.has(e.fromNodeId) || childIdSet.has(e.toNodeId),
  )

  // ── Step 5: Collect API endpoint nodes via edges ───────────────────────────
  // APIEndpointNode does not store msId in its data — find them via
  // ROUTES_TO edges pointing to controllers that belong to this MS.
  const controllerIdSet = new Set(controllers.map(c => c.id))

  const endpointIds = new Set<string>()
  for (const edge of msEdges) {
    if (edge.type === 'ROUTES_TO' && controllerIdSet.has(edge.toNodeId)) {
      endpointIds.add(edge.fromNodeId)
    }
  }

  const endpointRows = await Promise.all(
    [...endpointIds].map(id => db.nodes.get(id)),
  )
  const endpoints: APIEndpointNode[] = endpointRows
    .filter((r): r is NonNullable<typeof r> => r !== undefined && r !== null)
    .map(r => JSON.parse(r.data) as APIEndpointNode)

  // ── Step 5b: Collect CustomTypeNodes via USES_CUSTOM_TYPE edges ───────────
  // CustomTypeNodes may live outside the MS container (msId === null), so we
  // also collect them via edges from any child node of this MS.
  const customTypeIdsFromEdges = new Set<string>()
  for (const edge of msEdges) {
    if (edge.type === 'USES_CUSTOM_TYPE' && childIdSet.has(edge.fromNodeId)) {
      customTypeIdsFromEdges.add(edge.toNodeId)
    }
  }
  // Remove IDs already covered by msId-based lookup to avoid duplicates
  const knownCustomTypeIds = new Set(customTypes.map(ct => ct.id))
  const extraCustomTypeIds = [...customTypeIdsFromEdges].filter(id => !knownCustomTypeIds.has(id))

  const extraCustomTypeRows = await Promise.all(
    extraCustomTypeIds.map(id => db.nodes.get(id)),
  )
  const extraCustomTypes: CustomTypeNode[] = extraCustomTypeRows
    .filter((r): r is NonNullable<typeof r> => r !== undefined && r !== null)
    .map(r => JSON.parse(r.data) as CustomTypeNode)

  const allCustomTypes = [...customTypes, ...extraCustomTypes]

  // ── Step 6: Build entities output ──────────────────────────────────────────

  // Helpers to resolve ref types to human-readable names in export output
  const resolveType = (
    type:         string,
    entityTypeId: string | null,
    customTypeId: string | null,
  ): string => {
    if (type === 'ENTITY_REF')      return entities.find(en => en.id === entityTypeId)?.label ?? 'EntityRef'
    if (type === 'CUSTOM_TYPE_REF') return allCustomTypes.find(ct => ct.id === customTypeId)?.label ?? 'CustomTypeRef'
    return type
  }

  const resolveSubType = (
    subType:           string | null,
    arrayEntityTypeId: string | null,
    arrayCustomTypeId: string | null,
  ): string | null => {
    if (subType === null) return null
    if (subType === 'ENTITY_REF')      return entities.find(en => en.id === arrayEntityTypeId)?.label ?? 'EntityRef'
    if (subType === 'CUSTOM_TYPE_REF') return allCustomTypes.find(ct => ct.id === arrayCustomTypeId)?.label ?? 'CustomTypeRef'
    return subType
  }

  const entitiesOut = entities.map(e => ({
    id:        e.id,
    label:     e.label,
    tableName: e.tableName,
    ...(aiPromptOut(e.aiPrompt) ? { aiPrompt: aiPromptOut(e.aiPrompt) } : {}),
    fields:    e.fields.map(f => {
      const resolvedSubType = resolveSubType(f.arraySubType, f.arrayEntityTypeId ?? null, f.arrayCustomTypeId ?? null)
      return {
        name:       f.name,
        type:       resolveType(f.type, f.entityTypeId, f.customTypeId),
        ...(f.type === 'ENTITY_REF'      && f.entityTypeId  ? { entityTypeId:  f.entityTypeId }  : {}),
        ...(f.type === 'CUSTOM_TYPE_REF' && f.customTypeId  ? { customTypeId:  f.customTypeId }  : {}),
        ...(resolvedSubType != null ? { arraySubType: resolvedSubType } : {}),
        ...(f.arraySubType === 'ENTITY_REF'      && f.arrayEntityTypeId ? { arrayEntityTypeId: f.arrayEntityTypeId } : {}),
        ...(f.arraySubType === 'CUSTOM_TYPE_REF' && f.arrayCustomTypeId ? { arrayCustomTypeId: f.arrayCustomTypeId } : {}),
        constraint: f.constraint,
        nullable:   f.nullable,
      }
    }),
    config: {
      softDelete:         e.config.softDelete,
      auditing:           e.config.auditing,
      lombokStyle:        e.config.lombokStyle,
      generateRepository: e.config.generateRepository,
    },
  }))

  // ── Step 7: Build DTOs output ──────────────────────────────────────────────
  const dtosOut = dtos.map(d => ({
    id:      d.id,
    label:   d.label,
    purpose: d.purpose,
    origin:  d.origin,
    ...(aiPromptOut(d.aiPrompt) ? { aiPrompt: aiPromptOut(d.aiPrompt) } : {}),
    fields:  d.fields.map(f => {
      const resolvedSubType = resolveSubType(f.arraySubType, f.arrayEntityTypeId ?? null, f.arrayCustomTypeId ?? null)
      return {
        name:        f.name,
        type:        resolveType(f.type, f.entityTypeId, f.customTypeId),
        ...(f.type === 'ENTITY_REF'      && f.entityTypeId  ? { entityTypeId:  f.entityTypeId }  : {}),
        ...(f.type === 'CUSTOM_TYPE_REF' && f.customTypeId  ? { customTypeId:  f.customTypeId }  : {}),
        ...(resolvedSubType != null ? { arraySubType: resolvedSubType } : {}),
        ...(f.arraySubType === 'ENTITY_REF'      && f.arrayEntityTypeId ? { arrayEntityTypeId: f.arrayEntityTypeId } : {}),
        ...(f.arraySubType === 'CUSTOM_TYPE_REF' && f.arrayCustomTypeId ? { arrayCustomTypeId: f.arrayCustomTypeId } : {}),
        validations: f.validations.map(v => ({
          type:    v.type,
          ...(v.value   ? { value:   v.value }   : {}),
          ...(v.message ? { message: v.message } : {}),
        })),
      }
    }),
  }))

  // ── Step 8: Build tables output ────────────────────────────────────────────
  const tablesOut = tables.map(t => ({
    id:        t.id,
    label:     t.label,
    tableName: t.tableName,
    entityId:  t.entityId,
    dbNodeId:  t.dbNodeId,
    ...(aiPromptOut(t.aiPrompt) ? { aiPrompt: aiPromptOut(t.aiPrompt) } : {}),
    customQueries: (t.customQueries ?? []).map(q => ({
      methodName:     q.methodName,
      description:    q.description,
      type:           q.type,
      targetEntityId: q.targetEntityId ?? null,
      queryString:    q.queryString    ?? null,
      nativeQuery:    q.nativeQuery    ?? false,
      modifying:      q.modifying      ?? false,
      ...(aiPromptOut(q.aiPrompt) ? { aiPrompt: aiPromptOut(q.aiPrompt) } : {}),
      params: (q.params ?? []).map(p => ({
        name:         p.name,
        type:         p.type,
        ...(p.type === 'ARRAY' ? { arraySubType: p.arraySubType ?? 'STRING' } : {}),
        isCollection: p.isCollection,
      })),
      returnType: q.returnType ?? null,
      cache:      q.cache      ?? null,
    })),
  }))

  // ── Step 9: Build databases output ────────────────────────────────────────
  const databasesOut = databases.map(d => ({
    id:     d.id,
    label:  d.label,
    dbName: d.dbName,
    dbType: d.dbType,
    host:   d.host,
    port:   d.port,
    schema: d.schema,
    config: d.config,
    ...(aiPromptOut(d.aiPrompt) ? { aiPrompt: aiPromptOut(d.aiPrompt) } : {}),
  }))

  // ── Step 10: Build services output ────────────────────────────────────────
  const servicesOut = services.map(svc => {
    const usesEdge = msEdges.find(e =>
      e.type === 'USES' && e.fromNodeId === svc.id,
    )
    const connectedEntityId = usesEdge?.toNodeId ?? null
    const connectedEntity   = entities.find(en => en.id === connectedEntityId)

    const methods = svc.methods.map(m => {
      const rtArrayEntity = entities.find(en => en.id === m.returnType.arrayEntityTypeId)
      return {
      name:          m.name,
      returns:       formatReturnType(m.returnType, connectedEntity?.label, rtArrayEntity?.label),
      params:        m.params.map(p => ({
        name: p.name,
        type: p.type === 'ENTITY_REF'
          ? (connectedEntity?.label ?? 'Entity')
          : p.type,
        ...(p.arraySubType != null ? { arraySubType: p.arraySubType } : {}),
      })),
      transactional: m.transactional,
      async:         m.async,
      ...(aiPromptOut(m.aiPrompt) ? { aiPrompt: aiPromptOut(m.aiPrompt) } : {}),
    }})

    return {
      id:               svc.id,
      label:            svc.label,
      connectedEntityId,
      ...(aiPromptOut(svc.aiPrompt) ? { aiPrompt: aiPromptOut(svc.aiPrompt) } : {}),
      methods,
      config:           svc.config,
    }
  })

  // ── Step 11: Build controllers + embedded endpoints ───────────────────────
  const embeddedEndpointIds = new Set<string>()

  const controllersOut = controllers.map(ctrl => {
    // Which service does this controller invoke?
    const invokesEdge = msEdges.find(e =>
      e.type === 'INVOKES' && e.fromNodeId === ctrl.id,
    )
    const invokedServiceId = invokesEdge?.toNodeId ?? null

    // Which endpoints route to this controller?
    const routesToEdges = msEdges.filter(e =>
      e.type === 'ROUTES_TO' && e.toNodeId === ctrl.id,
    )
    const routedEndpointIds = routesToEdges.map(e => e.fromNodeId)

    const controllerEndpoints = endpoints.filter(ep =>
      routedEndpointIds.includes(ep.id),
    )
    controllerEndpoints.forEach(ep => embeddedEndpointIds.add(ep.id))

    const endpointsOut = controllerEndpoints.map(ep => ({
      id:          ep.id,
      label:       ep.label,
      method:      ep.method,
      path:        ep.path,
      description: ep.config.description,
      ...(aiPromptOut(ep.aiPrompt) ? { aiPrompt: aiPromptOut(ep.aiPrompt) } : {}),
      request: {
        bodyDTOId:   ep.request.bodyDTOId,
        pathVars:    ep.request.pathVars,
        queryParams: ep.request.queryParams,
      },
      response: {
        returnDTOId: ep.response.returnDTOId,
        successCode: ep.response.successCode,
        isList:      ep.response.isList,
        isPage:      ep.response.isPage,
      },
      authRuleId: ep.authRuleId,
      errorHandling: {
        inheritFromController: ep.errorHandling.inheritFromController,
        errors:                ep.errorHandling.errors,
      },
      config: {
        paginated:  ep.config.paginated,
        deprecated: ep.config.deprecated,
      },
    }))

    return {
      id:              ctrl.id,
      label:           ctrl.label,
      basePath:        ctrl.basePath,
      invokedServiceId,
      ...(aiPromptOut(ctrl.aiPrompt) ? { aiPrompt: aiPromptOut(ctrl.aiPrompt) } : {}),
      authRuleId:      ctrl.authRuleId,
      config:          ctrl.config,
      errorHandling:   ctrl.errorHandlerConfig,
      swaggerTags:     ctrl.swaggerTags,
      endpoints:       endpointsOut,
    }
  })

  // ── Step 12: Orphan endpoints (connected to no controller in this MS) ──────
  const orphanEndpoints = endpoints
    .filter(ep => !embeddedEndpointIds.has(ep.id))
    .map(ep => ({
      id:          ep.id,
      label:       ep.label,
      method:      ep.method,
      path:        ep.path,
      description: ep.config.description,
    }))

  // ── Step 13: Edge summary ─────────────────────────────────────────────────
  const edgesOut = msEdges.map(e => ({
    from: e.fromNodeId,
    to:   e.toNodeId,
    type: e.type,
  }))

  // ── Step 14: MS summary (strip canvas-only fields) ────────────────────────
  const msOut = {
    id:          ms.id,
    label:       ms.label,
    serviceName: ms.serviceName,
    packageName: ms.packageName,
    port:        ms.port,
    version:     ms.version,
    build:       ms.build,
    docker:      ms.docker,
    ...(aiPromptOut(ms.aiPrompt) ? { aiPrompt: aiPromptOut(ms.aiPrompt) } : {}),
  }

  // ── Step 15: Build custom types output ───────────────────────────────────
  const customTypesOut = allCustomTypes.map(ct => ({
    id:     ct.id,
    label:  ct.label,
    ...(aiPromptOut(ct.aiPrompt) ? { aiPrompt: aiPromptOut(ct.aiPrompt) } : {}),
    fields: ct.fields.map(f => ({
      name:     f.name,
      type:     resolveType(f.type, f.entityTypeId, f.customTypeId),
      ...(f.type === 'ENTITY_REF'      && f.entityTypeId ? { entityTypeId: f.entityTypeId } : {}),
      ...(f.type === 'CUSTOM_TYPE_REF' && f.customTypeId ? { customTypeId: f.customTypeId } : {}),
      nullable: f.nullable,
    })),
  }))

  // ── Step 16: Assemble and return ──────────────────────────────────────────
  const result: Record<string, unknown> = {
    microservice: msOut,
    entities:     entitiesOut,
    dtos:         dtosOut,
    customTypes:  customTypesOut,
    tables:       tablesOut,
    databases:    databasesOut,
    services:     servicesOut,
    controllers:  controllersOut,
    edges:        edgesOut,
  }

  if (orphanEndpoints.length > 0) {
    result['orphanEndpoints'] = orphanEndpoints
  }

  return result
}
