---
name: neolink-gateway-setup
description: Use this skill when the user wants to add or upgrade observability on an API gateway or backend service — structured logging (with request-body capture), Prometheus metrics, request tracing, enhanced error handling. Trigger on phrases like "add logging to the gateway", "set up Prometheus metrics", "add request tracing", "bootstrap a new gateway service", "add observability", "instrument this service", "wire up metrics", or when starting a brand-new gateway-service / backend-service that needs the standard Neolink telemetry stack. Works for Node.js (Fastify/Express), Go (Gin/Chi), and Python (FastAPI/Flask).
version: 1.0.0
author: Mai (Neolink Team)
tags:
  - observability
  - logging
  - monitoring
  - metrics
  - gateway
  - nodejs
  - go
  - python
---

# neolink-gateway-setup

Adds production-ready observability to API gateway services: structured logging with request body capture, Prometheus metrics, request tracing, and enhanced error handling. Works with Node.js (Fastify/Express), Go (Gin/Chi), and Python (FastAPI/Flask).

## What This Skill Does

**Solves the problem**: "When something errors, we don't have the body of the data that caused the error or context to debug it"

This skill enhances any gateway service by adding:

1. **Request Logging** - Captures full request context (method, URL, headers, body, query, user info)
2. **Error Logging** - Captures the exact request body that caused errors with full stack traces
3. **Performance Metrics** - Prometheus metrics for request duration, request count, status codes
4. **Request Tracing** - Unique requestId for tracing requests across services
5. **Health Checks** - `/health` and `/metrics` endpoints

## When to Use This Skill

Use this skill when you need to add observability to a gateway service, especially when:
- You can't debug production errors because you don't have request context
- You need to track API performance and latency
- You want to trace requests across microservices
- You're setting up monitoring/alerting infrastructure

This skill is framework-agnostic and works with:
- **Node.js**: Fastify 4.x/5.x, Express 4.x
- **Go**: Gin, Chi, net/http
- **Python**: FastAPI, Flask

## Usage Examples

### Example 1: Setup Node.js Fastify Gateway

```bash
# The skill will:
# 1. Detect Fastify framework
# 2. Create plugins for logging, metrics, request-id, error handling
# 3. Update package.json with dependencies
# 4. Modify app.ts to register plugins
```

Input: `service_path: "./apps/neolink-general/gateway-service"`

Output:
- Creates `src/plugins/logger.plugin.ts`
- Creates `src/plugins/metrics.plugin.ts`
- Creates `src/plugins/request-id.plugin.ts`
- Modifies `src/plugins/error-handler.plugin.ts`
- Updates `src/app.ts`
- Updates `package.json`

### Example 2: Setup Go Gin Gateway

```bash
# The skill will:
# 1. Detect Gin framework
# 2. Create middleware for logging, metrics, request-id, recovery
# 3. Update go.mod with dependencies
# 4. Modify main.go to use middleware
```

Input: `service_path: "./neolink-gatekeeper"`

Output:
- Creates `middleware/logger.go`
- Creates `middleware/metrics.go`
- Creates `middleware/requestid.go`
- Modifies `middleware/recovery.go`
- Updates `main.go`
- Updates `go.mod`

### Example 3: Setup Python FastAPI Gateway

Input: `service_path: "./apps/gateway-service"`

Output:
- Creates `middleware/logger.py`
- Creates `middleware/metrics.py`
- Creates `middleware/request_id.py`
- Modifies `middleware/error_handler.py`
- Updates `main.py`
- Updates `requirements.txt`

## Implementation Strategy

### Step 1: Detect Framework and Language

Read the service directory and identify:
- Language (Node.js, Go, Python) from package.json, go.mod, requirements.txt
- Framework (Fastify, Express, Gin, Chi, FastAPI, Flask) from imports/dependencies
- Project structure (where to create files)

### Step 2: Create Logging Infrastructure

