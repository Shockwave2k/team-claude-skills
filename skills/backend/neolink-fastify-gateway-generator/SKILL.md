---
name: neolink-fastify-gateway-generator
description: >
  Generates Fastify gateway controller and route boilerplate for the neolink-logistic gateway-service.
  Use this skill whenever the user wants to add a new endpoint to the gateway, scaffold a new controller,
  generate route registration code, or asks anything like "add an endpoint", "generate a gateway controller",
  "create a route for", "scaffold a new API", "add a new route to the gateway", or "generate the gateway
  boilerplate for X". Even if the user just pastes an API spec, tRPC procedure, or a list of fields and
  asks you to hook it up in the gateway — this skill applies.
---

# Fastify Gateway Generator

You are scaffolding gateway controller and route files for the `neolink-logistic` gateway-service.
The goal is to generate ready-to-use boilerplate so the developer can jump straight into writing
business logic — file names, types, schemas, and route registration are all set up correctly.

## Step 1 — Gather info (in order, one message)

Ask in this order and ask only what you don't already know. Collect everything in **one message**.

### 1a. Method + path (always ask these first)

- **HTTP method** — GET, POST, PUT, PATCH, or DELETE
- **Route path** — e.g. `/api/v1/shipment/:id/note` (include any `:param` segments)

### 1b. Derived from the path — no need to ask

Auto-derive **params** from any `:segments` in the path. Treat all path params as `Type.Number()` by
default unless the name clearly implies a string (e.g. `:slug`, `:code`).

### 1c. Conditional body — only ask for POST / PUT / PATCH

- **POST / PUT / PATCH** → ask: "What fields does the request body have? (name, type, optional?)"
- **GET / DELETE** → no body, skip entirely

### 1d. Remaining questions

- **Querystring** — any query params? (name, type, default) — or none
- **Returns data?**
  - **Yes** → ask for the shape (field names and types returned inside `data`)
  - **No** → just a success message, no data returned
- **Needs permission check?** — yes/no; if yes: resource name (e.g. `"ShipmentTracking"`) and which actions (e.g. `"view"`)
- **Route file** — add to an existing `*.route.ts` or create a new one?

> Authentication is assumed **yes** on all routes unless the user says otherwise.

## Step 2 — Generate the controller file

File path: `controllers/{resource-folder}/{verb}-{leaf-name}.controller.ts`

Derive the names from the method + path:
- `verb` = lowercased HTTP method (`get`, `post`, `put`, `patch`, `delete`)
- `resource-folder` = the main resource kebab-case (e.g. `shipment`, `shipment-calendar`)
- `leaf-name` = full kebab-case descriptor (e.g. `shipment-note`, `shipment-calendar-reminder`)

### Import order (two groups, blank line between)

```typescript
// Group 1: external packages
import { Static, Type } from "@sinclair/typebox";
import { DefaultController } from "@neolinkrnd/fastify-bundle-default-controller"; // only if permission check used
import { ReplyBuilder, SchemaBuilder } from "@neolinkrnd/fastify-bundle-schema-builder";
import { StatusCodes } from "@neolinkrnd/fastify-bundle-status-code";
import { FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";

// Group 2: project imports
import { shipmentRPC } from "../../rpc"; // placeholder — dev will update
import { ForbiddenError } from "@neolinkrnd/fastify-bundle-error-handler"; // only if permission check used
```

### Schema definitions

Only define what the route uses. Params are auto-derived from the path.

```typescript
const params = Type.Object({
    id: Type.Number()
});

const query = Type.Object({
    page: Type.Number({ default: 0 }),
    sort: Type.Optional(Type.String())
});

// POST / PUT / PATCH only — body fields from the user's input
const body = Type.Object({
    name: Type.String(),
    value: Type.Optional(Type.Number())
});
```

**Reply schema — pick one based on "Returns data?":**

```typescript
// Returns data:
const reply = ReplyBuilder.BuildSchemaWithData(
    Type.Object({
        id: Type.Number(),
        createdAt: Type.String()
    })
);

// No data:
const reply = ReplyBuilder.BuildSchemaWithoutData();
```

