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