**For Node.js (Fastify)**:
```typescript
// src/plugins/logger.plugin.ts
import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'

export default fp(async (fastify: FastifyInstance) => {
  // Request logging
  fastify.addHook('onRequest', (request, reply, done) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,           // ← CAPTURES REQUEST BODY
      query: request.query,
      params: request.params,
      userId: (request as any).userId,
      officeId: (request as any).officeId,
      timestamp: new Date().toISOString()
    }, 'Incoming request')
    done()
  })

  // Response logging
  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
      timestamp: new Date().toISOString()
    }, 'Request completed')
    done()
  })
})
```

**For Go (Gin)**:
```go
// middleware/logger.go
package middleware

import (
    "bytes"
    "io"
    "time"
    
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
)

func Logger(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        // Read request body
        var bodyBytes []byte
        if c.Request.Body != nil {
            bodyBytes, _ = io.ReadAll(c.Request.Body)
            c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
        }
        
        // Log request
        logger.Info("Incoming request",
            zap.String("requestId", c.GetString("requestId")),
            zap.String("method", c.Request.Method),
            zap.String("path", c.Request.URL.Path),
            zap.String("body", string(bodyBytes)),
            zap.String("query", c.Request.URL.RawQuery),
        )
        
        c.Next()
        
        // Log response
        duration := time.Since(start)
        logger.Info("Request completed",
            zap.String("requestId", c.GetString("requestId")),
            zap.Int("status", c.Writer.Status()),
            zap.Duration("duration", duration),
        )
    }
}
```

**For Python (FastAPI)**:
```python
# middleware/logger.py
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("gateway")

class LoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.state.request_id
        
        # Read request body
        body = await request.body()
        
        # Log request
        logger.info({
            "requestId": request_id,
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "body": body.decode() if body else None,
            "query": dict(request.query_params)
        })
        
        start_time = time.time()
        response = await call_next(request)
        duration = (time.time() - start_time) * 1000
        
        # Log response
        logger.info({
            "requestId": request_id,
            "status": response.status_code,
            "duration_ms": duration
        })
        
        return response
```

### Step 3: Create Metrics Infrastructure

**For Node.js**:
```typescript
// src/plugins/metrics.plugin.ts
import fp from 'fastify-plugin'
import promClient from 'prom-client'
import { FastifyInstance } from 'fastify'

const register = new promClient.Registry()

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
})

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
})

register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestsTotal)

export default fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onResponse', (request, reply, done) => {
    const labels = {
      method: request.method,
      route: request.routerPath || request.url,
      status: reply.statusCode.toString()
    }
    
    httpRequestDuration.labels(labels).observe(reply.getResponseTime())
    httpRequestsTotal.labels(labels).inc()
    
    done()
  })

  fastify.get('/metrics', async () => {
    return register.metrics()
  })

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
})
```

**For Go**:
```go
// middleware/metrics.go
package middleware

import (
    "strconv"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
)

var (
    httpRequestDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_ms",
            Help: "HTTP request duration in milliseconds",
            Buckets: []float64{10, 50, 100, 200, 500, 1000, 2000, 5000},
        },
        []string{"method", "path", "status"},
    )
    
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests",
        },
        []string{"method", "path", "status"},
    )
)

func Metrics() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        duration := time.Since(start).Milliseconds()
        status := strconv.Itoa(c.Writer.Status())
        
        labels := prometheus.Labels{
            "method": c.Request.Method,
            "path":   c.FullPath(),
            "status": status,
        }
        
        httpRequestDuration.With(labels).Observe(float64(duration))
        httpRequestsTotal.With(labels).Inc()
    }
}
```

### Step 4: Create Request ID Infrastructure

**For Node.js**:
```typescript
// src/plugins/request-id.plugin.ts
import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

export default fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', (request, reply, done) => {
    const requestId = request.headers['x-request-id'] as string || randomUUID()
    request.id = requestId
    reply.header('X-Request-ID', requestId)
    done()
  })
})
```

