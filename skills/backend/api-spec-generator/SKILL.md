---
name: api-spec-generator
description: Detects new APIs or code changes in backend services and automatically generates or updates OpenAPI 3.0+ specifications and Bruno API collections. Supports tRPC, REST APIs, GraphQL, and multiple frameworks (Fastify, Express, Gin, FastAPI).
version: 1.0.0
author: Mai (Neolink Team)
tags:
  - api
  - openapi
  - bruno
  - documentation
  - spec
  - trpc
  - rest
  - swagger
---

# api-spec-generator

Automatically detects API changes in your codebase and generates/updates OpenAPI 3.0+ specifications and Bruno API (.bru) collections. Supports tRPC routers, REST controllers, GraphQL schemas, and multiple backend frameworks.

## What This Skill Does

**Solves the problem**: "We have APIs but no documentation, and specs get out of sync with code changes"

This skill:

1. **Detects API Changes** - Scans code for new/modified endpoints, tRPC procedures, GraphQL types
2. **Generates OpenAPI 3.0+ Specs** - Creates/updates `openapi.yaml` with proper schemas, paths, components
3. **Creates Bruno Collections** - Generates `.bru` files organized by service/domain
4. **Keeps Docs in Sync** - Updates specs automatically when code changes
5. **Version Control Friendly** - Plain text files that work with Git

## Supported API Types

- ✅ **tRPC** - Procedures, routers, input/output schemas (Zod)
- ✅ **REST** - Fastify routes, Express routes, Gin handlers, FastAPI endpoints
- ✅ **GraphQL** - Queries, mutations, types, schemas
- ✅ **Mixed** - Services with multiple API patterns

## Supported Frameworks

### Node.js
- Fastify 4.x, 5.x
- Express 4.x
- tRPC 10.x, 11.x
- NestJS

### Go
- Gin
- Chi
- Echo
- net/http

### Python
- FastAPI
- Flask
- Django REST Framework

## When to Use This Skill

Use this skill when:
- You add new API endpoints and need to update docs
- Your OpenAPI spec is out of date
- You want to generate Bruno collections for testing
- You're migrating from Postman/Insomnia to Bruno
- You need API documentation for frontend developers
- You're setting up CI/CD to validate API changes

## Usage Examples

### Example 1: Generate OpenAPI + Bruno for tRPC Service

```bash
# Input: neolink-logistic/gateway-service with tRPC routers
# Output: openapi.yaml + bruno/ collection
```

**What it detects**:
- tRPC routers (shipmentRouter, optionRouter, etc.)
- Zod input/output schemas
- Procedure types (query, mutation, subscription)
- Authentication requirements

**Generates**:
```yaml
# openapi.yaml
openapi: 3.2.0
info:
  title: Neolink Logistic API
  version: 1.0.0
paths:
  /api/v1/shipment/detail:
    get:
      tags: [Shipment]
      summary: Get shipment details
      parameters:
        - name: id
          in: query
          required: true
          schema:
            type: number
      responses:
        '200':
          description: Shipment details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShipmentDetail'
```

```
# bruno/shipment/get-shipment-detail.bru
meta {
  name: Get Shipment Detail
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/v1/shipment/detail?id=123
}

headers {
  Authorization: Bearer {{token}}
  Content-Type: application/json
}

assert {
  res.status: eq 200
  res.body.shipmentId: isDefined
}

tests {
  test("Should return shipment details", function() {
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('shipmentId');
    expect(res.body).to.have.property('status');
  });
}
```

### Example 2: Update OpenAPI for New Endpoints

```bash
# Before: Added new endpoint to shipment-service
# After: OpenAPI spec updated automatically
```

**Detects changes**:
- New tRPC procedures added
- Modified Zod schemas
- Changed response types
- New authentication requirements

**Updates OpenAPI**:
- Adds new paths
- Updates component schemas
- Preserves custom examples/descriptions
- Increments version number

### Example 3: Generate Bruno from Existing OpenAPI

```bash
# Input: openapi.yaml
# Output: bruno/ collection with all endpoints
```

**Converts**:
- OpenAPI paths → Bruno requests
- OpenAPI schemas → Bruno assertions
- OpenAPI examples → Bruno test data
- OpenAPI security → Bruno auth configs

### Example 4: Multi-Service API Documentation

```bash
# Generate specs for all gateway services:
# - neolink-general
# - neolink-logistic
# - neolink-gatekeeper
```

