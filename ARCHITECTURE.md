# MCP Mermaid ER Server - Architecture Documentation

> **Complete end-to-end architecture overview** of the Model Context Protocol (MCP) server that parses Mermaid ER diagrams, creates PostgreSQL database tables, and exposes automatic REST/GraphQL CRUD APIs.

---

## 📊 High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Client Layer"]
        CD["Claude Desktop / MCP Client"]
    end
    
    subgraph MCP["🔌 MCP Server Layer"]
        MCPServer["MCP Server<br/>(index.ts)"]
        StdioTransport["Stdio Transport"]
    end
    
    subgraph Tools["🛠️ MCP Tools Layer (12 Tools)"]
        subgraph ERTools["ER Parsing Tools"]
            T1["parse_er_diagram"]
            T2["list_entities"]
            T3["get_entity_details"]
            T4["get_relationships"]
            T5["validate_diagram"]
        end
        subgraph DBTools["Database Tools"]
            T6["test_connection"]
            T7["generate_sql"]
            T8["create_schema"]
            T9["drop_schema"]
        end
        subgraph APITools["API Tools"]
            T10["start_api_server"]
            T11["stop_api_server"]
            T12["get_api_endpoints"]
        end
    end
    
    subgraph Core["⚙️ Core Modules"]
        Parser["Parser Module<br/>(parser/index.ts)"]
        Config["Config Module<br/>(config.ts)"]
        Types["Types<br/>(types/schema.ts)"]
    end
    
    subgraph Database["🗄️ Database Layer"]
        DBIndex["Database Connection<br/>(database/index.ts)"]
        SQLGen["SQL Generator<br/>(database/sqlGenerator.ts)"]
        QueryBuilder["Query Builder<br/>(database/queryBuilder.ts)"]
        PG[(PostgreSQL)]
    end
    
    subgraph API["🚀 API Layer"]
        APIServer["Express Server<br/>(api/index.ts)"]
        REST["REST Router<br/>(api/restRouter.ts)"]
        GraphQL["GraphQL Schema<br/>(api/graphqlSchema.ts)"]
    end
    
    subgraph External["📄 External Sources"]
        MMDFile["Mermaid .mmd File"]
        MMDUrl["Mermaid URL"]
        EnvFile[".env Configuration"]
    end
    
    CD <-->|"MCP Protocol<br/>(JSON-RPC)"| StdioTransport
    StdioTransport <--> MCPServer
    MCPServer --> Tools
    
    ERTools --> Parser
    DBTools --> DBIndex
    DBTools --> SQLGen
    APITools --> APIServer
    
    Parser --> Types
    Config --> EnvFile
    
    DBIndex --> PG
    SQLGen --> Types
    QueryBuilder --> DBIndex
    
    APIServer --> REST
    APIServer --> GraphQL
    REST --> QueryBuilder
    GraphQL --> QueryBuilder
    
    Config --> MMDFile
    Config --> MMDUrl
```

---

## 🔄 Complete Data Flow Architecture

```mermaid
flowchart LR
    subgraph Input["📥 Input"]
        ER["Mermaid ER Diagram<br/>.mmd file or URL"]
    end
    
    subgraph Parse["🔍 Parse Phase"]
        P1["Read Diagram"]
        P2["Tokenize Lines"]
        P3["Extract Entities"]
        P4["Extract Relationships"]
        P5["Build Schema Object"]
    end
    
    subgraph Generate["⚡ Generate Phase"]
        G1["Map Types to PostgreSQL"]
        G2["Generate CREATE TABLE"]
        G3["Generate Foreign Keys"]
        G4["Generate DROP TABLE"]
    end
    
    subgraph Execute["🚀 Execute Phase"]
        E1["Connect to PostgreSQL"]
        E2["Execute DDL"]
        E3["Start API Server"]
    end
    
    subgraph Serve["🌐 Serve Phase"]
        S1["REST Endpoints"]
        S2["GraphQL Endpoints"]
    end
    
    ER --> P1 --> P2 --> P3 --> P4 --> P5
    P5 --> G1 --> G2 --> G3 --> G4
    G2 --> E1 --> E2 --> E3
    E3 --> S1
    E3 --> S2