**For Go**:
```go
// middleware/requestid.go
package middleware

import (
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

func RequestID() gin.HandlerFunc {
    return func(c *gin.Context) {
        requestID := c.GetHeader("X-Request-ID")
        if requestID == "" {
            requestID = uuid.New().String()
        }
        
        c.Set("requestId", requestID)
        c.Header("X-Request-ID", requestID)
        
        c.Next()
    }
}
```

### Step 5: Enhance Error Handler

**For Node.js**:
```typescript
// src/plugins/error-handler.plugin.ts
import fp from 'fastify-plugin'
import { FastifyInstance, FastifyError } from 'fastify'

export default fp(async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    // Log error with full context
    request.log.error({
      requestId: request.id,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,           // ← CAPTURES REQUEST BODY THAT CAUSED ERROR
        query: request.query,
        params: request.params
      },
      user: {
        userId: (request as any).userId,
        officeId: (request as any).officeId
      },
      timestamp: new Date().toISOString()
    }, 'Request error')
    
    const statusCode = error.statusCode || 500
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      requestId: request.id,      // ← Return requestId to frontend
      timestamp: new Date().toISOString()
    })
  })
})
```

**For Go**:
```go
// middleware/recovery.go (enhanced version)
package middleware

import (
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
)

func Recovery(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if err := recover(); err != nil {
                requestID := c.GetString("requestId")
                
                logger.Error("Request panic",
                    zap.String("requestId", requestID),
                    zap.Any("error", err),
                    zap.String("method", c.Request.Method),
                    zap.String("path", c.Request.URL.Path),
                )
                
                c.JSON(500, gin.H{
                    "error":     "Internal Server Error",
                    "requestId": requestID,
                })
                c.Abort()
            }
        }()
        c.Next()
    }
}
```

### Step 6: Update Main App File

**For Node.js (Fastify)**:
```typescript
// src/app.ts
import Fastify from 'fastify'
import requestIdPlugin from './plugins/request-id.plugin'
import loggerPlugin from './plugins/logger.plugin'
import metricsPlugin from './plugins/metrics.plugin'
import errorHandlerPlugin from './plugins/error-handler.plugin'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    },
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true
  })

  // Register plugins in order
  await app.register(requestIdPlugin)
  await app.register(loggerPlugin)
  await app.register(metricsPlugin)
  await app.register(errorHandlerPlugin)
  
  // ... rest of app setup
  
  return app
}
```

**For Go (Gin)**:
```go
// main.go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "go.uber.org/zap"
    
    "your-project/middleware"
)

func main() {
    logger, _ := zap.NewProduction()
    defer logger.Sync()
    
    router := gin.New()
    
    // Register middleware in order
    router.Use(middleware.RequestID())
    router.Use(middleware.Logger(logger))
    router.Use(middleware.Metrics())
    router.Use(middleware.Recovery(logger))
    
    // Health and metrics endpoints
    router.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })
    router.GET("/metrics", gin.WrapH(promhttp.Handler()))
    
    // ... rest of routes
    
    router.Run(":3000")
}
```

### Step 7: Update Dependencies

**For Node.js** - Update `package.json`:
```json
{
  "dependencies": {
    "pino": "^8.0.0",
    "pino-pretty": "^10.0.0",
    "fastify-plugin": "^4.0.0",
    "prom-client": "^15.0.0"
  }
}
```

**For Go** - Update `go.mod`:
```
go get go.uber.org/zap
go get github.com/prometheus/client_golang/prometheus
go get github.com/google/uuid
```

**For Python** - Update `requirements.txt`:
```
python-json-logger==2.0.7
prometheus-client==0.19.0
```

## Success Criteria

After running this skill, the gateway service should have:

- ✅ All requests logged with full context (method, URL, headers, body, query, user info)
- ✅ All errors logged with the exact request body that caused the error
- ✅ Prometheus metrics exposed on `/metrics` endpoint
- ✅ Health check available on `/health` endpoint
- ✅ Request ID in all logs and response headers
- ✅ Can trace any request by requestId
- ✅ Can reproduce errors using logged request body

