// Generates .claude/ context files for the exported Spring Boot project.
// Files stay under 40 KB (38,000 chars soft limit); oversized content is split
// into numbered parts: architecture-1.md, architecture-2.md, etc.

const MAX_CHARS = 38_000

// ─── Types (mirrors exportArchitecture output) ────────────────────────────────

interface ArchMs {
  label:       string
  serviceName: string
  packageName: string
  port:        string
  version:     string
  build: {
    tool:              string
    springBootVersion: string
    javaVersion:       string
    extraDependencies?: Array<{ groupId: string; artifactId: string }>
  }
  docker?: { generateDockerfile: boolean; generateDockerCompose: boolean }
  aiPrompt?: { description?: string }
}

interface ArchField {
  name:        string
  type:        string
  constraint?: string
  nullable?:   boolean
  enumValues?: { values: string[] } | null
}

interface ArchEntity {
  id:        string
  label:     string
  tableName: string
  fields:    ArchField[]
  config: {
    softDelete:         boolean
    auditing:           boolean
    lombokStyle:        string
    generateRepository: boolean
  }
  aiPrompt?: { description?: string }
}

interface ArchDTOField {
  name:        string
  type:        string
  validations?: Array<{ type: string; value?: string }>
}

interface ArchDTO {
  id:       string
  label:    string
  purpose:  string
  origin:   string
  fields:   ArchDTOField[]
  aiPrompt?: { description?: string }
}

interface ArchCustomType {
  id:     string
  label:  string
  fields: ArchField[]
}

interface ArchTable {
  id:        string
  label:     string
  tableName: string
  entityId:  string | null
  dbNodeId:  string | null
  customQueries: Array<{ methodName: string; description: string; type: string | null }>
}

interface ArchDB {
  id:     string
  label:  string
  dbName: string
  dbType: string
  host:   string
  port:   number
  schema: string
  config: { ddlAuto: string; showSql: boolean; poolSize: number; flyway: boolean }
}

interface ArchMethodParam { name: string; type: string }
interface ArchMethod {
  name:         string
  returns:      string
  params:       ArchMethodParam[]
  transactional: boolean
  async:        boolean
  aiPrompt?:   { description?: string }
}

interface ArchService {
  id:                string
  label:             string
  connectedEntityId: string | null
  methods:           ArchMethod[]
  config:            { classLevelTransactional: boolean; generateInterface: boolean }
  aiPrompt?:        { description?: string }
}

interface ArchEndpoint {
  id:          string
  label:       string
  method:      string
  path:        string
  description?: string
  request: {
    bodyDTOId:   string | null
    pathVars:    Array<{ name: string; type: string }>
    queryParams: Array<{ name: string; type: string; required: boolean }>
  }
  response: {
    returnDTOId: string | null
    successCode: number
    isList:      boolean
    isPage:      boolean
  }
  config:    { paginated: boolean; deprecated: boolean }
  authRuleId: string | null
  aiPrompt?: { description?: string }
}

interface ArchController {
  id:              string
  label:           string
  basePath:        string
  invokedServiceId: string | null
  authRuleId:      string | null
  endpoints:       ArchEndpoint[]
  config:          { crossOrigin: boolean; requestLogging: boolean }
  aiPrompt?:      { description?: string }
}

interface ArchExport {
  microservice: ArchMs
  entities:     ArchEntity[]
  dtos:         ArchDTO[]
  customTypes:  ArchCustomType[]
  tables:       ArchTable[]
  databases:    ArchDB[]
  services:     ArchService[]
  controllers:  ArchController[]
  edges:        Array<{ from: string; to: string; type: string }>
}

// ─── Chunking helpers ─────────────────────────────────────────────────────────

function nameChunks(chunks: string[], base: string): Record<string, string> {
  if (chunks.length === 0) return {}
  if (chunks.length === 1) return { [`.claude/${base}.md`]: chunks[0] }
  return Object.fromEntries(chunks.map((c, i) => [`.claude/${base}-${i + 1}.md`, c]))
}

