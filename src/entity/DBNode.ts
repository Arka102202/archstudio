import type { BaseNode } from './shared'
import { NodeType } from './shared'

export interface DBNode extends BaseNode {
  type:     NodeType.DB
  msId:     string | null   // parent MicroserviceNode.id — drives RF parentId
  dbName:   string
  dbType:   DBType
  host:     string
  port:     number
  schema:   string
  username: string   // env ref e.g. "${DB_USER}"
  password: string   // env ref e.g. "${DB_PASS}"
  config:   DBConfig
}

export enum DBType {
  POSTGRESQL = 'POSTGRESQL',
  MYSQL      = 'MYSQL',
  MONGODB    = 'MONGODB',
  H2         = 'H2',
  MSSQL      = 'MSSQL',
}

export interface DBConfig {
  ddlAuto:  DDLAuto
  showSql:  boolean
  poolSize: number
  flyway:   boolean
  redis:    boolean
}

export enum DDLAuto {
  VALIDATE    = 'validate',
  CREATE_DROP = 'create-drop',
  UPDATE      = 'update',
  NONE        = 'none',
}
