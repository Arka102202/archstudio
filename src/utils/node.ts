import { NodeType, LombokStyle, JavaType, HttpMethod } from '@entity/shared'
import { BuildTool } from '@entity/MicroserviceNode'
import { FieldConstraint } from '@entity/EntityNode'
import { DTOPurpose, DTOOrigin } from '@entity/DTONode'
import { DBType, DDLAuto } from '@entity/DBNode'
import { emptyAIPrompt } from '@entity/AIPrompt'
import { generateId } from './id'
import type { MicroserviceNode } from '@entity/MicroserviceNode'
import type { EntityNode } from '@entity/EntityNode'
import type { DTONode } from '@entity/DTONode'
import type { DBNode } from '@entity/DBNode'
import type { TableNode } from '@entity/TableNode'
import type { ServiceNode } from '@entity/ServiceNode'
import type { ControllerNode } from '@entity/ControllerNode'
import type { APIEndpointNode } from '@entity/APIEndpointNode'
import type { CustomTypeNode } from '@entity/CustomTypeNode'

// ─── Safe MS placement ────────────────────────────────────────────
// Returns a canvas position for a new MicroserviceNode that does not
// overlap any existing MS node. Places it below all existing nodes.

interface RfNodeBound {
  position: { x: number; y: number }
  width?:   number
  height?:  number
}

export function findSafeMsPosition(
  existingMsNodes: RfNodeBound[],
): { x: number; y: number } {
  if (existingMsNodes.length === 0) return { x: 100, y: 100 }

  const GAP = 80
  let maxBottom = -Infinity
  let minLeft   =  Infinity

  for (const n of existingMsNodes) {
    const h      = n.height ?? 400
    const bottom = n.position.y + h
    if (bottom  > maxBottom) maxBottom = bottom
    if (n.position.x < minLeft)  minLeft   = n.position.x
  }

  return {
    x: minLeft   === Infinity  ? 100 : minLeft,
    y: maxBottom === -Infinity ? 100 : maxBottom + GAP,
  }
}

// ─── MicroserviceNode factory ─────────────────────────────────────

export const createMicroserviceNode = (
  overrides?: Partial<MicroserviceNode>,
): MicroserviceNode => ({
  id:          generateId(),
  type:        NodeType.MICROSERVICE,
  label:       'New Service',
  serviceName: 'new-service',
  packageName: 'com.example.newservice',
  port:        '8080',
  version:     '1.0.0',
  colorIdx:    0,
  position:    { x: 0, y: 0 },
  size:        { w: 600, h: 400 },
  aiPrompt:    emptyAIPrompt(),
  build: {
    tool:              BuildTool.MAVEN,
    springBootVersion: '3.2.0',
    javaVersion:       '17',
    extraDependencies: [],
  },
  docker: {
    generateDockerfile:    true,
    generateDockerCompose: false,
    baseImage:             'eclipse-temurin:17-jre-alpine',
  },
  ...overrides,
})

// ─── EntityNode factory ───────────────────────────────────────────

export const createEntityNode = (
  overrides?: Partial<EntityNode>,
): EntityNode => ({
  id:        generateId(),
  type:      NodeType.ENTITY,
  msId:      null,
  label:     'Entity',
  tableName: 'entities',
  position:  { x: 0, y: 0 },
  size:      { w: 240, h: 180 },
  aiPrompt:  emptyAIPrompt(),
  fields: [
    {
      id:                generateId(),
      name:              'id',
      type:              JavaType.UUID,
      arraySubType:      null,
      arrayEntityTypeId: null,
      arrayCustomTypeId: null,
      entityTypeId:      null,
      customTypeId:      null,
      relation:          null,
      constraint:        FieldConstraint.PK,
      nullable:          false,
      columnName:        'id',
      defaultValue:      '',
      enumValues:        null,
      entityTypeWarning: false,
    },
  ],
  relations: [],
  config: {
    softDelete:         false,
    auditing:           true,
    lombokStyle:        LombokStyle.BOTH,
    generateRepository: true,
  },
  ...overrides,
})

// ─── DTONode factory ──────────────────────────────────────────────