```

---

## 📁 Project Structure

```
mcp-tools/
├── src/
│   ├── index.ts              # 🚀 MCP Server Entry Point
│   ├── config.ts             # ⚙️ Environment Configuration
│   ├── test.ts               # 🧪 Test Runner
│   │
│   ├── types/
│   │   └── schema.ts         # 📋 TypeScript Interfaces
│   │
│   ├── parser/
│   │   └── index.ts          # 🔍 Mermaid ER Parser
│   │
│   ├── database/
│   │   ├── index.ts          # 🗄️ PostgreSQL Connection Pool
│   │   ├── sqlGenerator.ts   # ⚡ DDL SQL Generator
│   │   └── queryBuilder.ts   # 🔧 CRUD Query Builder
│   │
│   ├── api/
│   │   ├── index.ts          # 🌐 Express Server Manager
│   │   ├── restRouter.ts     # 📡 REST CRUD Router
│   │   └── graphqlSchema.ts  # 📊 GraphQL Schema Generator
│   │
│   └── tools/
│       ├── erTools.ts        # 🛠️ ER Diagram MCP Tools (5)
│       └── dbTools.ts        # 🛠️ Database & API MCP Tools (7)
│
├── examples/
│   └── sample-er.mmd         # 📄 Example ER Diagram
│
├── dist/                     # 📦 Compiled JavaScript
├── .env                      # 🔐 Environment Variables
├── .env.example              # 📝 Environment Template
├── package.json              # 📦 Dependencies
└── tsconfig.json             # ⚙️ TypeScript Config
```

---

## 🔌 MCP Server Creation Flow

```mermaid
sequenceDiagram
    participant CD as Claude Desktop
    participant Stdio as Stdio Transport
    participant MCP as MCP Server
    participant Tools as Tool Registry
    participant Module as Core Modules
    
    Note over CD,Module: 1. Server Startup
    CD->>Stdio: Launch node process
    Stdio->>MCP: Create McpServer instance
    MCP->>MCP: Initialize with name/version
    
    Note over CD,Module: 2. Tool Registration (12 Tools)
    MCP->>Tools: Register parse_er_diagram
    MCP->>Tools: Register list_entities
    MCP->>Tools: Register get_entity_details
    MCP->>Tools: Register get_relationships
    MCP->>Tools: Register validate_diagram
    MCP->>Tools: Register test_connection
    MCP->>Tools: Register generate_sql
    MCP->>Tools: Register create_schema
    MCP->>Tools: Register drop_schema
    MCP->>Tools: Register start_api_server
    MCP->>Tools: Register stop_api_server
    MCP->>Tools: Register get_api_endpoints
    
    Note over CD,Module: 3. Connect & Ready
    MCP->>Stdio: Connect transport
    Stdio-->>CD: Server ready
    
    Note over CD,Module: 4. Tool Invocation
    CD->>Stdio: Call tool (JSON-RPC)
    Stdio->>MCP: Route to handler
    MCP->>Module: Execute tool logic
    Module-->>MCP: Return result
    MCP-->>Stdio: JSON response
    Stdio-->>CD: Tool result
