---
name: neolink-gatekeeper-expert
description: Use this skill whenever working on neolink-gatekeeper — the shared identity, auth, and IAM service for Neolink and Hive. Triggers on mentions of gatekeeper, sign-in/sign-out, refresh token, access token, session, RSA key / KMS, service account / SA signature, policy permissions, navigation, and paths under `handler/`, `route/`, `repository/`, `middleware/`, `util/`, `connection/`, or `db/` in this repo. Covers house conventions, module ownership, tenant wiring, auth flavours, and known gotchas.
---

# neolink-gatekeeper — house conventions

## Stack

Go 1.24 service built on Gin, layered by package (`route → handler → repository → db`). Persists to three stores per tenant: MSSQL (`go-mssqldb`) for users/keys/offices, MongoDB (`mongo-driver/v2`) for policies/logs/reset tokens, Redis (`go-redis/v9`) for sessions. A third "core" Mongo holds `ServiceAccount`. AWS KMS wraps user private keys, HashiCorp Vault loads secrets on boot, SendGrid sends transactional email. Single Alpine container; manifests live in an external repo and are deployed via ArgoCD.

## Where things live

| Module | Type | Purpose | Deep brain |
|--------|------|---------|------------|
| `main.go` + `connection/` | entry | boot, Vault, env check, compose all route groups | `.claude/rules/connection.md` |
| `db/` | infra | MSSQL / Mongo / Redis connector factories (Neolink, Hive, Core) | `.claude/rules/db.md` |
| `middleware/` | infra | JWT / internal-token / SA-signature auth, correlation-id logger, recovery | `.claude/rules/middleware.md` |
| `route/` | wiring | thin Gin route registration per domain | `.claude/rules/route.md` |
| `handler/` | domain | HTTP handlers (auth, account, iam, navigation, info, sa, public) | `.claude/rules/handler.md` |
| `repository/` | data | MSSQL + Mongo + Redis access per tenant | `.claude/rules/repository.md` |
| `entity/` | types | shared domain types (`UserDocument`, `UserAuthRecord`, `UserSession`, `Service`, `ServiceAccountDocument`) | `.claude/rules/entity.md` |
| `model/` | types | HTTP DTOs with `binding:` validator tags | `.claude/rules/model.md` |
| `util/` | primitives | RSA / AES-GCM / argon2 / JWT / KMS, shared auth validators | `.claude/rules/util.md` |
| `validator/` | infra | custom gin-binding rules (`username`, `password*`) | `.claude/rules/validator.md` |
| `presenter/` | infra | canonical response envelope builders | `.claude/rules/presenter.md` |

## House conventions