export const createDTONode = (
  overrides?: Partial<DTONode>,
): DTONode => ({
  id:            generateId(),
  type:          NodeType.DTO,
  msId:          null,
  label:         'DTO',
  purpose:       DTOPurpose.RESPONSE,
  origin:        DTOOrigin.CUSTOM,
  entitySources: [],
  fields:        [],
  position:      { x: 0, y: 0 },
  size:          { w: 210, h: 140 },
  aiPrompt:      emptyAIPrompt(),
  config: {
    lombokStyle:       LombokStyle.BOTH,
    validationEnabled: false,
  },
  ...overrides,
})

// ─── DBNode factory ───────────────────────────────────────────────

export const createDBNode = (
  overrides?: Partial<DBNode>,
): DBNode => ({
  id:       generateId(),
  type:     NodeType.DB,
  msId:     null,
  label:    'Database',
  dbName:   'app_db',
  dbType:   DBType.POSTGRESQL,
  host:     'localhost',
  port:     5432,
  schema:   'public',
  username: '${DB_USER}',
  password: '${DB_PASS}',
  position: { x: 0, y: 0 },
  size:     { w: 220, h: 160 },
  aiPrompt: emptyAIPrompt(),
  config: {
    ddlAuto:  DDLAuto.VALIDATE,
    showSql:  false,
    poolSize: 10,
    flyway:   true,
    redis:    false,
  },
  ...overrides,
})

// ─── ServiceNode factory ──────────────────────────────────────────

export const createServiceNode = (
  overrides?: Partial<ServiceNode>,
): ServiceNode => ({
  id:            generateId(),
  type:          NodeType.SERVICE,
  msId:          null,
  label:         'Service',
  methods:       [],
  dependencyIds: [],
  position:      { x: 0, y: 0 },
  size:          { w: 220, h: 100 },
  aiPrompt:      emptyAIPrompt(),
  config: {
    classLevelTransactional: true,
    classLevelAsync:         false,
    generateInterface:       true,
  },
  ...overrides,
})

// ─── ControllerNode factory ───────────────────────────────────────

export const createControllerNode = (
  overrides?: Partial<ControllerNode>,
): ControllerNode => ({
  id:       generateId(),
  type:     NodeType.CONTROLLER,
  msId:     null,
  label:    'Controller',
  basePath: '/api/resource',
  position: { x: 0, y: 0 },
  size:     { w: 220, h: 100 },
  aiPrompt:    emptyAIPrompt(),
  swaggerTags: [],
  authRuleId:  null,
  errorHandlerConfig: {
    errors:             [],
    includeTimestamp:   true,
    includeRequestPath: true,
  },
  config: {
    crossOrigin:    false,
    apiVersion:     null,
    requestLogging: false,
  },
  ...overrides,
})

// ─── APIEndpointNode factory ──────────────────────────────────────

export const createAPIEndpointNode = (
  overrides?: Partial<APIEndpointNode>,
): APIEndpointNode => ({
  id:       generateId(),
  type:     NodeType.API_ENDPOINT,
  msId:     null,
  label:    'GET /',
  method:   HttpMethod.GET,
  path:     '/',
  position: { x: 0, y: 0 },
  size:     { w: 230, h: 120 },
  aiPrompt:   emptyAIPrompt(),
  authRuleId: null,
  config: {
    paginated:   false,
    deprecated:  false,
    description: '',
  },
  request: {
    pathVars:    [],
    queryParams: [],
    bodyDTOId:   null,
  },
  response: {
    successCode: 200,
    returnDTOId: null,
    isList:      false,
    isPage:      false,
  },
  errorHandling: {
    inheritFromController: true,
    errors:                [],
  },
  ...overrides,
})

// ─── TableNode factory ────────────────────────────────────────────

export const createTableNode = (
  overrides?: Partial<TableNode>,
): TableNode => ({
  id:            generateId(),
  type:          NodeType.TABLE,
  label:         'Table',
  tableName:     'table_name',
  msId:          null,
  entityId:      null,
  dbNodeId:      null,
  position:      { x: 0, y: 0 },
  size:          { w: 220, h: 160 },
  aiPrompt:      emptyAIPrompt(),
  customQueries: [],
  ...overrides,
})

// ─── CustomTypeNode factory ───────────────────────────────────────

export const createCustomTypeNode = (
  overrides?: Partial<CustomTypeNode>,
): CustomTypeNode => ({
  id:       generateId(),
  type:     NodeType.CUSTOM_TYPE,
  label:    'CustomType',
  msId:     null,
  fields:   [],
  position: { x: 0, y: 0 },
  size:     { w: 210, h: 130 },
  aiPrompt: emptyAIPrompt(),
  ...overrides,
})
