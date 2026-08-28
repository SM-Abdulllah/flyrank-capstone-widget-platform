# Evidence

This file contains observed evidence from the local verification run. The normal clean-clone defaults are API `http://localhost:3000` and demo site `http://localhost:5500`. During this run, host port `3000` was already occupied by an unrelated local container, so HTTP/browser evidence used API `http://localhost:3001` and a temporary second origin `http://127.0.0.1:5502`. The Docker services still ran with the API container listening on port `3000`.

## Submission Pack

Requirement: required files exist.

Command/test used:

```powershell
$files = @('README.md','DESIGN.md','capstone.yaml','EVIDENCE.md','BUILDLOG.md','.env.example','.gitignore','LICENSE','Dockerfile','docker-compose.yml','package.json','package-lock.json')
foreach ($file in $files) { if (Test-Path $file) { "FOUND $file" } else { "MISSING $file" } }
foreach ($dir in @('migrations','src','demo-site','tests','scripts')) { if (Test-Path $dir) { "FOUND $dir/" } else { "MISSING $dir/" } }
```

Actual output:

```text
FOUND README.md
FOUND DESIGN.md
FOUND capstone.yaml
FOUND EVIDENCE.md
FOUND BUILDLOG.md
FOUND .env.example
FOUND .gitignore
FOUND LICENSE
FOUND Dockerfile
FOUND docker-compose.yml
FOUND package.json
FOUND package-lock.json
FOUND migrations/
FOUND src/
FOUND demo-site/
FOUND tests/
FOUND scripts/
```

Conclusion: all required submission pack files and directories exist.

## Docker Compose Stack

Requirement: one Docker Compose stack provides API, PostgreSQL, worker, and second-origin demo site.

Command/test used:

```bash
API_HOST_PORT=3001 DEMO_HOST_PORT=5501 PUBLIC_BASE_URL=http://localhost:3001 docker compose up --build -d
docker compose ps
```

Actual output:

```text
NAME               IMAGE                SERVICE     STATUS                    PORTS
work-api-1         work-api             api         Up 28 seconds             0.0.0.0:3001->3000/tcp
work-db-1          postgres:16-alpine   db          Up 46 seconds (healthy)   0.0.0.0:5432->5432/tcp
work-demo-site-1   nginx:1.27-alpine    demo-site   Up 26 seconds             0.0.0.0:5501->80/tcp
work-worker-1      work-worker          worker      Up 28 seconds             3000/tcp
```

Conclusion: all four required services started and PostgreSQL reported healthy.

## Migrations

Requirement: schema is reproducible from SQL migrations and includes required tables.

Command/test used:

```bash
docker compose logs --tail=60 api worker
docker compose exec -T db psql -U postgres -d widget_platform -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('tenants','users','widgets','submissions','jobs','schema_migrations') ORDER BY tablename;"
```

Actual output:

```text
api-1     | > node src/db/migrate.js
api-1     | Migrations complete
worker-1  | > node src/db/migrate.js
worker-1  | Migrations complete

     tablename
-------------------
 jobs
 schema_migrations
 submissions
 tenants
 users
 widgets
(6 rows)
```

Conclusion: the API and worker run migrations, and the required tables exist.

## Indexes And Idempotency Constraint

Requirement: useful indexes and idempotency uniqueness exist.

Command/test used:

```bash
docker compose exec -T db psql -U postgres -d widget_platform -c "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('widgets','submissions','jobs') ORDER BY tablename, indexname;"
```

Actual output:

```text
  tablename  |                 indexname
-------------+-------------------------------------------
 jobs        | idx_jobs_status_run_at
 jobs        | idx_jobs_tenant_id
 jobs        | jobs_pkey
 submissions | idx_submissions_created_at
 submissions | idx_submissions_tenant_id
 submissions | idx_submissions_widget_id
 submissions | submissions_pkey
 submissions | submissions_widget_id_idempotency_key_key
 widgets     | idx_widgets_public_id
 widgets     | idx_widgets_tenant_id
 widgets     | widgets_pkey
 widgets     | widgets_public_id_key
(12 rows)
```