**Output structure**:
```
api-docs/
├── neolink-general/
│   ├── openapi.yaml
│   └── bruno/
│       ├── office/
│       ├── setting/
│       └── iam/
├── neolink-logistic/
│   ├── openapi.yaml
│   └── bruno/
│       ├── shipment/
│       ├── container/
│       └── tracking/
└── neolink-gatekeeper/
    ├── openapi.yaml
    └── bruno/
        └── auth/
```

## Implementation Strategy

### Step 1: Detect API Type and Framework

Scan the codebase to identify:
- Language (Node.js, Go, Python)
- Framework (Fastify, Express, Gin, FastAPI)
- API pattern (tRPC, REST, GraphQL, mixed)
- Project structure

**For tRPC (Node.js)**:
```typescript
// Detect from imports and exports
import { router, publicProcedure } from '@trpc/server'
export const shipmentRouter = router({ ... })
```

**For REST (Fastify)**:
```typescript
// Detect from route registration
fastify.get('/api/v1/shipment/:id', async (request, reply) => { ... })
```

**For Go (Gin)**:
```go
// Detect from route methods
router.GET("/api/v1/shipment/:id", getShipmentHandler)
router.POST("/api/v1/shipment", createShipmentHandler)
```

### Step 2: Parse API Definitions

**For tRPC**:
```typescript
// Parse router structure
export const shipmentRouter = router({
  detail: publicProcedure
    .input(z.object({
      id: z.number()
    }))
    .query(async ({ input }) => {
      return { shipmentId: input.id, status: 'delivered' }
    }),
    
  create: publicProcedure
    .input(z.object({
      origin: z.string(),
      destination: z.string()
    }))
    .mutation(async ({ input }) => {
      return { shipmentId: 123, ...input }
    })
})
```

**Extract**:
- Procedure name: `detail`, `create`
- Type: `query`, `mutation`
- Input schema: Zod object
- Output schema: Return type
- HTTP method: GET for query, POST for mutation
- Path: `/api/v1/shipment.detail`, `/api/v1/shipment.create`

**For REST (Fastify)**:
```typescript
// Parse route definitions
fastify.get<{
  Querystring: { id: number }
  Reply: ShipmentDetail
}>('/api/v1/shipment', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        id: { type: 'number' }
      },
      required: ['id']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          shipmentId: { type: 'number' },
          status: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => { ... })
```

**Extract**:
- Method: GET, POST, PUT, DELETE
- Path: `/api/v1/shipment`
- Query params: Querystring schema
- Request body: Body schema
- Response: Response schema
- Status codes: 200, 400, 500

**For Go (Gin)**:
```go
// Parse handler annotations
// @Summary Get shipment details
// @Description Get detailed information about a shipment
// @Tags Shipment
// @Accept json
// @Produce json
// @Param id path int true "Shipment ID"
// @Success 200 {object} ShipmentDetail
// @Router /api/v1/shipment/{id} [get]
func getShipmentHandler(c *gin.Context) { ... }
```

**Extract from Swagger comments**:
- Summary, Description, Tags
- Method and path from @Router
- Parameters from @Param
- Response from @Success
- Request body from struct tags

### Step 3: Generate OpenAPI 3.0+ Specification

**Base structure**:
```yaml
openapi: 3.2.0
info:
  title: {{serviceName}}
  description: {{serviceDescription}}
  version: 1.0.0
  contact:
    name: {{teamName}}
    email: {{teamEmail}}

servers:
  - url: https://dev-{{serviceName}}.neolinkrnd.com
    description: Development
  - url: https://staging-{{serviceName}}.neolinkrnd.com
    description: Staging
  - url: https://{{serviceName}}.neolinkrnd.com
    description: Production

tags:
  - name: Shipment
    description: Shipment tracking operations
  - name: Container
    description: Container management

paths:
  /api/v1/shipment/detail:
    get:
      tags: [Shipment]
      summary: Get shipment details
      description: Retrieves detailed information about a specific shipment
      operationId: getShipmentDetail
      parameters:
        - name: id
          in: query
          description: Shipment ID
          required: true
          schema:
            type: number
            example: 123
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShipmentDetail'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
      security:
        - bearerAuth: []

components:
  schemas:
    ShipmentDetail:
      type: object
      required:
        - shipmentId
        - status
      properties:
        shipmentId:
          type: number
          example: 123
        status:
          type: string
          enum: [pending, in-transit, delivered, cancelled]
          example: delivered
        origin:
          type: string
          example: Bangkok, Thailand
        destination:
          type: string
          example: Singapore
        containerIds:
          type: array
          items:
            type: number
          example: [456, 789]
    
    Error:
      type: object
      properties:
        error:
          type: string
        requestId:
          type: string
        timestamp:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token from Gatekeeper auth service
```

