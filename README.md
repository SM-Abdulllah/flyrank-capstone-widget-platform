# Embeddable Widget & Lead-Capture Platform

A FlyRank Backend Development Track capstone: a multi-tenant backend that lets widget owners create lead-capture widgets, gives them a one-line embed script, accepts public submissions from customer websites, validates and protects those submissions, enriches them when possible, stores them in PostgreSQL, and exposes tenant-scoped dashboard APIs.

## Key Features

- Local JWT authentication with seeded demo owner accounts.
- Tenant-scoped widget CRUD with repository-level `tenant_id` constraints.
- Public versioned widget bundle at `/widget.v1.js`.
- Public safe widget config endpoint with short cache headers.
- Plain HTML customer demo site served from a second origin.
- Public `/submissions` endpoint with CORS preflight support.
- Zod boundary validation, configured-field validation, and JSON error handling.
- 16kb request body limit with clean `413` JSON responses.
- Honeypot spam control.
- Public submission rate limiting using `express-rate-limit`.
- Idempotent lead storage with `UNIQUE(widget_id, idempotency_key)`.
- IP geo enrichment with Provider A -> Provider B -> null fallback.
- Background notification jobs with retries, capped attempts, and failure alerts.
- Authenticated dashboard APIs for submissions and aggregate stats.

## Architecture

```text
Widget Owner
   |
   | Bearer JWT
   v
Admin API (/auth, /api/widgets)
   |
   v
Services
   |
   v
Repositories
   |
   v
PostgreSQL

Customer Site :5500
   |
   | <script src="http://localhost:3000/widget.v1.js?id=...">
   v
API :3000
   |
   +--> GET /widgets/:publicId/config
   |
   +--> POST /submissions
          |
          +--> Zod request validation
          +--> honeypot spam check
          +--> rate limiting
          +--> idempotency check
          +--> geo provider A -> provider B -> null
          +--> PostgreSQL
          +--> enqueue background job

Worker
   |
   v
jobs table -> notification side effect -> retry or alert

Owner Dashboard API
   |
   v
tenant-scoped submissions + stats
```

## Technology Stack

- JavaScript
- Node.js
- Express
- PostgreSQL
- Docker and Docker Compose
- Zod
- bcryptjs
- jsonwebtoken
- express-rate-limit
- cors
- helmet
- node:test and supertest

## Setup

```bash
git clone https://github.com/SM-Abdulllah/flyrank-capstone-widget-platform.git
cd flyrank-capstone-widget-platform
cp .env.example .env
docker compose up --build
```

In a second terminal, seed demo tenants and widgets:

```bash
docker compose exec api npm run seed
```

Run the deterministic test suite:

```bash
docker compose exec api npm test
```

Run a small smoke check against a running stack:

```bash
docker compose exec api npm run verify
```

If ports are already taken locally, override host ports without changing container ports:

```bash
API_HOST_PORT=3001 DEMO_HOST_PORT=5501 PUBLIC_BASE_URL=http://localhost:3001 docker compose up --build
```

On PowerShell:

```powershell
$env:API_HOST_PORT="3001"; $env:DEMO_HOST_PORT="5501"; $env:PUBLIC_BASE_URL="http://localhost:3001"; docker compose up --build
```

## Environment

Copy `.env.example` to `.env` for local development. Safe development defaults are included.

Important variables:

- `PORT`: API port inside the container.
- `API_HOST_PORT`: host port mapped to the API.
- `DEMO_HOST_PORT`: host port mapped to the static demo site.
- `DATABASE_URL`: PostgreSQL connection string for API and worker.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: local database settings.
- `JWT_SECRET`: local token signing secret. Replace it locally.
- `GEO_PROVIDER_A_MODE`, `GEO_PROVIDER_B_MODE`: `real`, `success`, or `fail`.
- `SIDE_EFFECT_MODE`: `success` or `fail`.
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`: public submission rate limit settings.
- `PUBLIC_BASE_URL`: base URL used when generating embed snippets.
- `BODY_LIMIT`: Express JSON body limit, default `16kb`.

Never commit `.env`.

## Demo Accounts

These are development-only seeded credentials:

- Tenant A: `owner-a@example.com` / `Password123!`
- Tenant B: `owner-b@example.com` / `Password123!`

Seeded public widgets:

- Tenant A: `tenant-a-demo-signup`
- Tenant B: `tenant-b-demo-contact`

## URLs

- API: `http://localhost:3000`
- Demo customer site: `http://localhost:5500`
- Demo embed snippet:

```html
<script src="http://localhost:3000/widget.v1.js?id=tenant-a-demo-signup"></script>
```