Conclusion: tenant/widget/submission/job indexes exist, including the submission idempotency unique rule.

## Seed Command

Requirement: deterministic seed command creates two tenants and demo widgets.

Command/test used:

```bash
docker compose exec -T api npm run seed
```

Actual output:

```text
> flyrank-capstone-widget-platform@1.0.0 seed
> node scripts/seed.js

Seed complete
Tenant A: owner-a@example.com / Password123!
Tenant B: owner-b@example.com / Password123!
Tenant A widget public id: tenant-a-demo-signup
Tenant B widget public id: tenant-b-demo-contact
```

Conclusion: repeatable demo data exists for tenant-isolation proof.

## Automated Test Suite

Requirement: deterministic tests cover critical acceptance behavior.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
TAP version 13
ok 1 - widget API rejects unauthenticated requests and supports authenticated CRUD
ok 2 - tenant isolation prevents cross-tenant widget and dashboard access
ok 3 - public config and versioned bundle expose safe cacheable responses
ok 4 - submission endpoint handles CORS preflight, malformed JSON, and oversized payloads
ok 5 - honeypot blocks storage and idempotency prevents duplicate rows
ok 6 - geo enrichment stores provider A data, falls back to B, and degrades to null
ok 7 - public submission rate limit returns 429 and service remains healthy afterward
ok 8 - side-effect failure does not roll back submission and worker records retries
1..8
# tests 8
# pass 8
# fail 0
```

Conclusion: the deterministic suite passed inside Docker.

## Final Live HTTP Smoke

Requirement: running API accepts the main evaluator flow over HTTP.

Command/test used:

```powershell
$base = 'http://localhost:3001'
$origin = 'http://127.0.0.1:5502'
# login, bundle header, config header, OPTIONS /submissions,
# POST /submissions, then GET /api/dashboard/submissions
```

Actual output:

```text
--- login ---
token_length=256
--- bundle header ---
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/javascript; charset=utf-8
--- config header ---
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60, stale-while-revalidate=30
{"id":"tenant-a-demo-signup","type":"signup","title":"Join Tenant A",...}
--- preflight ---
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,X-Request-Id
--- submit ---
HTTP/1.1 201 Created
Access-Control-Allow-Origin: *
{"accepted":true,"stored":true,"duplicate":false,"submission":{"id":"153d740d-99fa-4399-94fb-5275cc5cb045","widget_id":"tenant-a-demo-signup","geo_provider":"provider_a","country":"Pakistan","city":"Lahore","created_at":"2026-08-28T13:45:29.065Z"}}
--- dashboard contains key ---
dashboard_contains=final-smoke-20260828184529
```

Conclusion: the live API completed login, public delivery, CORS preflight, public submission, geo enrichment, and dashboard visibility.

## Authentication And Widget CRUD

Requirement: widget management APIs require auth and support full CRUD.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
ok 1 - widget API rejects unauthenticated requests and supports authenticated CRUD
```

Conclusion: unauthenticated requests are rejected; authenticated create/list/read/update/delete behavior passed.

## Tenant Isolation

Requirement: Tenant B cannot read, update, delete, or dashboard Tenant A data.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
ok 2 - tenant isolation prevents cross-tenant widget and dashboard access
```

Manual dashboard evidence:

```text
--- Tenant A dashboard submissions ---
{"submissions":[{"id":"d3fc0b04-56dc-4da0-b359-64ad960564a6","tenant_id":"11111111-1111-4111-8111-111111111111","widget_id":"aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa","widget_title":"Join Tenant A","idempotency_key":"manual-valid-1","submitted_data":{"name":"Manual Proof","email":"manual-proof@example.com"},"ip_address":"::ffff:172.20.0.1","country":null,"city":null,"geo_provider":null,"created_at":"2026-08-28T08:38:52.958Z"}]}

--- Tenant B dashboard submissions ---
{"submissions":[]}
```

Conclusion: tenant-scoped SQL prevents cross-tenant access.

## Embed Snippet

Requirement: widgets expose a one-line embed snippet.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
ok 1 - widget API rejects unauthenticated requests and supports authenticated CRUD
```