```

---

## 🛠️ MCP Tools Reference

### Parsing Tools (5 Tools)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `parse_er_diagram` | Parse complete ER diagram | `diagram?: string` | Full schema with entities & relationships |
| `list_entities` | List all entity names | `diagram?: string` | Array of entity names with aliases |
| `get_entity_details` | Get entity attributes | `entityName: string, diagram?: string` | Entity with all attributes, types, keys |
| `get_relationships` | Get all relationships | `diagram?: string, entityName?: string` | Relationships with cardinalities |
| `validate_diagram` | Validate diagram syntax | `diagram: string` | `{valid: boolean, errors: string[]}` |

### Database Tools (4 Tools)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `test_connection` | Test PostgreSQL connection | None | `{success: boolean, error?: string}` |
| `generate_sql` | Generate DDL without executing | `diagram?: string` | SQL statements (CREATE, FK, DROP) |
| `create_schema` | Create tables in database | `diagram?: string, dropExisting?: boolean` | Created tables count |
| `drop_schema` | Drop all tables (destructive) | `diagram?: string, confirm: boolean` | Dropped tables count |

### API Tools (3 Tools)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `start_api_server` | Start REST/GraphQL server | `diagram?: string` | Server info with endpoints |
| `stop_api_server` | Stop the API server | None | `{stopped: boolean}` |
| `get_api_endpoints` | Get running server info | None | Endpoints list, GraphQL URL |

---

## 🔍 Parser Module Architecture

```mermaid
flowchart TD
    subgraph Input["📄 Input"]
        MMD["Mermaid ER Diagram"]
    end
    
    subgraph Patterns["🔧 Regex Patterns"]
        P1["ER_DIAGRAM_START: /erDiagram/"]
        P2["ENTITY_BLOCK: /ENTITY { ... }/"]
        P3["RELATIONSHIP: /A ||--o{ B/"]
        P4["ATTRIBUTE: /type name PK 'comment'/"]
    end
    
    subgraph Functions["⚡ Parser Functions"]
        F1["parseERDiagram()"]
        F2["parseCardinality()"]
        F3["parseAttributeKeys()"]
        F4["cleanEntityName()"]
        F5["validateERDiagram()"]
    end
    
    subgraph Output["📤 Output"]
        Schema["DatabaseSchema"]
        Entity["Entity[]"]
        Attr["Attribute[]"]
        Rel["Relationship[]"]
    end
    
    MMD --> P1
    MMD --> P2
    MMD --> P3
    MMD --> P4
    
    P1 --> F1
    P2 --> F1
    P3 --> F1
    P4 --> F1
    
    F1 --> F2
    F1 --> F3
    F1 --> F4
    
    F1 --> Schema
    Schema --> Entity
    Entity --> Attr
    Schema --> Rel
    
    MMD --> F5
    F5 --> |Validation Result| Output
```

### Type Definitions

```typescript
// Entity structure
interface Entity {
    name: string;
    alias?: string;
    attributes: Attribute[];
}

// Attribute structure  
interface Attribute {
    name: string;
    type: string;
    keys: ('PK' | 'FK' | 'UK')[];
    comment?: string;
}

// Relationship structure
interface Relationship {
    firstEntity: string;
    secondEntity: string;
    firstCardinality: Cardinality;
    secondCardinality: Cardinality;
    identifying: boolean;
    label: string;
}

// Cardinality types
type Cardinality = 
    | 'ZERO_OR_ONE'    // |o or o|
    | 'EXACTLY_ONE'    // ||
    | 'ZERO_OR_MORE'   // }o or o{
    | 'ONE_OR_MORE';   // }| or |{
```

---

## 🗄️ Database Layer Architecture

```mermaid
flowchart TB
    subgraph Schema["📋 Input Schema"]
        DS["DatabaseSchema"]
    end
    
    subgraph SQLGen["⚡ SQL Generator (sqlGenerator.ts)"]
        direction TB
        TM["Type Mapping<br/>(Mermaid → PostgreSQL)"]
        TN["Table Naming<br/>(snake_case)"]
        CT["generateCreateTable()"]
        FK["generateForeignKeys()"]
        DT["generateDropTables()"]
        FS["generateSchemaSQL()"]
    end
    
    subgraph Connection["🔌 Database Connection (index.ts)"]
        Pool["Connection Pool<br/>(max: 20 connections)"]
        Query["query()"]
        TX["transaction()"]
        Test["testConnection()"]
    end
    
    subgraph QueryBuilder["🔧 Query Builder (queryBuilder.ts)"]
        CRUD["createCrudQueries()"]
        Select["selectAll() / selectById()"]
        Insert["insert()"]
        Update["update()"]
        Delete["delete()"]
        Count["count()"]
    end
    
    subgraph Output["🗄️ PostgreSQL"]
        PG[(PostgreSQL Database)]
    end
    
    DS --> TM --> CT
    DS --> TN --> CT
    CT --> FK --> FS
    CT --> DT
    
    FS --> Query --> Pool --> PG
    TX --> Pool
    Test --> Pool
    
    DS --> CRUD
    CRUD --> Select
    CRUD --> Insert
    CRUD --> Update
    CRUD --> Delete
    CRUD --> Count
    
    Select --> Query
    Insert --> Query
    Update --> Query
    Delete --> Query