## API Reference

### Auth

`POST /auth/login`

```json
{
  "email": "owner-a@example.com",
  "password": "Password123!"
}
```

Returns a Bearer JWT with `sub` and `tenant_id` claims.

### Widget CRUD

All widget management routes require:

```http
Authorization: Bearer <token>
```

`POST /api/widgets`

```json
{
  "type": "signup",
  "title": "Newsletter",
  "description": "Get updates",
  "fields": [
    { "name": "name", "label": "Name", "type": "text", "required": true, "maxLength": 80 },
    { "name": "email", "label": "Email", "type": "email", "required": true, "maxLength": 120 }
  ],
  "button_text": "Join",
  "display_options": { "theme": "light", "placement": "inline" }
}
```

Other widget routes:

- `GET /api/widgets`
- `GET /api/widgets/:id`
- `PUT /api/widgets/:id`
- `DELETE /api/widgets/:id`

Widget responses include `embed_snippet`.

### Public Widget Delivery

- `GET /widget.v1.js?id=<public_id>`
- `GET /widgets/:publicId/config`

The JavaScript bundle is versioned and long-lived cached:

```http
Cache-Control: public, max-age=31536000, immutable
```

Widget config is short-lived cached:

```http
Cache-Control: public, max-age=60, stale-while-revalidate=30
```

Public config returns only safe fields needed to render the widget.

### Public Submissions

`OPTIONS /submissions` handles browser preflight.

`POST /submissions`

```json
{
  "public_id": "tenant-a-demo-signup",
  "idempotency_key": "client-generated-retry-key",
  "submitted_data": {
    "name": "Ada Lovelace",
    "email": "ada@example.com"
  },
  "website": ""
}
```

`website` is the honeypot field rendered by the widget. Humans leave it empty. Filled honeypot submissions are accepted but not stored.

### Dashboard

All dashboard routes require a Bearer JWT.

- `GET /api/dashboard/submissions`
- `GET /api/dashboard/submissions?widget_id=<uuid>&from=<iso>&to=<iso>&limit=50&offset=0`
- `GET /api/dashboard/stats`

Stats include total submissions, submissions by widget, submissions over time, and country breakdown.

## Validation

Zod validates auth payloads, widget payloads, dashboard query filters, and public submission request shape. Submission service validation then checks the submitted fields against the stored widget configuration, including required fields, string types, email format, length limits, and unknown fields.

Malformed JSON, schema failures, configured-field failures, oversized bodies, auth failures, not-found resources, and rate limits all return JSON errors.

## CORS

Public widget delivery, public config, and public submissions use broad CORS without credentials because the widget runs on customer sites. Authenticated owner APIs use Bearer JWTs and are logically separate from the public browser path.

## Rate Limiting

The public submission endpoint uses `express-rate-limit`, keyed by visitor IP, with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` configurable for deterministic testing.

## Geo Fallback

`geoService` supports:

- `real`: free no-key provider calls.
- `success`: deterministic local provider result.
- `fail`: deterministic provider failure.

The submission path tries Provider A, then Provider B, then stores the submission with null geo fields if both fail.

## Background Jobs

Submissions enqueue notification jobs after successful storage. The worker claims pending jobs with `FOR UPDATE SKIP LOCKED`, processes the notification side effect, retries failures with capped attempts, stores `last_error`, and logs an alert when retries are exhausted.

## Tenant Isolation

The verified JWT supplies `req.user.tenantId`. Authenticated repositories constrain SQL with that tenant ID, for example widget reads and updates use `WHERE id = $1 AND tenant_id = $2`. Tenant IDs from client bodies or query strings are not trusted for authorization.

## Idempotency

`submissions` has a unique constraint on `(widget_id, idempotency_key)`. A repeated submission with the same key returns the existing row and does not duplicate storage or enqueue a second job.

## Evidence

See `EVIDENCE.md` for real command output from Docker, curl, browser verification, database queries, and the automated test suite.

## Runtime AI Cost

Runtime AI calls: 0.

Runtime AI cost: $0.

Budget guard: runtime AI is disabled; the product does not call AI APIs.

Development-time AI assistance is recorded honestly in `BUILDLOG.md`.

## Limitations

- Runs locally; no production hosting or real CDN is included.
- The versioned widget bundle is served by Express, not a CDN.
- The rate limiter uses local process memory.
- The notification side effect is simulated with console logging.
- The widget UI is intentionally minimal.
- There is no full frontend dashboard.
- Local JWT auth is a capstone demo, not a production identity platform.
- Real geo providers are free, no-key development services and should not be used as production dependencies without review.

