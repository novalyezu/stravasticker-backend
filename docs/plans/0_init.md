# StravaSticker Backend Plan (Init)

## 1) Product Goal
Build an MVP backend that lets users:
1. Sign in with Google.
2. Upload a Strava activity sticker screenshot.
3. Run OCR extraction (Mistral AI) to get structured running stats.
4. Receive extracted stats + running path image data for frontend template rendering.
5. Save and retrieve extraction results/history.

Primary MVP focus: running activities only.

## 2) MVP Scope

### In Scope
- Google OAuth sign-in.
- User profile + session/token issuance.
- Image upload to Cloudflare R2.
- OCR pipeline using Mistral AI (synchronous request/response).
- Extract these fields from sticker:
  - `distance`
  - `pace`
  - `time`
  - `activityDate` (best effort)
  - `runningPathImageBase64`
- Persist uploads, extracted stats JSON, raw stat string fields, and running path image key.
- Return OCR result to frontend for user review/edit and template rendering.
- Allow user correction of OCR-misread activity stats via update API.
- Basic rate limit and validation.
- Observability basics: logs, error tracking hooks, processing metrics.

### Out of Scope (for now)
- Other sports (cycling, swimming, hiking, etc.).
- Full design editor/canvas manipulation API.
- Social publishing integrations (Instagram APIs).
- Backend template/variant rendering logic.
- Billing/subscriptions.
- Team/shared workspace features.

## 3) Success Criteria (MVP)
- End-to-end processing success rate >= 85% for good-quality running sticker images.
- Median OCR response time after upload completion < 12 seconds.
- OCR extraction accuracy for core fields (`distance`, `pace`, `time`) >= 90% on curated validation set.
- OCR failures are returned clearly to frontend without leaving ambiguous processing state.
- All stored assets are access-controlled (no unintended public exposure).

## 4) High-Level Architecture
- **API Layer (NestJS)**
  - REST endpoints for auth, upload, OCR processing, activity retrieval.
- **Database (PostgreSQL + Drizzle ORM)**
  - Source of truth for users, uploads, and extracted activity stats.
- **Storage (Cloudflare R2)**
  - Raw uploads + running path image assets (derived from Mistral base64 output).
- **AI/OCR Integration (Mistral)**
  - OCR extraction service returning structured stats JSON + running path image base64.
- **Sync Processing (MVP)**
  - Frontend waits for OCR endpoint response (no queue/async worker in MVP).

## 5) Proposed Backend Modules (NestJS)
- `auth` module
  - Google OAuth flow, session/JWT issuance, guards.
- `users` module
  - User profile, preferences, plan-ready flags.
- `uploads` module
  - Signed upload URL creation, metadata validation, upload registration.
- `activities` module
  - Activity entity + extraction result persistence.
- `ocr` module
  - Mistral client wrapper, prompt template, parser/extraction, running-path image handling.
- `health` module
  - Health/readiness checks (DB, R2, Mistral connectivity check endpoint).

## 6) Data Model (Initial)

### `users`
- `id` (uuid, pk)
- `google_sub` (unique)
- `email` (unique)
- `name`
- `avatar_url`
- `created_at`, `updated_at`

### `sessions` (if DB-backed refresh tokens)
- `id` (uuid, pk)
- `user_id` (fk -> users)
- `refresh_token_hash`
- `expires_at`
- `created_at`

### `uploads`
- `id` (uuid, pk)
- `user_id` (fk -> users)
- `key` (unique)
- `file_name`
- `mime_type`
- `file_size`
- `status` (`uploaded`, `processing`, `processed`, `failed`)
- `created_at`, `updated_at`

### `activities`
- `id` (uuid, pk)
- `user_id` (fk -> users)
- `upload_id` (fk -> uploads)
- `sport_type` (`running` for MVP)
- `source_type` (`strava_sticker`)
- `activity_date` (nullable)
- `distance` (nullable, raw OCR string)
- `pace` (nullable, raw OCR string)
- `time` (nullable, raw OCR string)
- `stats_json` (jsonb, raw OCR statistics payload)
- `running_path_key` (nullable, R2 object key for running path image)
- `created_at`, `updated_at`

## 7) OCR + Parsing Strategy
1. Accept only image types for MVP (`image/png`, `image/jpeg`, `image/webp`).
2. Preprocess image lightly (resize limits, orientation correction).
3. Send to Mistral OCR with strict response schema: stats JSON + running path image base64.
4. Parse OCR output into raw stat strings:
   - `distance` (e.g. `9.00 km`)
   - `pace` (e.g. `8:11 /km`)
   - `time` (e.g. `1h 13m`)
5. Upload returned running path image base64 to R2 and save `runningPathKey`.
6. Persist extracted data into `activities` (`statsJson` + raw string fields).
7. Return extracted stats and running path image base64 to frontend in the same response.