## Testing the Enhancement

### Test 1: Request Logging

```bash
# Make a request
curl -X POST http://localhost:3000/api/v1/shipment \
  -H "Content-Type: application/json" \
  -d '{"id": 123}'

# Check logs - should see:
# {
#   "requestId": "550e8400-e29b-41d4-a716-446655440000",
#   "method": "POST",
#   "url": "/api/v1/shipment",
#   "body": {"id": 123}
# }
```

### Test 2: Error Logging with Request Body

```bash
# Make a request that causes an error
curl -X POST http://localhost:3000/api/v1/shipment \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Check logs - should see:
# {
#   "requestId": "...",
#   "error": {"message": "Validation failed"},
#   "request": {
#     "body": {"invalid": "data"}  ← CAPTURED!
#   }
# }
```

### Test 3: Prometheus Metrics

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Should see:
# http_request_duration_ms_bucket{method="POST",route="/api/v1/shipment",status="200",le="100"} 5
# http_requests_total{method="POST",route="/api/v1/shipment",status="200"} 10
```

### Test 4: Request Tracing

```bash
# Send request with custom requestId
curl -X GET http://localhost:3000/api/v1/shipment/123 \
  -H "X-Request-ID: my-custom-id"

# Response should include:
# X-Request-ID: my-custom-id
```

## Debugging Workflow

### When Production Error Occurs

1. **Frontend receives error with requestId**:
```json
{
  "error": "Internal Server Error",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

2. **Search logs by requestId**:
```bash
# Using grep
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/gateway.log

# Using Grafana Loki
{service="gateway"} |= "550e8400-e29b-41d4-a716-446655440000"
```

3. **Get full context**:
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {"message": "Database connection failed"},
  "request": {
    "method": "POST",
    "body": {"shipmentId": 123, "status": "delivered"}  ← THE DATA THAT CAUSED ERROR
  },
  "user": {"userId": "user123", "officeId": 456}
}
```

4. **Reproduce locally**:
```bash
# Use exact request body from logs
curl -X POST http://localhost:3000/api/v1/shipment/update \
  -d '{"shipmentId": 123, "status": "delivered"}'
```

## Next Steps After Running This Skill

1. **Install Dependencies**:
```bash
npm install  # or go mod tidy, or pip install -r requirements.txt
```

2. **Test Locally**:
```bash
npm run dev
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

3. **Set Up Grafana + Loki + Prometheus** (see Phase 2 in main implementation plan)

4. **Deploy to Dev Environment**

5. **Monitor for 1 Week**

6. **Evaluate Results**

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info           # debug, info, warn, error
LOG_FORMAT=json          # json, text

# Metrics
METRICS_PORT=9090
METRICS_PATH=/metrics

# Request ID
REQUEST_ID_HEADER=X-Request-ID
```

## Limitations

- Only works with supported frameworks (Fastify, Express, Gin, Chi, FastAPI, Flask)
- Requires write access to service directory
- Creates backup of original files (`.backup` suffix)
- Does not modify tests (you'll need to update those manually)

## Common Issues

### Issue 1: Framework Not Detected

**Problem**: Skill can't determine framework from code  
**Solution**: Specify framework explicitly in skill parameters

### Issue 2: Dependencies Already Installed

**Problem**: Dependencies conflict with existing versions  
**Solution**: Check package.json/go.mod for conflicts, update manually if needed

### Issue 3: Plugin Registration Order

**Problem**: Plugins registered in wrong order  
**Solution**: Ensure request-id → logger → metrics → error-handler order

## Related Skills

- `neolink-logging-visualizer` - Sets up Grafana dashboards for logs
- `angular-standalone-migrator` - Migrates Angular to v21
- `angular-module-generator` - Generates consistent Angular modules