function chunkSections(
  intro:    string,
  sections: Array<{ heading: string; body: string }>,
): string[] {
  const chunks: string[] = []
  let current = intro

  for (const { heading, body } of sections) {
    const block = `## ${heading}\n\n${body}\n`
    if (current.length + block.length > MAX_CHARS && current !== intro) {
      chunks.push(current.trimEnd())
      current = ''
    }
    current += block
  }

  const trimmed = current.trimEnd()
  if (trimmed.length > 0) chunks.push(trimmed)
  return chunks
}

// ─── Field table helpers ──────────────────────────────────────────────────────

function fieldTable(fields: ArchField[]): string {
  if (fields.length === 0) return '_No fields_\n'
  const rows = fields.map(f => {
    const constraint = f.constraint && f.constraint !== 'NONE' ? f.constraint : ''
    const nullable   = f.nullable === false ? 'NOT NULL' : ''
    const flags      = [constraint, nullable].filter(Boolean).join(', ')
    const typeStr    = f.enumValues?.values.length
      ? `ENUM(${f.enumValues.values.join('|')})`
      : f.type
    return `| ${f.name} | ${typeStr} | ${flags} |`
  })
  return [
    '| Field | Type | Constraints |',
    '|-------|------|-------------|',
    ...rows,
  ].join('\n') + '\n'
}

function dtoFieldTable(fields: ArchDTOField[]): string {
  if (fields.length === 0) return '_No fields_\n'
  const rows = fields.map(f => {
    const validations = f.validations?.map(v => `@${v.type}${v.value ? `(${v.value})` : ''}`).join(' ') ?? ''
    return `| ${f.name} | ${f.type} | ${validations} |`
  })
  return [
    '| Field | Type | Validations |',
    '|-------|------|-------------|',
    ...rows,
  ].join('\n') + '\n'
}

// ─── ID → label lookup ────────────────────────────────────────────────────────