## 8) API Contract (MVP draft)
- `POST /auth/google` (or callback flow endpoint)
- `POST /uploads/presign`
  - returns signed upload URL + `key`
- `POST /uploads/complete`
  - confirm upload metadata, create upload record, return `uploadId`
- `POST /ocr/extract`
  - body: `{ uploadId }`
  - synchronous flow: fetch upload -> call Mistral -> persist `activities` + upload running path to R2
  - response: created `activity` + `runningPathImageBase64`
- `PATCH /activities/:id`
  - purpose: user-correct OCR-misread fields from frontend form
  - body (partial update): `activityDate`, `distance`, `pace`, `time`, `statsJson`
  - constraints: authenticated owner only, validation on date/string format
  - response: updated activity record
- `GET /activities/:id`
  - extraction result
- `GET /me/activities`
  - user history

## 9) Security & Compliance Baseline
- Google ID token verification server-side.
- JWT short-lived access token + refresh strategy.
- Object storage keys namespaced per user and non-guessable.
- Signed URLs for upload/download, short TTL.
- Validate content-type + max upload size (`5 MB`).
- Basic abuse controls:
  - per-user rate limit
  - max daily processing quota (configurable)
- Redact sensitive tokens from logs.

## 10) Delivery Plan (Execution Phases)

### Phase 0: Foundation (1 week)
- Project bootstrap cleanup (env config, module boundaries).
- Add PostgreSQL + Drizzle setup + first migration.
- Add health checks and structured logger.
- Setup CI basics (lint/build only for MVP).
- Add VPS deployment baseline (Dockerfile, compose, env template, process/restart strategy).

### Phase 1: Auth + Upload (1 week)
- Implement Google auth flow and user persistence.
- Implement R2 presigned upload flow.
- Add upload validation and metadata persistence.

### Phase 2: OCR Pipeline (1-2 weeks)
- Implement synchronous OCR endpoint (`POST /ocr/extract`).
- Mistral OCR integration + strict parser/extraction.
- Persist activity extraction result and upload running path image to R2.
- Add timeout/failure handling with clear API errors.

### Phase 3: FE Integration Hardening (1 week)
- Finalize OCR response shape for frontend editable form.
- Add field-level validation and fallback defaults for noisy OCR output.
- Implement and validate manual correction endpoint (`PATCH /activities/:id`).
- Improve synchronous endpoint latency and request timeout policy.

### Phase 4: Hardening + Metrics (1 week)
- Add processing metrics and dashboards.
- Improve error taxonomy and user-facing failure messages.
- Run validation set and tune OCR prompt/parser.

## 11) QA Strategy (MVP)
- Automated tests are intentionally deferred for MVP speed.
- Use manual QA checklist for core flow:
  - Login with Google.
  - Upload image with signed URL flow.
  - OCR extraction from `uploadId`.
  - Manual correction via `PATCH /activities/:id`.
  - Activity retrieval and frontend rendering compatibility.
- Log and triage production-like issues during private MVP testing.
- Reintroduce automated unit/integration/e2e tests in the next milestone.

## 12) Configuration & Environments
Required env vars (initial):
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` (optional)
- `MISTRAL_API_KEY`

## 13) Future-Ready Design for Multi-Sport
- Keep `sport_type` enum open for expansion.
- Separate extraction schema by sport with shared core metrics.
- Sticker template registry keyed by sport + version.
- Add sport-specific validation and OCR prompt variants later.

## 14) Key Risks & Mitigation
- OCR inconsistency from varied screenshot quality.
  - Mitigation: preprocessing + parsing heuristics + frontend editable form fallback.
- Running path image quality may be inconsistent for some screenshots.
  - Mitigation: treat running path as optional visual enhancer; prioritize core stats reliability.
- Processing latency spikes due to external AI dependency.
  - Mitigation: strict request timeout, controlled retries, and meaningful timeout error response.
- Abuse/spam uploads.
  - Mitigation: size limit, MIME checks, per-user quota/rate limits.

## 15) Confirmed Decisions (2026-04-10)
1. Sticker rendering/generation happens in frontend; backend only returns OCR stats + running path image data.
2. Max upload size is `5 MB`.
3. Low-confidence OCR should still return best-effort results and be editable in frontend form.
4. Upload and processing are authenticated-user only from day one.
5. Deployment target is your own VPS.
6. OCR processing is synchronous in MVP (no async queue/worker).
7. Automated tests are deferred for MVP.

## 16) Recommended Next Step
Start with **Phase 0 + Phase 1** first so auth and upload pipelines are stable. Then implement **Phase 2** with the exact synchronous flow: `uploadId` in, OCR result out, save to DB + R2, return response to frontend.