The test asserts that the created widget response contains:

```text
widget.v1.js?id=
```

Conclusion: widget owner responses include the one-line script URL.

## Widget Bundle Cache Header

Requirement: versioned bundle has long immutable cache headers.

Command/test used:

```bash
curl -I "http://localhost:3001/widget.v1.js?id=tenant-a-demo-signup"
```

Actual output:

```text
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/javascript; charset=utf-8
```

Conclusion: `/widget.v1.js` is versioned and long-lived cached.

## Public Config Cache Header And Safety

Requirement: public config is unauthenticated, safe, and short-lived cached.

Command/test used:

```bash
curl -i -H "Origin: http://127.0.0.1:5502" "http://localhost:3001/widgets/tenant-a-demo-signup/config"
```

Actual output:

```text
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60, stale-while-revalidate=30

{"id":"tenant-a-demo-signup","type":"signup","title":"Join Tenant A","description":"A demo signup widget for the FlyRank capstone.","fields":[{"name":"name","type":"text","label":"Name","required":true,"maxLength":80},{"name":"email","type":"email","label":"Email","required":true,"maxLength":120}],"button_text":"Join now","display_options":{"theme":"light","placement":"inline"}}
```

Conclusion: public config exposes only render-safe widget configuration and has short cache headers.

## CORS Preflight

Requirement: browser preflight for public submissions succeeds.

Command/test used:

```bash
curl -i -X OPTIONS "http://localhost:3001/submissions" -H "Origin: http://127.0.0.1:5502" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type"
```

Actual output:

```text
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,X-Request-Id
```

Conclusion: preflight is handled with the required public CORS headers.

## Browser Second-Origin Render

Requirement: widget renders and submits from a different origin without CORS errors.

Command/test used:

In-app browser loaded `http://127.0.0.1:5502/`, a temporary second-origin page containing:

```html
<script src="http://localhost:3001/widget.v1.js?id=tenant-a-demo-signup"></script>
```

Actual output from browser automation:

```json
{
  "renderState": {
    "button": "Join now",
    "inputs": [
      { "name": "name", "type": "text" },
      { "name": "email", "type": "email" },
      { "name": "website", "type": "text", "hiddenLeft": "-10000px" }
    ],
    "title": "Join Tenant A",
    "url": "http://127.0.0.1:5502/",
    "widgetPresent": true
  },
  "logsBefore": []
}
```

After filling and submitting the browser form:

```json
{
  "submitState": {
    "statusText": "Thanks. Your submission was received.",
    "widgetPresent": true
  },
  "logsAfter": []
}
```

Conclusion: browser render, config fetch, cross-origin submission, and success feedback were verified with no console warnings or errors.

## Valid Submission And Dashboard Visibility

Requirement: valid public submissions return 2xx, store a row, and appear in the owner dashboard.

Command/test used:

```bash
curl -i -X POST "http://localhost:3001/submissions" -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:5502" -d '{"public_id":"tenant-a-demo-signup","idempotency_key":"manual-valid-1","submitted_data":{"name":"Manual Proof","email":"manual-proof@example.com"}}'
curl "http://localhost:3001/api/dashboard/submissions" -H "Authorization: Bearer <tenant-a-token>"
```

Actual output:

```text
HTTP/1.1 201 Created
Access-Control-Allow-Origin: *

{"accepted":true,"stored":true,"duplicate":false,"submission":{"id":"d3fc0b04-56dc-4da0-b359-64ad960564a6","widget_id":"tenant-a-demo-signup","geo_provider":null,"country":null,"city":null,"created_at":"2026-08-28T08:38:52.958Z"}}

{"submissions":[{"id":"d3fc0b04-56dc-4da0-b359-64ad960564a6","widget_title":"Join Tenant A","idempotency_key":"manual-valid-1","submitted_data":{"name":"Manual Proof","email":"manual-proof@example.com"}}]}
```

Conclusion: the valid lead was stored and visible to Tenant A.

## Malformed And Invalid Payloads

Requirement: malformed and invalid input return clean 4xx JSON, not 500.