function makeIdMap(items: Array<{ id: string; label: string }>): Map<string, string> {
  return new Map(items.map(x => [x.id, x.label]))
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildOverview(a: ArchExport, generatedFiles: Record<string, string>): string {
  const ms    = a.microservice
  const dbTypes = [...new Set((a.databases ?? []).map(d => d.dbType))].join(', ') || 'none configured'
  const deps  = ms.build.extraDependencies?.map(d => `  - ${d.groupId}:${d.artifactId}`).join('\n') ?? ''

  const summary = [
    ms.aiPrompt?.description,
  ].filter(Boolean).join(' ')

  const conventions: string[] = [
    'Dates serialize as ISO-8601 strings (Jackson `write-dates-as-timestamps: false`)',
    'Repository layer: `JpaRepository<Entity, UUID>` + custom `@Query` methods where needed',
    'DTOs are separate from entities — never expose JPA entities in HTTP responses',
    'Validation: `@Valid` on controller request bodies; bean validation annotations on DTO fields',
  ]

  const lombokStyles = [...new Set((a.entities ?? []).map(e => e.config.lombokStyle))]
  if (lombokStyles.length > 0) conventions.push(`Lombok: ${lombokStyles.join('/')} on entities`)

  const hasAudit = (a.entities ?? []).some(e => e.config.auditing)
  if (hasAudit) conventions.push('Auditing: `@CreatedDate` / `@LastModifiedDate` managed by Spring Data JPA')

  const hasSoftDelete = (a.entities ?? []).some(e => e.config.softDelete)
  if (hasSoftDelete) conventions.push('Soft delete: `@SQLRestriction("deleted_at IS NULL")` on applicable entities')

  const archFiles: string[] = ['.claude/architecture.md — complete architecture (entities, DTOs, services, controllers, APIs, databases)']
  const fileCount = Object.keys(generatedFiles).length
  if (fileCount > 0) archFiles.push('.claude/generated-files.md — index of all generated source files')

  return [
    `# ${ms.serviceName} — Claude Context`,
    '',
    '## Overview',
    `- **Service**: ${ms.serviceName}`,
    `- **Package**: ${ms.packageName}`,
    `- **Port**: ${ms.port}`,
    `- **Version**: ${ms.version}`,
    `- **Build**: ${ms.build.tool} · Spring Boot ${ms.build.springBootVersion} · Java ${ms.build.javaVersion}`,
    `- **Database**: ${dbTypes}`,
    ms.docker?.generateDockerfile ? '- **Docker**: Dockerfile + docker-compose included' : '',
    '',
    ...(summary ? ['## Purpose', summary, ''] : []),
    '## Tech Stack',
    `- Spring Boot ${ms.build.springBootVersion} (Java ${ms.build.javaVersion})`,
    `- Database: ${dbTypes} via Spring Data JPA / Hibernate`,
    `- Build: ${ms.build.tool}`,
    '- Lombok for boilerplate reduction',
    '- Jackson for JSON (ISO-8601 date serialization)',
    '- Spring Validation (@Valid / bean validation)',
    ...(deps ? [`- Extra dependencies:\n${deps}`] : []),
    '',
    '## Conventions',
    ...conventions.map(c => `- ${c}`),
    '',
    '## Context Files',
    ...archFiles.map(f => `- \`${f}\``),
  ].filter(l => l !== null).join('\n')
}

function buildArchSections(a: ArchExport): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = []

  const entityMap  = makeIdMap(a.entities  ?? [])
  const dtoMap     = makeIdMap(a.dtos      ?? [])
  const serviceMap = makeIdMap(a.services  ?? [])
  const dbMap      = makeIdMap(a.databases ?? [])

  // Microservice
  const ms = a.microservice
  sections.push({
    heading: 'Microservice',
    body: [
      `- **serviceName**: ${ms.serviceName}`,
      `- **packageName**: ${ms.packageName}`,
      `- **port**: ${ms.port}`,
      `- **version**: ${ms.version}`,
      `- **build**: ${ms.build.tool}, Spring Boot ${ms.build.springBootVersion}, Java ${ms.build.javaVersion}`,
    ].join('\n') + '\n',
  })

  // Entities
  for (const e of (a.entities ?? [])) {
    const configLines = [
      e.config.softDelete         ? 'soft-delete' : '',
      e.config.auditing           ? 'auditing'    : '',
      e.config.generateRepository ? 'repository'  : '',
      `Lombok: ${e.config.lombokStyle}`,
    ].filter(Boolean).join(' · ')

    sections.push({
      heading: `Entity: ${e.label}`,
      body: [
        `**Table**: \`${e.tableName}\`  **Config**: ${configLines}`,
        ...(e.aiPrompt?.description ? [`> ${e.aiPrompt.description}`] : []),
        '',
        fieldTable(e.fields),
      ].join('\n'),
    })
  }

  // DTOs
  for (const d of (a.dtos ?? [])) {
    sections.push({
      heading: `DTO: ${d.label}`,
      body: [
        `**Purpose**: ${d.purpose}  **Origin**: ${d.origin}`,
        ...(d.aiPrompt?.description ? [`> ${d.aiPrompt.description}`] : []),
        '',
        dtoFieldTable(d.fields),
      ].join('\n'),
    })
  }

  // Custom Types
  if ((a.customTypes ?? []).length > 0) {
    for (const ct of a.customTypes) {
      sections.push({
        heading: `Custom Type: ${ct.label}`,
        body: fieldTable(ct.fields),
      })
    }
  }

  // Services
  for (const svc of (a.services ?? [])) {
    const entityLabel = svc.connectedEntityId ? (entityMap.get(svc.connectedEntityId) ?? svc.connectedEntityId) : null
    const methodLines = svc.methods.map(m => {
      const params = m.params.map(p => `${p.type} ${p.name}`).join(', ')
      const flags  = [m.transactional ? '@Transactional' : '', m.async ? '@Async' : ''].filter(Boolean).join(' ')
      const note   = m.aiPrompt?.description ? ` — ${m.aiPrompt.description}` : ''
      return `- \`${m.returns} ${m.name}(${params})\`${flags ? ` ${flags}` : ''}${note}`
    })

    sections.push({
      heading: `Service: ${svc.label}`,
      body: [
        ...(entityLabel     ? [`**Entity**: ${entityLabel}`] : []),
        ...(svc.config.generateInterface ? ['**Interface**: yes'] : []),
        ...(svc.aiPrompt?.description ? [`> ${svc.aiPrompt.description}`] : []),
        '',
        ...(methodLines.length > 0 ? ['**Methods**:', ...methodLines] : ['_No methods_']),
      ].join('\n') + '\n',
    })
  }

  // Controllers + Endpoints
  for (const ctrl of (a.controllers ?? [])) {
    const serviceName  = ctrl.invokedServiceId ? (serviceMap.get(ctrl.invokedServiceId) ?? ctrl.invokedServiceId) : null
    const endpointLines: string[] = []

    for (const ep of ctrl.endpoints) {
      const bodyDTO    = ep.request.bodyDTOId   ? (dtoMap.get(ep.request.bodyDTOId)   ?? ep.request.bodyDTOId)   : null
      const returnDTO  = ep.response.returnDTOId ? (dtoMap.get(ep.response.returnDTOId) ?? ep.response.returnDTOId) : null
      const pathVars   = ep.request.pathVars.map(p => `{${p.name}: ${p.type}}`).join(', ')
      const queryParam = ep.request.queryParams.map(q => `${q.name}${q.required ? '' : '?'}: ${q.type}`).join(', ')
      const deprecated = ep.config.deprecated ? ' ⚠️ deprecated' : ''
      const desc       = ep.description ?? ep.label

      endpointLines.push(`#### \`${ep.method} ${ep.path}\` → ${ep.response.successCode}${deprecated}`)
      if (desc) endpointLines.push(`> ${desc}`)
      if (bodyDTO)   endpointLines.push(`- **Body**: ${bodyDTO}`)
      if (pathVars)  endpointLines.push(`- **Path vars**: ${pathVars}`)
      if (queryParam) endpointLines.push(`- **Query**: ${queryParam}`)
      const returnLabel = returnDTO ? `${returnDTO}${ep.response.isList ? '[]' : ''}${ep.response.isPage ? ' (Page)' : ''}` : ''
      if (returnLabel) endpointLines.push(`- **Returns**: ${returnLabel}`)
      if (ep.config.paginated) endpointLines.push('- **Paginated**: yes')
      endpointLines.push('')
    }

    sections.push({
      heading: `Controller: ${ctrl.label}`,
      body: [
        `**basePath**: \`${ctrl.basePath}\``,
        ...(serviceName ? [`**Service**: ${serviceName}`] : []),
        ...(ctrl.config.crossOrigin ? ['**CORS**: enabled'] : []),
        ...(ctrl.aiPrompt?.description ? [`> ${ctrl.aiPrompt.description}`] : []),
        '',
        ...(endpointLines.length > 0 ? ['**Endpoints**:', ...endpointLines] : ['_No endpoints_']),
      ].join('\n'),
    })
  }

  // Databases
  for (const db of (a.databases ?? [])) {
    sections.push({
      heading: `Database: ${db.label}`,
      body: [
        `- **Type**: ${db.dbType}`,
        `- **Name**: ${db.dbName}`,
        `- **Host**: ${db.host}:${db.port}`,
        `- **Schema**: ${db.schema}`,
        `- **DDL auto**: ${db.config.ddlAuto}`,
        db.config.flyway    ? '- **Flyway**: enabled' : '',
        db.config.showSql   ? '- **Show SQL**: yes'   : '',
        `- **Pool size**: ${db.config.poolSize}`,
      ].filter(Boolean).join('\n') + '\n',
    })
  }

  // Tables with custom queries
  for (const t of (a.tables ?? [])) {
    const entityLabel = t.entityId ? (entityMap.get(t.entityId) ?? t.entityId) : 'none'
    const dbLabel     = t.dbNodeId ? (dbMap.get(t.dbNodeId)     ?? t.dbNodeId) : 'none'
    const queryLines  = (t.customQueries ?? []).map(q =>
      `- \`${q.methodName}\` (${q.type ?? 'DERIVED'}) — ${q.description}`,
    )

    sections.push({
      heading: `Table: ${t.tableName}`,
      body: [
        `- **Entity**: ${entityLabel}`,
        `- **Database**: ${dbLabel}`,
        ...(queryLines.length > 0 ? ['', '**Custom queries**:', ...queryLines] : []),
      ].join('\n') + '\n',
    })
  }

  return sections
}

