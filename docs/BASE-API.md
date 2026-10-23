# Core API foundation

## Database and migrations

The API uses PostgreSQL through Prisma. Versioned migrations live in `apps/api/prisma/migrations`; the API container runs `prisma migrate deploy` before starting the server. Do not use `prisma db push` against the deployed database.

The first migration establishes tenant-scoped records for tenants, users, memberships, contacts, conversations, messages and audit events. Application queries must always be scoped by the authenticated tenant ID. The API guard rechecks active user membership on protected requests so revoked memberships stop working before the access token expires.

## Authentication endpoints

All routes use the `/api` prefix.

- `POST /api/auth/register`: create a workspace, owner account and membership atomically.
- `POST /api/auth/login`: authenticate an email/password against the requested `tenantSlug`.
- `GET /api/auth/me`: return the current user, workspace and role; requires `Authorization: Bearer <accessToken>`.

Registration fields: `tenantName`, `name`, `email`, `password`. Passwords require at least 12 characters and are stored as bcrypt hashes. Access tokens expire after 8 hours.

## Required deployment setting

Set `JWT_ACCESS_SECRET` in Dokploy to a randomly generated secret with at least 32 bytes. Generate one with `openssl rand -base64 48`. Do not commit the generated value or use the CI-only example secret in production.

Before enabling customer registration publicly, add rate limiting and an explicit onboarding policy (open signup vs. invitation). This first implementation intentionally does not create a refresh-token session yet; users must log in again when the access token expires.

## WhatsApp via WAHA

Configure `WAHA_BASE_URL` and `WAHA_API_KEY` in the private Dokploy environment. Keep the WAHA service and its API key off the public internet. Set `PUBLIC_APP_URL` to the public Véxora app origin so WAHA can send events through the web application's signed webhook proxy.

- `POST /api/channels/waha` with `{ "name": "WhatsApp principal" }`: create a tenant-isolated session and register the signed webhook.
- `GET /api/channels`: list this company's channels.
- `GET /api/channels/:id/status`: check connection status.
- `GET /api/channels/:id/qr`: retrieve the QR image while the session requests pairing.
- `POST /api/channels/:id/connect`: configure/start the session again.
- `POST /api/conversations/:id/messages` with `{ "content": "..." }`: send a text message and persist its status.
- `GET /api/events`: receive tenant-filtered server-sent events, including inbound messages and send status changes.

Incoming WAHA messages are deduplicated by provider message ID, persisted before an event is published, and ignored for groups/status broadcasts. The first release stores media metadata but does not yet download/serve media attachments. SSE events are process-local for now, so keep one API replica until Redis-backed event fan-out is introduced.