Command/test used:

```bash
curl -i -X POST "http://localhost:3001/submissions" -H "Content-Type: application/json" -d '{"public_id":'
curl -i -X POST "http://localhost:3001/submissions" -H "Content-Type: application/json" -d '{"public_id":"tenant-a-demo-signup","idempotency_key":"manual-invalid-1","submitted_data":{"email":"not-an-email"}}'
```

Actual output:

```text
HTTP/1.1 400 Bad Request
{"error":{"code":"invalid_json","message":"Malformed JSON request body","request_id":"daf9efad-b656-4a3c-a51b-3640c4e79daf"}}

HTTP/1.1 400 Bad Request
{"error":{"code":"invalid_submission","message":"name is required","request_id":"862cce93-ed39-4300-84fc-a4c187440042"}}
```

Conclusion: bad public input returns clean JSON `400` responses.

## Oversized Payload

Requirement: oversized submission is rejected with a clean 4xx JSON response.

Command/test used:

```bash
curl -i -X POST "http://localhost:3001/submissions" -H "Content-Type: application/json" --data-binary @oversized-payload.json
```

Actual output:

```text
HTTP/1.1 413 Payload Too Large
{"error":{"code":"payload_too_large","message":"Payload too large","request_id":"4cc5db6b-634e-4f31-bad1-37f75066f2bb"}}
```

Conclusion: the Express body limit is enforced through the central JSON error handler.

## Rate Limit

Requirement: burst submissions produce `429` and service remains healthy.

Command/test used:

```bash
RATE_LIMIT_MAX=3 RATE_LIMIT_WINDOW_MS=5000 docker compose up -d --force-recreate api worker
for i in 0 1 2 3 4; do curl -o /dev/null -w "%{http_code}" -X POST ...; done
curl -i http://localhost:3001/health
```

Actual output:

```text
burst 0 -> 201
burst 1 -> 201
burst 2 -> 201
burst 3 -> 429
burst 4 -> 429

HTTP/1.1 200 OK
{"ok":true}

--- normal after window ---
HTTP/1.1 201 Created
{"accepted":true,"stored":true,"duplicate":false,...}
```

Conclusion: rate limiting blocks bursts, the API stays healthy, and normal traffic works after the window.

## Honeypot

Requirement: filled honeypot does not store a submission.

Command/test used:

```bash
docker compose exec -T db psql -U postgres -d widget_platform -c "DELETE FROM jobs; DELETE FROM submissions; SELECT COUNT(*) AS before_count FROM submissions;"
curl -i -X POST "http://localhost:3001/submissions" -H "Content-Type: application/json" -d '{"public_id":"tenant-a-demo-signup","idempotency_key":"manual-honeypot-1","website":"spam-filled","submitted_data":{"name":"Bot","email":"bot@example.com"}}'
docker compose exec -T db psql -U postgres -d widget_platform -c "SELECT COUNT(*) AS after_honeypot_count FROM submissions;"
```

Actual output:

```text
before_count
--------------
0

HTTP/1.1 202 Accepted
{"accepted":true}

after_honeypot_count
----------------------
0
```

Conclusion: honeypot submissions are quietly accepted but not stored.

## Idempotency

Requirement: repeated submissions with the same key do not duplicate rows.

Command/test used:

```bash
curl -i -X POST ... idempotency_key=manual-idempotent-1
curl -i -X POST ... idempotency_key=manual-idempotent-1
docker compose exec -T db psql -U postgres -d widget_platform -c "SELECT COUNT(*) AS after_idempotency_count FROM submissions;"
```

Actual output:

```text
HTTP/1.1 201 Created
{"accepted":true,"stored":true,"duplicate":false,"submission":{"id":"50b6fe8e-1a09-40d2-bd9f-bcf9188c46c3",...}}

HTTP/1.1 200 OK
{"accepted":true,"stored":true,"duplicate":true,"submission":{"id":"50b6fe8e-1a09-40d2-bd9f-bcf9188c46c3",...}}

after_idempotency_count
-------------------------
1
```

Conclusion: retries return the existing row and do not duplicate storage.

