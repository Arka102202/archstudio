# Spring Boot Directory Structure

> This file is injected into the user message of every generation request.
> It is the single source of truth for file placement.
> To switch stacks, replace this file only — no prompt changes needed.

---

```
{serviceName}/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── {packagePath}/
│   │   │       │
│   │   │       ├── {ServiceName}Application.java
│   │   │       │
│   │   │       ├── config/
│   │   │       │   ├── ApplicationConfig.java
│   │   │       │   ├── SecurityConfig.java          ← only if AuthGuard node exists in JSON
│   │   │       │   └── OpenApiConfig.java
│   │   │       │
│   │   │       ├── entity/
│   │   │       │   └── {EntityName}.java            ← one per entity in JSON
│   │   │       │
│   │   │       ├── customtype/
│   │   │       │   └── {CustomTypeName}.java        ← one per customType in JSON
│   │   │       │                                       stored as JSON column, no @Entity
│   │   │       │
│   │   │       ├── repository/
│   │   │       │   ├── {EntityName}Repository.java  ← only if generateRepository=true
│   │   │       │   ├── {EntityName}Utils.java       ← only if shared query logic exists
│   │   │       │   └── custom/                      ← only if entity has customQueries
│   │   │       │       ├── {EntityName}RepositoryCustom.java
│   │   │       │       └── impl/
│   │   │       │           └── {EntityName}RepositoryImpl.java
│   │   │       │
│   │   │       ├── dto/
│   │   │       │   ├── request/
│   │   │       │   │   └── {DtoName}.java           ← DTOs where purpose=REQUEST or BOTH
│   │   │       │   └── response/
│   │   │       │       └── {DtoName}.java           ← DTOs where purpose=RESPONSE or BOTH
│   │   │       │
│   │   │       ├── mapper/
│   │   │       │   ├── {EntityName}Mapper.java      ← one per entity that has a DTO
│   │   │       │   └── MapperUtils.java             ← only if shared mapping logic exists
│   │   │       │
│   │   │       ├── service/
│   │   │       │   ├── {ServiceName}.java           ← only if generateInterface=true
│   │   │       │   └── impl/
│   │   │       │       └── {ServiceName}Impl.java   ← always generated
│   │   │       │
│   │   │       ├── controller/
│   │   │       │   └── {ControllerName}.java        ← one per controller in JSON
│   │   │       │
│   │   │       └── exception/
│   │   │           ├── GlobalExceptionHandler.java
│   │   │           ├── ErrorResponse.java
│   │   │           └── {ExceptionName}.java         ← one per error definition in JSON
│   │   │
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       └── application-prod.yml
│   │
│   └── test/
│       └── java/
│           └── {packagePath}/
│               ├── service/
│               │   └── {ServiceName}Test.java
│               └── controller/
│                   └── {ControllerName}Test.java
│
├── pom.xml                                          ← if build.tool=MAVEN
├── build.gradle                                     ← if build.tool=GRADLE
├── Dockerfile                                       ← if docker.generateDockerfile=true
├── docker-compose.yml                               ← if docker.generateDockerCompose=true
└── .gitignore
```

---

## File Generation Rules

### `{ServiceName}Application.java`
Always. One per microservice. `@SpringBootApplication` + `main()`.

### `config/`
- `ApplicationConfig.java` — always
- `SecurityConfig.java` — only if the JSON contains an AuthGuard node
- `OpenApiConfig.java` — always

### `entity/`
One file per entry in `architecture.entities[]`.
Use exact field names, types, constraints from the JSON. Nothing extra.

### `customtype/`
One file per entry in `architecture.customTypes[]`.
These are plain Java classes (no `@Entity`, no `@Table`).
Annotated with `@Embeddable` or serialised as JSON column using `@Convert`.
No repository. No service. No controller. Used only as field types inside entities and DTOs.

### `repository/`
One `{EntityName}Repository.java` per entity where `entity.config.generateRepository = true`.
`{EntityName}Utils.java` — only if shared logic exists across multiple custom query methods.
`custom/` subfolder — only if the entity's linked TableNode has entries in `customQueries[]`.
  - `{EntityName}RepositoryCustom.java` — interface declaring all complex query method signatures
  - `custom/impl/{EntityName}RepositoryImpl.java` — full implementation of all complex queries

### `dto/`
Placement based on `dto.purpose`:
- `REQUEST` → `dto/request/`
- `RESPONSE` → `dto/response/`
- `BOTH` → generate in both `dto/request/` and `dto/response/`
Use exact fields from `dto.fields[]`.

### `mapper/`
One `{EntityName}Mapper.java` per entity that has at least one DTO in the JSON.
`MapperUtils.java` — only if conversion logic is shared across multiple mappers.

### `service/`
One entry per service in `architecture.services[]`.
- Interface `{ServiceName}.java` — only if `service.config.generateInterface = true`
- `impl/{ServiceName}Impl.java` — always
Methods derived exactly from `service.methods[]`. No extra methods.

### `controller/`
One file per controller in `architecture.controllers[]`.
Base path from `controller.basePath`.
Endpoints from `controller.endpoints[]` only.

### `exception/`
- `GlobalExceptionHandler.java` — always, handles all errors from the JSON
- `ErrorResponse.java` — always, standard error response shape
- One `{ExceptionName}.java` per unique error definition across all nodes

### `resources/`
- `application.yml` — always, port from `microservice.port`, DB config from DBNode
- `application-dev.yml` — always
- `application-prod.yml` — always

### `test/`
One test file per service, one per controller.
