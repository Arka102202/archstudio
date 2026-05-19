import type { BaseNode } from './shared'
import { NodeType } from './shared'

export enum TokenType {
  JWT     = 'JWT',
  OAUTH2  = 'OAUTH2',
  BASIC   = 'BASIC',
  API_KEY = 'API_KEY',
}

export enum UserSourceType {
  INTERNAL_DB      = 'INTERNAL_DB',
  LDAP             = 'LDAP',
  KEYCLOAK         = 'KEYCLOAK',
  AUTH0            = 'AUTH0',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
}

export interface UserSource {
  type: UserSourceType
  ref:  string | null

  // INTERNAL_DB
  userEntity:    string
  usernameField: string
  passwordField: string

  // LDAP
  ldapUrl:         string
  baseDn:          string
  userDnPattern:   string
  groupSearchBase: string

  // KEYCLOAK | AUTH0 | OAUTH2
  issuerUri:    string
  clientId:     string
  clientSecret: string

  // EXTERNAL_SERVICE
  serviceNodeId:   string | null
  rolesEndpoint:   string
  cacheRoles:      boolean
  cacheTtlSeconds: number
}

export interface RoleTransform {
  from: string
  to:   string
}

export interface RoleMapping {
  field:      string
  prefix:     string
  transforms: RoleTransform[]
}

export interface TokenConfig {
  jwtSecret:        string
  jwtExpiry:        number
  jwtIssuer:        string
  oauth2IssuerUri:  string
  oauth2Audience:   string
  apiKeyHeader:     string
  apiKeyQueryParam: string
}

export interface AuthGuardNode extends BaseNode {
  type:        NodeType.AUTH_GUARD
  tokenType:   TokenType
  userSource:  UserSource
  roleMapping: RoleMapping
  tokenConfig: TokenConfig
  appliesTo:   string[]
}