## Geo Enrichment

Requirement: Provider A success, Provider A down -> Provider B, both down -> store without geo.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
ok 6 - geo enrichment stores provider A data, falls back to B, and degrades to null
```

Manual Provider A success evidence:

```text
HTTP/1.1 201 Created
{"accepted":true,"stored":true,"duplicate":false,"submission":{"geo_provider":"provider_a","country":"Pakistan","city":"Lahore"}}
```

Automated log evidence:

```text
Geo provider failed { provider: 'fromProviderA', message: 'Provider A forced down' }
Geo provider failed { provider: 'fromProviderB', message: 'Provider B forced down' }
```

Conclusion: deterministic tests prove the full fallback chain and graceful no-geo storage.

## Side-Effect Failure And Background Job Retries

Requirement: side-effect failure does not break submission, and jobs retry with a failure alert.

Command/test used:

```bash
docker compose exec -T api npm test
```

Actual output:

```text
ok 8 - side-effect failure does not roll back submission and worker records retries

Notification job scheduled for retry {
  jobId: '8de41e72-797b-4b4a-9d87-1e0b2d25462c',
  attempts: 2,
  error: 'Notification side effect forced to fail'
}
ALERT notification job exhausted retries {
  jobId: '8de41e72-797b-4b4a-9d87-1e0b2d25462c',
  attempts: 3,
  error: 'Notification side effect forced to fail'
}
```

Worker success evidence:

```text
worker-1 | Notification side effect completed { submissionId: '889c96e6-2480-4f38-8f25-9b8ed2d94ed9', widgetPublicId: 'tenant-a-demo-signup' }
worker-1 | Notification job completed { jobId: '5cd7810f-004e-4f4b-a5f1-d10918c137bb', attempts: 1 }
```

Conclusion: submissions are stored before side effects; retries and exhausted failure alerts are implemented.

## Dashboard Aggregation

Requirement: authenticated dashboard has submissions and stats, tenant isolated.

Command/test used:

```bash
curl "http://localhost:3001/api/dashboard/stats" -H "Authorization: Bearer <tenant-a-token>"
```

Actual output:

```json
{
  "stats": {
    "total_submissions": 1,
    "submissions_by_widget": [
      { "widget_id": "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa", "title": "Join Tenant A", "count": 1 }
    ],
    "submissions_over_time": [
      { "day": "2026-08-28T00:00:00.000Z", "count": 1 }
    ],
    "country_breakdown": [
      { "country": "Unknown", "count": 1 }
    ]
  }
}
```

Conclusion: dashboard stats include totals, per-widget stats, time aggregation, and geo breakdown.

## Data Safety

Requirement: SQL uses parameterized values.

Command/test used:

```bash
rg "pool\\.query|client\\.query" src scripts
```

Actual output reviewed:

```text
src/repositories/widgetRepository.js uses placeholders such as WHERE id = $1 AND tenant_id = $2
src/repositories/submissionRepository.js uses placeholders for tenant, widget, idempotency, filters, limit, and offset
src/repositories/jobRepository.js uses placeholders for job updates and inserts
scripts/seed.js uses placeholders for seeded IDs, hashes, and JSONB payloads
```

Conclusion: user-controlled values are passed as SQL parameters, not interpolated into SQL strings.

## Secret Audit

Requirement: `.env` and secrets are not tracked.

Command/test used:

```bash
git ls-files .env
rg -n "sk-|api[_-]?key|smtp|secret|password" --glob "!package-lock.json" --glob "!EVIDENCE.md" --glob "!BUILDLOG.md"
```

Actual output:

```text
git ls-files .env
# no output
```

The search returns only safe placeholders, code identifiers such as `JWT_SECRET`, bcrypt `password_hash`, and documented demo credentials.

Conclusion: no `.env`, API key, SMTP credential, or real secret is tracked.

## Runtime AI Cost

Requirement: AI cost is tracked if AI is used.

Actual output:

```text
Runtime AI calls: 0
Runtime AI cost: $0
Budget guard: runtime AI disabled
```

Conclusion: the submitted application has no runtime AI dependency or cost.