```

### SQL Type Mapping

| Mermaid Type | PostgreSQL Type |
|--------------|-----------------|
| `int`, `integer` | `INTEGER` |
| `bigint` | `BIGINT` |
| `serial` | `SERIAL` |
| `string`, `varchar` | `VARCHAR(255)` |
| `text` | `TEXT` |
| `boolean`, `bool` | `BOOLEAN` |
| `date` | `DATE` |
| `datetime`, `timestamp` | `TIMESTAMP` |
| `uuid` | `UUID` |
| `json`, `jsonb` | `JSON` / `JSONB` |
| `float`, `decimal` | `FLOAT` / `DECIMAL(10,2)` |

---

## 🌐 API Layer Architecture

```mermaid
flowchart TB
    subgraph Express["🚀 Express Server (api/index.ts)"]
        App["Express App"]
        CORS["CORS Middleware"]
        JSON["JSON Middleware"]
        Health["/health"]
        SchemaEP["/schema"]
    end
    
    subgraph REST["📡 REST Router (api/restRouter.ts)"]
        direction TB
        Router["Router Factory"]
        EntityRouter["Entity Router"]
        subgraph CRUD["CRUD Operations"]
            GET_ALL["GET /api/{entity}"]
            GET_ONE["GET /api/{entity}/:id"]
            POST["POST /api/{entity}"]
            PUT["PUT /api/{entity}/:id"]
            PATCH["PATCH /api/{entity}/:id"]
            DELETE["DELETE /api/{entity}/:id"]
        end
    end
    
    subgraph GraphQL["📊 GraphQL (api/graphqlSchema.ts)"]
        Apollo["Apollo Server"]
        TypeDefs["generateGraphQLSchema()"]
        Resolvers["createResolvers()"]
        subgraph GQLOps["Operations"]
            Query["Queries: list, getById"]
            Mutation["Mutations: create, update, delete"]
        end
    end
    
    subgraph DB["🗄️ Database"]
        QueryBuilder["Query Builder"]
        PG[(PostgreSQL)]
    end
    
    App --> CORS --> JSON
    App --> Health
    App --> SchemaEP
    
    App --> Router
    Router --> EntityRouter
    EntityRouter --> CRUD
    
    App --> Apollo
    Apollo --> TypeDefs
    Apollo --> Resolvers
    Resolvers --> GQLOps
    
    CRUD --> QueryBuilder --> PG
    GQLOps --> QueryBuilder
```

### REST API Endpoints (Auto-Generated)

For each entity in your ER diagram, the following endpoints are created:

```
┌─────────────────────────────────────────────────────────────┐
│  REST API Endpoints (per entity)                            │
├──────────────────┬──────────────────────────────────────────┤
│ GET    /api/{e}  │ List all records (with pagination)       │
│ GET    /api/{e}/:id │ Get single record by ID               │
│ POST   /api/{e}  │ Create new record                        │
│ PUT    /api/{e}/:id │ Full update record                    │
│ PATCH  /api/{e}/:id │ Partial update record                 │
│ DELETE /api/{e}/:id │ Delete record                         │
└──────────────────┴──────────────────────────────────────────┘
```

### GraphQL Schema (Auto-Generated)

```graphql
# For each entity, these are generated:
type Customer {
  customer_id: Int!
  email: String
  name: String
}

input CustomerInput {
  email: String
  name: String
}

type Query {
  customers(limit: Int, offset: Int): [Customer!]!
  customer(id: ID!): Customer
}