- **Tenant isolation.** Two tenants (`neolink`, `hive`) each have their own MSSQL + Mongo + Redis. Route prefixes: `/neolink/v1`, `/api/neolink/v1`, `/internal/api/neolink/v{1,2}` and the `/hive/...` mirror. Every repo, middleware, and handler is constructed **per tenant** in `connection.go` with that tenant's handles — never cross-wire them.
- **Three auth flavours.** `AuthenticateAPIs` (user JWT + Redis session), `AuthenticateInternalAPI` (static `GATEKEEPER_INTERNAL_API_TOKEN` + `X-User-Id`), `AuthenticationMiddlewareV2.AuthenticateInternalAPI` (service-account RSA signature over `serviceID||timestamp`). Pick the group in `connection.go`; never attach middleware inside `route/`.
- **Session contract.** Redis key = `argon2(publicKeyPEM):argon2(sessionUUID)`. Value = `gzip(JSON(entity.UserSession))`. Stored `PrivateKey` is `base64(AES-GCM(KMS-decrypted private PEM))`. Any change to the argon2 params is a universal logout event.
- **Response envelope.** Every handler returns via `presenter/Success*` or `presenter/Error*`. Error bodies carry a 4-digit `code`: `4000` validation, `4010` unauthorized, `4030` forbidden, `41xx` service-account, `5000` internal. The frontend depends on this exact shape.
- **Crypto paths don't mix.** Refresh tokens → RSA-OAEP/SHA-256. SA signatures → RSA-PKCS1v15/SHA-256. Session private-key wrap → AES-GCM. Keying / hashing identifiers → argon2id via `util.EncryptArgon2`. All JWTs use HS256 with `ENCRYPT_SECRET_KEY`.
- **Correlation IDs.** `middleware.Logger` sets `c.Set("correlation_id", uuid)` and the `X-Correlation-ID` response header. Any write path with rollback (`AccountRepository.CreateAccount`) must propagate it for zerolog.
- **Config via env.** All secrets live in `os.Getenv`; `main.checkEnvVars` is the single required-vars list. Vault optional via `VAULT_TOKEN` + `VAULT_ADDR`. Skip new `init()` env checks — the commented-out ones in `db/` are intentionally dead.
- **Timeouts.** MSSQL queries run under `context.WithTimeout(5s)`. Health checks fan out under `10s`.
- **Validation.** Password fields use `min=8,max=50,passwordAllowedPasswordChar,passwordContainSpecialChar`; username fields use the custom `username` validator. New request models reuse these exact chains so the frontend copy stays consistent.
- **Commit style.** Lowercase conventional (`fix:`, `feat:`), branches like `fix/...`, `feat/...`, merged via PR.

## Common gotchas

- **Mixing tenant handles silently breaks session lookup.** `AuthenticateAPIs` on `/api/neolink/*` must use `NeolinkRedis`; same for Hive. Double-check the group that middleware is attached to in `connection.go` when adding authenticated routes.
- **Token version reuse detection is currently disabled** in `handler/auth.go#validateAndCompareVersion` (commented out). Don't re-enable without rotating every live refresh token.
- **Rollback is partial.** `AccountRepository.CreateAccount` only rolls back the `dbo.app_user` SQL row; `app_user_key` rows and Mongo inserts after the keypair step are not cleaned up. Review ordering before inserting new steps.
- **`RevokeSessionsByPublicKey` uses `SCAN`** — safe but O(keyspace); only call it for explicit password changes or admin revocations.
- **BSON field name drift.** `UserDocument.userID` is the tag, but some write-path queries in `repository/account.go` use `{"userId": id}` (lowercase-d). Mongo is case-sensitive — fix at the query site, match what's on disk.
- **`extractTokenFromHeader` is duplicated** in `middleware/authenticate.go` and `util/sa.go`. Changes must be applied to both.
- **SendGrid template IDs are hard-coded** in `handler/account.go` and the reset-password flow. New templates go in code, not config.
- **`MAPBOX_TOKEN` and `INFORMATION_TOKEN`** are handed out via the refresh-token response (`AuthAccessTokenResponse.MapboxToken` / `InformationToken`) — treat those as semi-public session scratchpads.
- **`ENCRYPT_SYMMETRIC_KEY` must be exactly 32 bytes.** Length check is commented out; `main.checkEnvVars` only checks presence.
- **KMS uses static creds** from `AWS_ACCESS_KEY_ID/SECRET`. Don't swap to IAM roles without confirming with platform.
- **`clearAuthCookies` misses `SameSite` on the session cookie** in non-prod — mirror the existing behaviour when touching this code, don't silently "fix" it.

## When to dig deeper

- Module-specific work → read `.claude/rules/<module>.md`
- Feature precedent → check `.claude/features/*/outcome.md` for prior similar work
- Architecture context → `.claude/CLAUDE.md`

## Related subagents

- `neolink-gatekeeper-expert` (this repo) — opus expert; invoke by name for tricky auth, tenancy, or crypto problems
- `deploy-captain` — for image-tag bumps and ArgoCD syncs; never edits this repo directly
- Generalist teammates (`backend-implementer`) — for routine CRUD / glue work