**For tRPC → OpenAPI conversion**:
- `router({ ... })` → `paths` section
- `publicProcedure` → no auth required
- `protectedProcedure` → `security: [bearerAuth: []]`
- `.query()` → GET method
- `.mutation()` → POST method
- `.input(z.object({ ... }))` → request schema
- `.output(z.object({ ... }))` → response schema
- Zod types → JSON Schema types

**Zod to JSON Schema mapping**:
```typescript
z.string() → { type: 'string' }
z.number() → { type: 'number' }
z.boolean() → { type: 'boolean' }
z.array(z.string()) → { type: 'array', items: { type: 'string' } }
z.object({ ... }) → { type: 'object', properties: { ... } }
z.enum(['a', 'b']) → { type: 'string', enum: ['a', 'b'] }
z.optional() → remove from required[]
z.nullable() → { type: [..., 'null'] }
```

### Step 4: Generate Bruno API Collection

**Bruno collection structure**:
```
bruno/
├── bruno.json                  # Collection config
├── environments/
│   ├── dev.bru
│   ├── staging.bru
│   └── production.bru
├── shipment/
│   ├── get-shipment-detail.bru
│   ├── create-shipment.bru
│   ├── update-shipment.bru
│   └── list-shipments.bru
└── container/
    ├── get-container-detail.bru
    └── list-containers.bru
```

**bruno.json**:
```json
{
  "version": "1",
  "name": "Neolink Logistic API",
  "type": "collection",
  "ignore": [
    "node_modules",
    ".git"
  ]
}
```

**environments/dev.bru**:
```
vars {
  baseUrl: https://dev-neolink-logistic.neolinkrnd.com
  authUrl: https://dev-gatekeeper.neolinkrnd.com
}

vars:secret {
  token: {{process.env.DEV_TOKEN}}
}
```

**shipment/get-shipment-detail.bru**:
```
meta {
  name: Get Shipment Detail
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/api/v1/shipment/detail?id=123
}

params:query {
  id: 123
}

headers {
  Authorization: Bearer {{token}}
  Content-Type: application/json
}

auth {
  mode: bearer
}

auth:bearer {
  token: {{token}}
}

docs {
  Retrieves detailed information about a specific shipment.
  
  **Parameters**:
  - `id` (number, required): Shipment ID
  
  **Response**:
  - 200: Shipment details
  - 400: Invalid request
  - 401: Unauthorized
  - 500: Internal server error
}

assert {
  res.status: eq 200
  res.body.shipmentId: isDefined
  res.body.status: isDefined
}

tests {
  test("Should return 200 OK", function() {
    expect(res.status).to.equal(200);
  });
  
  test("Should have shipmentId", function() {
    expect(res.body).to.have.property('shipmentId');
    expect(res.body.shipmentId).to.be.a('number');
  });
  
  test("Should have valid status", function() {
    const validStatuses = ['pending', 'in-transit', 'delivered', 'cancelled'];
    expect(validStatuses).to.include(res.body.status);
  });
}
```

**shipment/create-shipment.bru**:
```
meta {
  name: Create Shipment
  type: http
  seq: 2
}

post {
  url: {{baseUrl}}/api/v1/shipment
}

headers {
  Authorization: Bearer {{token}}
  Content-Type: application/json
}

auth:bearer {
  token: {{token}}
}

body:json {
  {
    "origin": "Bangkok, Thailand",
    "destination": "Singapore",
    "containerIds": [456, 789]
  }
}

docs {
  Creates a new shipment record.
  
  **Request Body**:
  ```json
  {
    "origin": "string (required)",
    "destination": "string (required)",
    "containerIds": "number[] (optional)"
  }
  ```
  
  **Response**:
  - 201: Shipment created successfully
  - 400: Invalid request
  - 401: Unauthorized
}

assert {
  res.status: eq 201
  res.body.shipmentId: isDefined
}

tests {
  test("Should create shipment", function() {
    expect(res.status).to.equal(201);
    expect(res.body.shipmentId).to.be.a('number');
  });
  
  // Save shipmentId for other requests
  bru.setEnvVar("lastShipmentId", res.body.shipmentId);
}
```

**OpenAPI → Bruno conversion rules**:

| OpenAPI | Bruno |
|---------|-------|
| `paths` | Folder structure by tag |
| `GET /path` | `get { url: ... }` |
| `POST /path` | `post { url: ... }` |
| `parameters` | `params:query { ... }` or `params:path { ... }` |
| `requestBody` | `body:json { ... }` |
| `responses` | `assert { ... }` and `tests { ... }` |
| `security` | `auth:bearer { token: {{token}} }` |
| `examples` | Test data in body |
| `description` | `docs { ... }` |