**Enums** — always declare as a TypeScript `enum` at file scope, then reference with `Type.Enum(...)`:

```typescript
enum NoteVisibility {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE"
}
// then in body:
visibility: Type.Enum(NoteVisibility)
```

Never use an inline object like `Type.Enum({ PUBLIC: "PUBLIC" })`.

### Interface

```typescript
export interface IPostShipmentNoteRoute extends RouteGenericInterface {
    Params: Static<typeof params>;      // if params exist
    Querystring: Static<typeof query>;  // if query exists
    Body: Static<typeof body>;          // if body exists (POST/PUT/PATCH)
    Reply: Static<typeof reply>;        // always
}
```

Pattern: `I{PascalVerb}{PascalLeafName}Route`

### Controller export

```typescript
export const PostShipmentNoteController: DefaultController<IPostShipmentNoteRoute> = {
    schema: SchemaBuilder.Create((builder) => {
        builder.AddParams(params);      // if params
        builder.AddQueryString(query);  // if query
        builder.AddBody(body);          // if body
        builder.AddResponse(reply);
    }),
    handler: async (
        request: FastifyRequest<IPostShipmentNoteRoute>,
        reply: FastifyReply<IPostShipmentNoteRoute>
    ) => {
        const userId = request.getDecorator<number>("userId");

        // --- permission check (if required) ---
        const permission = await request.server.permission(request, "ResourceName");
        const permissionMap = new Map(permission.permission.map((perm) => [perm.action, perm]));
        if (!permissionMap.has("view")) {
            throw new ForbiddenError("You do not have permission");
        }

        // TODO: add business logic here
        // const data = await someRPC.procedure.query({ ... });

        // Returns data:
        const payload = ReplyBuilder.BuildPayloadWithData(data, "Post shipment note successfully");
        reply.status(StatusCodes.OK).send(payload);

        // No data:
        const payload = ReplyBuilder.BuildPayloadWithoutData("Post shipment note successfully");
        reply.status(StatusCodes.OK).send(payload);
    }
};
```

- Omit the permission block entirely if not needed
- Leave a `// TODO: add business logic here` comment in the handler so the developer knows where to start
- Success message pattern: `"{PascalVerb} {resource description} successfully"`
- The `: DefaultController<...>` annotation can be omitted on controllers without permission checks

## Step 3 — Generate the route file

### Adding to an existing route file — produce only the new lines:

```typescript
// imports to add:
import {
    PostShipmentNoteController,
    IPostShipmentNoteRoute
} from "../controllers/shipment/post-shipment-note.controller";

// route line to add inside the function:
fastify.post<IPostShipmentNoteRoute>("/api/v1/shipment/:id/note", PostShipmentNoteController);
```

### New route file — produce the full file:

```typescript
import { FastifyInstance } from "fastify";

import authentication from "../plugins/authenticate.plugin";
import {
    PostShipmentNoteController,
    IPostShipmentNoteRoute
} from "../controllers/shipment/post-shipment-note.controller";

export default async function (fastify: FastifyInstance) {
    fastify.register(authentication); // remove only if this is a public/no-auth route

    fastify.post<IPostShipmentNoteRoute>("/api/v1/shipment/:id/note", PostShipmentNoteController);
}
```

Route files are auto-loaded by `@fastify/autoload` — no manual registration needed.

## Step 4 — Present the output

Show the generated code in clearly labelled TypeScript code blocks, then briefly state:
- File path for the controller
- Which route file to update (and the exact lines to add), or the path for the new route file

Offer to write the files directly to the workspace (`apps/gateway-service/src/app/`) if the user wants.

---

## Naming quick-reference

| Artifact | Pattern | Example |
|---|---|---|
| Controller file | `{verb}-{leaf}.controller.ts` | `post-shipment-note.controller.ts` |
| Controller export | `{PascalVerb}{PascalLeaf}Controller` | `PostShipmentNoteController` |
| Interface | `I{PascalVerb}{PascalLeaf}Route` | `IPostShipmentNoteRoute` |
| Route file | `{resource}.route.ts` | `shipment.route.ts` |
| Controller folder | `controllers/{resource}/` | `controllers/shipment/` |
