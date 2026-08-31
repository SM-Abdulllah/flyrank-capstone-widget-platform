# Build Log

## 2026-08-28

### Design and skeleton

- Read the attached FlyRank capstone PDF and the pasted user brief.
- Created the dedicated repository skeleton: `README.md`, `.gitignore`, `.env.example`, `LICENSE`, and `DESIGN.md`.
- Committed the design gate before substantial implementation.
- AI/Codex assistance: helped extract and summarize requirements, draft the design document, and create the first repository files.
- What needed care: the first patch landed one directory above the cloned repo; it was moved into the correct `work/` checkout before committing.
- Tested afterwards: checked `git status` and committed `Initial capstone skeleton and design`.

### Backend implementation

- Added the Node/Express application, PostgreSQL migrations, Dockerfile, Docker Compose stack, seeded demo data, tenant-scoped widget CRUD, public widget bundle, public config endpoint, public submission endpoint, dashboard routes, and notification worker.
- AI/Codex assistance: generated the layered structure and then iterated through syntax checks, Docker startup, tests, and evidence collection.
- What needed care: Docker host port `3000` was already occupied on this machine by an unrelated old container, so the compose file was adjusted to make host ports configurable while keeping clean-clone defaults at `3000` and `5500`.
- Tested afterwards:
  - `node --check` over source, scripts, and tests.
  - `docker compose up --build -d`.
  - `docker compose exec -T api npm run seed`.
  - `docker compose exec -T api npm test`.

### Verification and documentation

- Added deterministic tests for auth, widget CRUD, tenant isolation, cache headers, CORS preflight, malformed and oversized payloads, honeypot, idempotency, geo fallback, rate limiting, and side-effect failure retries.
- Used the in-app browser against a temporary second-origin page to confirm the widget rendered, submitted successfully, and produced no console errors.
- Collected curl/database outputs for `EVIDENCE.md`.
- Added a smoke script at `npm run verify`.
- AI/Codex assistance: helped write evidence and README text from real outputs.
- What needed care: host-side `npm test` attempted to connect to a conflicting local PostgreSQL listener; the final supported verification command is the Docker command in `capstone.yaml`, which ran successfully inside the API container.

## 2026-08-31

### Hosted deployment compatibility

- Added a root Express export for Vercel, `vercel.json` rewrites, and a protected cron endpoint that can process queued notification jobs on hosted deployments.
- Documented the hosted PostgreSQL, `PUBLIC_BASE_URL`, and `CRON_SECRET` settings needed for a Vercel deployment.
- Set the Vercel cron schedule to daily UTC so it deploys on Hobby projects as well as paid plans.
- Added focused test coverage for the service metadata route and cron authorization behavior.
- Tested afterwards:
  - `node --preserve-symlinks --preserve-symlinks-main --check .\index.js`
  - `node --preserve-symlinks --preserve-symlinks-main --check .\src\routes\systemRoutes.js`
  - `node --preserve-symlinks --preserve-symlinks-main --check .\src\app.js`
  - `node --preserve-symlinks --preserve-symlinks-main -e "const app = require('./index'); if (typeof app !== 'function') throw new Error('Express app was not exported'); console.log('serverless export ok')"`
  - DB-free supertest smoke for `/` and `/health`.
- What needed care: host-side Docker and local PostgreSQL were not accessible from the Codex sandbox on 2026-08-31, so the previous Docker evidence remains the acceptance baseline for the full database-backed suite.
- AI/Codex assistance: diagnosed the Vercel function crash from the deployment screenshot and adjusted the deployment entrypoint while preserving the Docker Compose evaluator path.

## AI Cost Tracking

- Runtime AI calls: 0.
- Runtime AI cost: $0.
- Budget guard: runtime AI disabled; this app does not call AI services.
- Development-time AI assistance: Codex was used through the local app. No runtime per-call product cost exists in the submitted backend. If the developer account has subscription billing for Codex/ChatGPT usage, no per-runtime capstone API cost is exposed by this application and no dollar amount is fabricated here.
