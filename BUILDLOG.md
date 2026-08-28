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

## AI Cost Tracking

- Runtime AI calls: 0.
- Runtime AI cost: $0.
- Budget guard: runtime AI disabled; this app does not call AI services.
- Development-time AI assistance: Codex was used through the local app. No runtime per-call product cost exists in the submitted backend. If the developer account has subscription billing for Codex/ChatGPT usage, no per-runtime capstone API cost is exposed by this application and no dollar amount is fabricated here.

