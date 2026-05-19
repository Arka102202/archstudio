import type { BaseNode } from './shared'
import type { NodeType } from './shared'

// ─── BuildTool ────────────────────────────────────────────────────

export enum BuildTool {
  MAVEN  = 'MAVEN',
  GRADLE = 'GRADLE',
}

// ─── Build sub-types ──────────────────────────────────────────────

export interface Dependency {
  groupId:    string
  artifactId: string
  version:    string
  scope:      'compile' | 'runtime' | 'test' | null
}

export interface BuildConfig {
  tool:              BuildTool
  springBootVersion: string
  javaVersion:       '17' | '21'
  extraDependencies: Dependency[]
}

export interface DockerConfig {
  generateDockerfile:    boolean
  generateDockerCompose: boolean
  baseImage:             string
}

// ─── MicroserviceNode ─────────────────────────────────────────────

export interface MicroserviceNode extends BaseNode {
  type:        NodeType.MICROSERVICE
  serviceName: string
  packageName: string
  port:        string
  version:     string
  build:       BuildConfig
  docker:      DockerConfig
  colorIdx:    number
}
