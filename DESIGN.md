# Design

## Problem

Customers need a small embeddable lead-capture widget they can install on any website with one script tag. The backend must treat the public internet as untrusted input: requests need validation, tenant isolation, CORS, caching, rate limiting, spam protection, graceful geo fallback, safe background side effects, and dashboard visibility.

## Main Actors

- Widget owner: authenticated tenant user who creates widgets and views submissions.
- Customer website: any external origin that embeds the public widget script.
- Website visitor: anonymous public user who submits a rendered widget form.
- Background worker: asynchronous process that handles notification side effects after storage.

## Data Models

Widget model:

- `id`, `tenant_id`, `public_id`, `type`, `title`, `description`, `fields`, `button_text`, `display_options`, `created_at`, `updated_at`.
- `fields` is constrained JSONB describing supported public form fields such as text, email, and textarea.
- `display_options` is constrained JSONB for small presentation options such as theme and placement.

Submission model:

- `id`, `tenant_id`, `widget_id`, `idempotency_key`, `submitted_data`, `ip_address`, `country`, `city`, `geo_provider`, `created_at`.
- Uniqueness on `(widget_id, idempotency_key)` makes client retries safe.

Tenant model:

- `tenants` own `users`, `widgets`, `submissions`, and `jobs`.
- Authenticated repository queries always constrain by the `tenant_id` from the verified JWT.

## Authentication

The capstone uses local seeded accounts with `bcryptjs` password hashes and `jsonwebtoken` Bearer tokens. JWT claims include `sub` and `tenant_id`. No route trusts tenant IDs from request bodies or query strings.

## API Surface

Widget owner path, authenticated admin API:

- `POST /auth/login`
- `POST /api/widgets`
- `GET /api/widgets`
- `GET /api/widgets/:id`
- `PUT /api/widgets/:id`
- `DELETE /api/widgets/:id`
- `GET /api/dashboard/submissions`
- `GET /api/dashboard/stats`

Customer website path, public delivery:

- `GET /widget.v1.js?id=<public_id>`
- `GET /widgets/:publicId/config`

Website visitor path, public submission:

- `OPTIONS /submissions`
- `POST /submissions`

## Layered Architecture

Routes handle HTTP shape and status codes. Zod schemas validate boundary inputs. Services own business flow. Repositories own SQL and tenant filtering. Middleware handles request IDs, auth, errors, CORS, body limits, and public rate limiting. The worker polls the jobs repository and runs retrying side effects outside the request path.

## Embed Flow

The owner creates a widget and receives:

`<script src="http://localhost:3000/widget.v1.js?id=<PUBLIC_ID>"></script>`

The script finds its own URL, reads `id`, derives the API origin from the script origin, fetches `/widgets/:publicId/config`, renders a form plus honeypot, and posts validated visitor data to `/submissions` with an idempotency key.

## Non-Goal

This capstone will not implement production hosting, a real CDN, or a drag-and-drop form builder.