type Mutation {
  createCustomer(input: CustomerInput!): Customer!
  updateCustomer(id: ID!, input: CustomerInput!): Customer
  deleteCustomer(id: ID!): Customer
}
```

---

## ⚙️ Configuration Architecture

```mermaid
flowchart LR
    subgraph Sources["📄 Configuration Sources"]
        ENV[".env File"]
        ENVVAR["Environment Variables"]
        MMDFILE["Mermaid .mmd File"]
        MMDURL["Mermaid URL"]
    end
    
    subgraph Config["⚙️ config.ts"]
        Load["loadEnv()"]
        GetConfig["getConfig()"]
        LoadDiagram["loadDiagramFromConfig()"]
        Logger["logger"]
    end
    
    subgraph ConfigObj["📋 Config Interface"]
        direction TB
        C1["diagramPath?: string"]
        C2["diagramUrl?: string"]
        C3["logLevel: debug|info|warn|error"]
        C4["dbHost, dbPort, dbName"]
        C5["dbUser, dbPassword"]
        C6["apiType: rest|graphql|both"]
        C7["apiPort, apiHost"]
    end
    
    ENV --> Load
    ENVVAR --> GetConfig
    GetConfig --> ConfigObj
    
    MMDFILE --> LoadDiagram
    MMDURL --> LoadDiagram
    
    Logger --> |debug| C3
    Logger --> |info| C3
    Logger --> |warn| C3
    Logger --> |error| C3
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MERMAID_DIAGRAM_PATH` | Path to .mmd file | - |
| `MERMAID_DIAGRAM_URL` | URL to fetch diagram | - |
| `LOG_LEVEL` | Logging level | `info` |
| `DB_HOST` | PostgreSQL host | - |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | - |
| `DB_USER` | Database user | - |
| `DB_PASSWORD` | Database password | - |
| `API_TYPE` | API type (rest/graphql/both) | `rest` |
| `API_PORT` | API server port | `3000` |
| `API_HOST` | API server host | `0.0.0.0` |

---

## 🚀 Complete Workflow Example

```mermaid
sequenceDiagram
    participant User as 👤 User (via Claude)
    participant MCP as 🔌 MCP Server
    participant Parser as 🔍 Parser
    participant DB as 🗄️ Database
    participant API as 🌐 API Server
    
    Note over User,API: Step 1: Parse ER Diagram
    User->>MCP: parse_er_diagram
    MCP->>Parser: parseERDiagram(diagram)
    Parser-->>MCP: DatabaseSchema
    MCP-->>User: Schema with entities & relationships
    
    Note over User,API: Step 2: Review Generated SQL
    User->>MCP: generate_sql
    MCP->>Parser: Parse diagram
    MCP->>DB: generateSchemaSQL()
    DB-->>MCP: DDL statements
    MCP-->>User: CREATE TABLE, FK statements
    
    Note over User,API: Step 3: Create Database Tables
    User->>MCP: create_schema
    MCP->>DB: Execute DDL in transaction
    DB-->>MCP: Tables created
    MCP-->>User: Success with table count
    
    Note over User,API: Step 4: Start API Server
    User->>MCP: start_api_server
    MCP->>API: startApiServer(schema)
    API->>API: Create Express app
    API->>API: Mount REST routes
    API->>API: Mount GraphQL endpoint
    API-->>MCP: Server info
    MCP-->>User: Endpoints list
    
    Note over User,API: Step 5: Use the APIs!
    User->>API: GET /api/customers
    API->>DB: SELECT * FROM customers
    DB-->>API: Records
    API-->>User: JSON response
```

---

## 🔐 Security Considerations

1. **Database Credentials**: Store in `.env`, never commit to git
2. **CORS**: Enabled by default, configure for production
3. **Input Validation**: Zod schemas validate all MCP tool inputs
4. **SQL Injection**: Parameterized queries used throughout
5. **Drop Protection**: `drop_schema` requires explicit `confirm: true`

---

## 📚 Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server implementation |
| `express` | HTTP server framework |
| `@apollo/server` | GraphQL server |
| `pg` | PostgreSQL client |
| `zod` | Input validation |
| `cors` | CORS middleware |
| `dotenv` | Environment configuration |
| `typescript` | Type safety |

---

## 🎯 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Build the server
npm run build

# 4. Add to Claude Desktop config
# See README.md for claude_desktop_config.json setup

# 5. Use via Claude Desktop
# "Parse my ER diagram"
# "Create the database tables"
# "Start the API server"
```

---

*Generated for MCP Mermaid ER Server v2.0.0*