### Step 5: Update Existing Specs

When code changes are detected:

1. **Parse existing OpenAPI**
   - Read current `openapi.yaml`
   - Extract existing paths, schemas, examples

2. **Detect changes**
   - New endpoints added
   - Endpoints removed
   - Schemas modified
   - Response types changed

3. **Merge updates**
   - Add new paths
   - Update modified schemas
   - Preserve custom descriptions/examples
   - Increment version number

4. **Update Bruno collection**
   - Add new `.bru` files
   - Update existing files with schema changes
   - Preserve custom tests/assertions

5. **Generate changelog**
   ```markdown
   ## API Changes - 2026-04-22
   
   ### Added
   - `GET /api/v1/shipment/tracking` - Get shipment tracking events
   - `POST /api/v1/container/seal` - Seal a container
   
   ### Modified
   - `GET /api/v1/shipment/detail` - Added `estimatedDelivery` field
   - `POST /api/v1/shipment` - Made `containerIds` required
   
   ### Removed
   - `DELETE /api/v1/shipment/:id` - Deprecated in favor of status update
   ```

## Success Criteria

After running this skill:

- ✅ OpenAPI 3.0+ spec generated/updated for each service
- ✅ Bruno API collection created with all endpoints
- ✅ Specs match current code (no drift)
- ✅ All endpoints have proper schemas and examples
- ✅ Authentication configured correctly
- ✅ Tests/assertions added to Bruno requests
- ✅ Environment variables configured (dev/staging/prod)
- ✅ Changelog generated for API changes

## Configuration

### Skill Input

```yaml
# config.yaml
services:
  - name: neolink-logistic
    path: ./apps/neolink-logistic/gateway-service
    type: trpc
    base_url: https://dev-neolink-logistic.neolinkrnd.com
    auth_type: bearer
    
  - name: neolink-general
    path: ./apps/neolink-general/gateway-service
    type: trpc
    base_url: https://dev-neolink-general.neolinkrnd.com
    auth_type: bearer
    
  - name: neolink-gatekeeper
    path: ./neolink-gatekeeper
    type: rest
    framework: gin
    base_url: https://dev-gatekeeper.neolinkrnd.com
    auth_type: none

output:
  openapi_dir: ./api-docs
  bruno_dir: ./api-tests
  generate_changelog: true
  validate_schemas: true
```

### Environment Variables

```bash
# Bruno environment variables
DEV_BASE_URL=https://dev-neolink-logistic.neolinkrnd.com
DEV_TOKEN=your-dev-token-here

STAGING_BASE_URL=https://staging-neolink-logistic.neolinkrnd.com
STAGING_TOKEN=your-staging-token-here

PROD_BASE_URL=https://neolink-logistic.neolinkrnd.com
PROD_TOKEN=your-prod-token-here
```

## Testing the Generated Specs

### Validate OpenAPI

```bash
# Using swagger-cli
npx swagger-cli validate api-docs/neolink-logistic/openapi.yaml

# Using openapi-generator
npx @openapitools/openapi-generator-cli validate -i api-docs/neolink-logistic/openapi.yaml
```

### Test Bruno Collection

```bash
# Install Bruno CLI
npm install -g @usebruno/cli

# Run collection
bru run api-tests/neolink-logistic --env dev

# Run specific folder
bru run api-tests/neolink-logistic/shipment --env dev

# Run with output
bru run api-tests/neolink-logistic --env dev --output results.json
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: API Spec Validation

on:
  pull_request:
    paths:
      - 'apps/*/src/routes/**'
      - 'apps/*/src/app/routes/**'
      - 'libs/rpc-router/**'

jobs:
  validate-api-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate OpenAPI Specs
        run: |
          claude-code run api-spec-generator \
            --services neolink-logistic,neolink-general
      
      - name: Validate OpenAPI
        run: |
          npx swagger-cli validate api-docs/*/openapi.yaml
      
      - name: Test Bruno Collections
        run: |
          bru run api-tests/ --env dev
      
      - name: Comment PR with Changes
        uses: actions/github-script@v6
        with:
          script: |
            const changelog = require('./api-docs/CHANGELOG.md');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## API Changes\n\n${changelog}`
            });
```

## Integration with Frontend

### Generate TypeScript Client

```bash
# From OpenAPI spec
npx openapi-typescript api-docs/neolink-logistic/openapi.yaml \
  --output src/types/api.ts
