# StravaSticker Backend

Backend service for StravaSticker MVP.

This repository is focused on extracting running stats from uploaded Strava sticker screenshots, storing results, and serving data for frontend sticker rendering.

## Project Status
- MVP in active development.
- Running activity only.
- Frontend generates visual sticker templates.
- Backend handles auth, upload, OCR, persistence, and activity updates.

## Stack
- Runtime: Node.js (NestJS 11, TypeScript)
- Database: PostgreSQL
- ORM: Drizzle ORM + drizzle-kit
- Storage: Cloudflare R2 (S3-compatible)
- OCR: Mistral OCR API (`/v1/ocr`)
- Auth: Google Sign-In + JWT (access/refresh with rotation)
- Logging: JSON logs with request ID (`x-request-id`)

## Prerequisites
Before starting development, make sure you have:
- Node.js 20+
- npm 10+
- PostgreSQL 15+ (local or remote)
- Cloudflare R2 bucket + credentials
- Google OAuth client credentials
- Mistral API key

## Initial Setup
1. Clone and install dependencies.

```bash
npm install
```

2. Copy env template.

```bash
cp .env.example .env
```

3. Fill `.env` values (at minimum):
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `MISTRAL_API_KEY`

4. Create/generate DB migration and apply.

```bash
npm run db:generate
npm run db:migrate
```

5. Start dev server.

```bash
npm run start:dev
```

Default port: `3000`.

## Development Workflow
Typical flow when working on a feature:
1. Pull latest branch.
2. Update schema (`src/database/schema.ts`) if needed.
3. Run migration commands.
4. Implement module/controller/service changes.
5. Run quality checks:

```bash
npm run lint
npm run build
```

6. Manual test endpoints (MVP uses manual QA, no automated tests yet).

## Repository Structure
- `src/app-logger/`: custom JSON logger
- `src/common/`: shared middleware, guards, interceptors, filters, types, utils
- `src/auth/`: Google sign-in + refresh token flow
- `src/uploads/`: R2 presign and upload completion
- `src/ocr/`: Mistral OCR integration and extraction flow
- `src/activities/`: activity read/update endpoints
- `src/database/`: Drizzle schema + DB service
- `src/storage/`: R2 service wrapper
- `docs/plans/`: product and implementation plans

## Conventions
### 1) Request ID and Logging
- Every request gets `x-request-id` (UUIDv7).
- Logs are JSON and include request metadata.
- Sensitive fields are redacted in error logs.

### 2) IDs
- Use UUIDv7 for generated IDs.

### 3) Naming
- API payloads use `camelCase`.
- DB columns use `snake_case` (via Drizzle mapping).

### 4) Auth
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- Refresh token rotation is enabled.

## Commands
```bash
npm run start:dev      # run in watch mode
npm run build          # compile TS
npm run lint           # lint + autofix
npm run db:generate    # generate drizzle migration
npm run db:migrate     # apply drizzle migrations
```

## Manual QA (MVP)
Minimum checks before opening PR:
- Google sign-in works.
- Upload presign + complete works.
- OCR extraction stores activity + uploads running path image.
- Activity update works for OCR correction.
- Activity detail/history endpoints return expected data.
- Lint and build pass.

## Collaboration Notes
- Keep changes scoped and modular.
- Prefer updating plan docs when changing behavior:
  - `docs/plans/0_init.md`
  - `docs/plans/1_mvp_tasks.md`
- If you change schema or env requirements, update:
  - `src/database/schema.ts`
  - `.env.example`
  - this README

## Current Gaps (Expected for MVP)
- Automated unit/integration/e2e tests are deferred.
- Security hardening (rate limits/quotas) is partially planned.
- Deployment docs are baseline only (VPS setup to be finalized).