function buildFilesIndex(generatedFiles: Record<string, string>): string {
  const inferDesc = (path: string): string => {
    const name = path.split('/').pop() ?? path
    if (/Application\.java$/.test(name))  return 'Spring Boot application entry point'
    if (/Exception\.java$/.test(name))    return 'Custom exception class'
    if (/Handler\.java$/.test(name))      return 'Exception / event handler'
    if (/Controller\.java$/.test(name))   return 'REST controller'
    if (/Service\.java$/.test(name))      return 'Service layer'
    if (/Repository\.java$/.test(name))   return 'JPA repository'
    if (/Entity\.java$/.test(name) || /\/entity\//.test(path)) return 'JPA entity'
    if (/Request\.java$/.test(name))      return 'Request DTO'
    if (/Response\.java$/.test(name))     return 'Response DTO'
    if (/Dto\.java$/.test(name) || /\/dto\//.test(path))       return 'Data transfer object'
    if (/Config\.java$/.test(name) || /\/config\//.test(path)) return 'Configuration class'
    if (/Filter\.java$/.test(name))       return 'Servlet filter'
    if (/Interceptor\.java$/.test(name))  return 'Request interceptor'
    if (/\.java$/.test(name))             return 'Java class'
    if (/application\.yml$/.test(name) || /application\.properties$/.test(name)) return 'Spring Boot configuration'
    if (/pom\.xml$/.test(name))           return 'Maven build configuration'
    if (/build\.gradle/.test(name))       return 'Gradle build configuration'
    if (/Dockerfile/.test(name))          return 'Docker image definition'
    if (/docker-compose/.test(name))      return 'Docker Compose stack'
    if (/\.sql$/.test(name))              return 'SQL migration script'
    if (/\.md$/.test(name))               return 'Documentation'
    return 'Generated file'
  }

  const lines: string[] = []
  const sorted = Object.keys(generatedFiles).sort()

  let lastDir = ''
  for (const path of sorted) {
    const parts = path.split('/')
    const dir   = parts.slice(0, -1).join('/')
    if (dir !== lastDir) {
      if (lastDir !== '') lines.push('')
      lines.push(`### ${dir || '/'}`)
      lastDir = dir
    }
    lines.push(`- \`${parts.pop()}\` — ${inferDesc(path)}`)
  }

  return lines.join('\n')
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateClaudeContext(params: {
  arch:           object
  generatedFiles: Record<string, string>
}): Record<string, string> {
  const a = params.arch as ArchExport
  if (!a.microservice) return {}

  const output: Record<string, string> = {}

  // 1. CLAUDE.md (overview, always single file)
  output['.claude/CLAUDE.md'] = buildOverview(a, params.generatedFiles)

  // 2. architecture.md (possibly chunked)
  const archIntro = `# ${a.microservice.serviceName} — Architecture\n\n`
  const archSections = buildArchSections(a)
  const archChunks = chunkSections(archIntro, archSections)
  Object.assign(output, nameChunks(archChunks, 'architecture'))

  // 3. generated-files.md (possibly chunked)
  const fileCount = Object.keys(params.generatedFiles).length
  if (fileCount > 0) {
    const filesIntro = `# ${a.microservice.serviceName} — Generated Files\n\nTotal: ${fileCount} file${fileCount !== 1 ? 's' : ''}\n\n`
    const filesBody  = buildFilesIndex(params.generatedFiles)
    // Split filesBody into sections by directory heading
    const dirSections: Array<{ heading: string; body: string }> = []
    let currentHeading = ''
    let currentBody    = ''
    for (const line of filesBody.split('\n')) {
      if (line.startsWith('### ')) {
        if (currentHeading) dirSections.push({ heading: currentHeading, body: currentBody.trim() + '\n' })
        currentHeading = line.slice(4)
        currentBody    = ''
      } else {
        currentBody += line + '\n'
      }
    }
    if (currentHeading) dirSections.push({ heading: currentHeading, body: currentBody.trim() + '\n' })

    const filesChunks = dirSections.length > 0
      ? chunkSections(filesIntro, dirSections)
      : [filesIntro + filesBody]

    Object.assign(output, nameChunks(filesChunks, 'generated-files'))
  }

  return output
}