```

```typescript
// Generated types
import type { paths } from './types/api'

type ShipmentDetailResponse = paths['/api/v1/shipment/detail']['get']['responses']['200']['content']['application/json']
```

### Import to Bruno

```typescript
// Frontend developers can:
// 1. Clone the bruno/ collection
// 2. Run requests to test APIs
// 3. Share collections via Git
// 4. Update when API changes
```

## Advanced Features

### Custom OpenAPI Extensions

```yaml
# Add custom vendor extensions
paths:
  /api/v1/shipment/detail:
    get:
      x-rate-limit: 100
      x-cache-ttl: 300
      x-internal-only: false
```

### Bruno Scripts

```javascript
// Pre-request script (get-shipment-detail.bru)
script:pre-request {
  // Get fresh token before request
  const authRes = await bru.post({
    url: bru.getEnvVar("authUrl") + "/login",
    body: {
      username: "test@example.com",
      password: bru.getEnvVar("password")
    }
  });
  
  bru.setVar("token", authRes.body.token);
}

// Post-response script
script:post-response {
  // Save response data for next request
  if (res.status === 200) {
    bru.setVar("shipmentId", res.body.shipmentId);
  }
}
```

### Mocking Support

```yaml
# Add mock examples to OpenAPI
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ShipmentDetail'
        examples:
          success:
            summary: Successful shipment lookup
            value:
              shipmentId: 123
              status: delivered
              origin: Bangkok
              destination: Singapore
          in-transit:
            summary: Shipment in transit
            value:
              shipmentId: 124
              status: in-transit
              origin: Singapore
              destination: Hong Kong
```

## Limitations

- Only supports TypeScript/JavaScript Zod schemas for tRPC (not yup, joi, etc.)
- Go swagger comments must follow standard format
- GraphQL requires schema file or SDL export
- Cannot detect dynamic routes or runtime-generated endpoints
- Requires explicit type annotations in TypeScript

## Troubleshooting

### Issue 1: Zod Schema Not Detected

**Problem**: tRPC input schema not converted to OpenAPI  
**Solution**: Ensure Zod schemas are exported and referenced:

```typescript
// Good
export const ShipmentInputSchema = z.object({ id: z.number() })
export const shipmentRouter = router({
  detail: publicProcedure.input(ShipmentInputSchema).query(...)
})

// Bad (inline schema harder to detect)
export const shipmentRouter = router({
  detail: publicProcedure.input(z.object({ id: z.number() })).query(...)
})
```

### Issue 2: Bruno Auth Not Working

**Problem**: Bearer token not being sent  
**Solution**: Check environment variable configuration:

```
# environments/dev.bru
vars:secret {
  token: {{process.env.DEV_TOKEN}}
}
```

Set environment variable:
```bash
export DEV_TOKEN="your-token-here"
```

### Issue 3: OpenAPI Validation Fails

**Problem**: Generated spec doesn't validate  
**Solution**: Check for:
- Circular schema references
- Invalid enum values
- Missing required fields
- Incorrect response status codes

## Related Skills

- `neolink-gateway-setup` - Add logging/metrics to gateway services
- `trpc-client-generator` - Generate frontend tRPC clients
- `angular-module-generator` - Generate Angular modules with API integration

## Examples Output

After running the skill on `neolink-logistic`:

**Generated Files**:
```
api-docs/neolink-logistic/
├── openapi.yaml                      (2,450 lines)
├── CHANGELOG.md                      (API changes log)
└── bruno/
    ├── bruno.json
    ├── environments/
    │   ├── dev.bru
    │   ├── staging.bru
    │   └── production.bru
    ├── shipment/
    │   ├── get-shipment-detail.bru
    │   ├── create-shipment.bru
    │   ├── update-shipment.bru
    │   ├── list-shipments.bru
    │   └── get-tracking-events.bru
    ├── container/
    │   ├── get-container-detail.bru
    │   ├── list-containers.bru
    │   └── update-container-status.bru
    ├── option/
    │   ├── get-ports.bru
    │   ├── get-carriers.bru
    │   └── get-currencies.bru
    └── iam/
        └── get-office-permissions.bru
```

**Stats**:
- ✅ 45 API endpoints documented
- ✅ 28 component schemas generated
- ✅ 45 Bruno test files created
- ✅ 135 test assertions added
- ✅ 3 environment configs created
- ✅ 100% API coverage

---

*Status: Ready for Implementation*  
*Priority: ⭐⭐⭐ High*  
*Estimated Implementation Time: 1 week*
