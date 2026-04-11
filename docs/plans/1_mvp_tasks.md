# StravaSticker Backend MVP Tasks

## 1) Goal
Ship the running-only MVP backend with this synchronous flow:
`login -> upload to R2 -> OCR extract -> save activity -> optional user correction -> retrieve activity history`.

## 2) Ground Rules
- Automated tests are deferred for MVP.
- Use manual QA checklist for each completed endpoint.
- Keep API backward-compatible once frontend starts integration.
- Authenticated users only for upload/extract/update/history endpoints.
- Preserve existing HTTP status code semantics while standardizing response bodies.

## 2.1) Logging Plan Baseline (Adopted Pattern)
- Logging format: JSON lines to stdout/stderr.
- Correlation id: `x-request-id` added on every request/response.
- Global HTTP logging via interceptor:
  - success log with method/url/route/status/latency/userId/requestId
  - error log with same metadata + sanitized request payload
  - skip noisy endpoints: `/health` (and `/metrics` if added later)
- Sensitive data masking utility for deep payload redaction.
- Bootstrap wiring:
  - `NestFactory.create(AppModule, { bufferLogs: true })`
  - `app.useLogger(customLogger)`
  - `app.useGlobalInterceptors(loggingInterceptor)`
- Optional log shipping stack (later): Docker fluentd driver -> Fluent Bit -> Loki -> Grafana.

## 2.2) API Response Standardization (Adopted Pattern)
- Success response envelope for all endpoints:
  - `{ success, message, data, pagination? }`
- Reference type file:
  - `src/common/types/response.type.ts`
- Error responses:
  - keep existing error body fields and status code behavior
  - always append `requestId`
- Global success wrapping via interceptor:
  - `src/common/interceptors/response.interceptor.ts`
  - pass-through if handler already returns compliant envelope
  - detect `{ data, pagination }` result and map to enveloped success
- Global error augmentation via exception filter:
  - `src/common/filters/all-exceptions.filter.ts`
  - append `requestId` for both `HttpException` and unknown errors
- Ergonomic helpers:
  - `src/common/utils/response.ts` with `ok(...)` and `created(...)`
- Bootstrap wiring in `src/main.ts`:
  - register response interceptor globally
  - register all-exceptions filter globally

## 3) Task Board
- Status legend:
  - `DONE`: implemented in code and passing lint/build.
  - `IN_PROGRESS`: partially implemented; has clear remaining items.
  - `TODO`: not started yet.

## Phase 0 - Foundation

### T0.1 Project structure and config bootstrap
- Status: `IN_PROGRESS`
- Deliverables:
  - Add module skeletons: `auth`, `users`, `uploads`, `activities`, `ocr`, `health`.
  - Add centralized config service with env validation.
  - Add shared error format and global exception filter.
- DoD:
  - App boots with all modules registered.
  - Missing required env var fails fast at startup.

### T0.2 Database + Drizzle setup
- Status: `IN_PROGRESS`
- Deliverables:
  - Configure PostgreSQL connection and Drizzle integration.
  - Create initial migration for tables:
    - `users`
    - `sessions`
    - `uploads`
    - `activities`
  - Add indexes:
    - `users.google_sub` unique
    - `users.email` unique
    - `uploads.key` unique
    - `activities.user_id`
    - `activities.upload_id`
- DoD:
  - Migration runs successfully on local DB.
  - CRUD sanity check works for all 4 tables.

### T0.3 Logging + health foundation
- Status: `DONE`
- Deliverables:
  - Create custom logger module and service:
    - `src/app-logger/app-logger.module.ts`
    - `src/app-logger/app-logger.service.ts`
  - Logger service outputs JSON log lines with at least:
    - `level`
    - `timestamp`
    - `message`
    - `requestId`
    - optional context fields (`method`, `url`, `statusCode`, `latencyMs`, `userId`, `error`)
  - Add request id constant and middleware:
    - `src/common/constants/index.ts` -> `X_REQUEST_ID_HEADER`
    - `src/common/middlewares/request-id.middleware.ts`
  - Add global logging interceptor:
    - `src/common/interceptors/logging.interceptor.ts`
  - Add payload redaction utility:
    - `src/common/logging/redaction.util.ts`
    - handles nested object masking, circular refs, buffers, and `Error` objects
  - Wire logger in bootstrap (`src/main.ts`):
    - use buffered logs
    - set custom logger
    - register global logging interceptor
  - `GET /health` endpoint (DB reachable + app up).
  - Redact secrets/tokens from logs.
- DoD:
  - Every request has `x-request-id` in response header.
  - Success and error requests are logged with request id and latency.
  - Error logs use redacted payloads (no token/password/api-key leakage).
  - Health endpoint returns healthy payload.
  - Log output is valid JSON (one object per line).

### T0.4 Response envelope + exception filter foundation
- Status: `DONE`
- Deliverables:
  - Add base response type:
    - `src/common/types/response.type.ts`
  - Add global success response interceptor:
    - `src/common/interceptors/response.interceptor.ts`
    - wraps normal success results to `{ success: true, message: 'OK', data }`
    - supports pagination passthrough from `{ data, pagination }`
    - pass-through for already compliant envelope
  - Add global exception filter:
    - `src/common/filters/all-exceptions.filter.ts`
    - preserves current error fields/status code
    - appends `requestId` from request header/context
  - Add helper utilities:
    - `src/common/utils/response.ts` with `ok(...)`, `created(...)`
  - Wire globally in bootstrap (`src/main.ts`):
    - register response interceptor
    - register all-exceptions filter
- DoD:
  - Every successful endpoint response follows the envelope format.
  - Every error response includes `requestId`.
  - Existing status codes are unchanged.

## Phase 1 - Auth + Upload

### T1.1 Google auth endpoint
- Status: `DONE`
- Endpoint: `POST /auth/google`
- Deliverables:
  - Verify Google ID token server-side.
  - Upsert user by `google_sub`.
  - Issue access token and refresh token.
  - Persist refresh token hash in `sessions`.
- DoD:
  - New user can sign in and receive tokens.
  - Existing user sign-in reuses same account.

### T1.2 R2 service integration
- Status: `DONE`
- Deliverables:
  - Add Cloudflare R2 client wrapper.
  - Implement signed upload URL generation.
  - File rules: allow `png/jpeg/webp`, max `5 MB`.
- DoD:
  - Signed URL upload works from frontend.
  - Invalid mime/size is rejected.

### T1.3 Upload endpoints
- Status: `DONE`
- Endpoints:
  - `POST /uploads/presign`
  - `POST /uploads/complete`
- Deliverables:
  - `presign` returns upload URL + object `key`.
  - `complete` stores `uploads` row and returns `uploadId`.
  - Ownership enforced by authenticated user.
- DoD:
  - Upload flow is usable end-to-end from FE.
  - `uploads.status` moves to `uploaded` after complete.

## Phase 2 - OCR Sync Processing

### T2.1 Mistral OCR client + schema parser
- Status: `DONE`
- Deliverables:
  - Add OCR service wrapper for Mistral API.
  - Define strict response shape:
    - statistics JSON
    - `running_path_image_base64`
  - Add parsing helpers:
    - extract `distance` as raw string (example: `9.00 km`)
    - extract `pace` as raw string (example: `8:11 /km`)
    - extract `time` as raw string (example: `1h 13m`)
- DoD:
  - OCR service returns parsed stats object for valid sample image.
  - Parsing errors are mapped to clear API errors.

### T2.2 OCR extract endpoint (synchronous)
- Status: `DONE`
- Endpoint: `POST /ocr/extract`
- Input:
  - `{ "uploadId": "uuid" }`
- Deliverables:
  - Validate upload ownership and status.
  - Download source image from R2.
  - Call Mistral OCR synchronously.
  - Upload returned running path base64 image to R2.
  - Create `activities` record with:
    - `statsJson`
    - `distance`
    - `pace`
    - `time`
    - `activityDate`
    - `runningPathKey`
  - Return response:
    - created `activity` record
    - `runningPathImageBase64`
- DoD:
  - Endpoint completes within acceptable timeout window.
  - Activity row is persisted and retrievable.

### T2.3 OCR failure and timeout policy
- Status: `IN_PROGRESS`
- Deliverables:
  - Timeout guard for OCR request.
  - Error mapping for:
    - invalid upload id
    - unsupported image
    - OCR upstream failure
    - OCR timeout
  - User-friendly error payload shape for FE.
- DoD:
  - FE can display deterministic error message for each failure class.

## Phase 3 - Activity Edit + Retrieval

### T3.1 Manual correction endpoint
- Status: `DONE`
- Endpoint: `PATCH /activities/:id`
- Allowed fields (partial update only):
  - `activityDate`
  - `distance`
  - `pace`
  - `time`
  - `statsJson`
- Deliverables:
  - Owner-only update enforcement.
  - Validation for string/date formats.
  - Reject unknown/disallowed fields.
- DoD:
  - FE can save OCR corrections reliably.
  - Updated values are reflected in read endpoints.

### T3.2 Activity retrieval endpoints
- Status: `DONE`
- Endpoints:
  - `GET /activities/:id`
  - `GET /me/activities`
- Deliverables:
  - Owner-only read access.
  - Pagination for `GET /me/activities` (cursor or page+limit).
  - Stable response shape for FE.
- DoD:
  - FE can render activity detail and history list.

### T3.3 API shape stabilization
- Status: `IN_PROGRESS`
- Deliverables:
  - Finalize DTOs and validation pipes.
  - Lock success message conventions (`OK`, `Created`, `Updated`) for consistent FE UX.
  - Lock error code list used by FE UI.
- DoD:
  - FE integration can proceed without backend response ambiguity.

## Phase 4 - Hardening + VPS Deployment

### T4.1 Security and abuse controls
- Status: `TODO`
- Deliverables:
  - Auth guard for protected endpoints.
  - Basic rate limiting on auth/upload/ocr endpoints.
  - Max daily OCR quota per user (configurable).
- DoD:
  - Abuse limits are enforced and observable in logs.

### T4.2 VPS deployment baseline
- Status: `IN_PROGRESS`
- Deliverables:
  - `Dockerfile`
  - `docker-compose.yml` (app + postgres, optional redis omitted for MVP)
  - `.env.example` with required variables
  - process restart strategy and basic deployment notes
- DoD:
  - App can run on VPS with documented steps.

### T4.3 MVP launch checklist
- Status: `TODO`
- Deliverables:
  - Manual QA pass for full flow:
    - login
    - upload
    - OCR extract
    - correction update
    - history/detail retrieval
    - verify success responses use `{ success, message, data, pagination? }`
    - verify error responses include `requestId`
  - Basic performance sanity check for synchronous OCR endpoint.
  - Final env/secrets verification.
- DoD:
  - Team agrees MVP is production-ready for private rollout.

### T4.4 Optional log shipping for VPS
- Status: `TODO (Optional)`
- Deliverables:
  - Add optional compose services/config:
    - `docker-compose.yml` logging section (fluentd driver)
    - `scripts/fluentbit/fluent-bit.conf`
    - Loki + Grafana provisioning
  - Add starter dashboard/query notes:
    - `{app="stravasticker-backend"} | json`
- DoD:
  - Logs can be queried in Grafana with requestId correlation.

## 4) API Build Order (Recommended)
1. `POST /auth/google`
2. `POST /uploads/presign`
3. `POST /uploads/complete`
4. `POST /ocr/extract`
5. `PATCH /activities/:id`
6. `GET /activities/:id`
7. `GET /me/activities`

## 5) MVP Done Criteria
- All 7 endpoints above are implemented and integrated with FE.
- OCR extraction persists activity data and running path asset correctly.
- User can manually fix OCR-misread stats through API.
- Auth, upload limit (`5 MB`), and owner-only access rules are enforced.
- Structured JSON logging, request-id propagation, and redaction are implemented.
- Standardized success envelope is applied globally.
- Error responses preserve existing fields and include `requestId`.
- Backend is deployable on your VPS using documented steps.

## 6) Current Remaining Work
- `T0.1`:
  - Add stricter env schema validation (required keys + types) in config bootstrap.
- `T0.2`:
  - Generate and run first Drizzle migration files against real database.
- `T2.3`:
  - Finalize and document stable error code taxonomy for OCR failure classes.
- `T3.3`:
  - Finalize DTOs/validation and lock response message/error-code conventions.
- `T4.2`:
  - Add Dockerfile + docker-compose runtime setup for VPS deployment.
- `T4.1`, `T4.3`, `T4.4`:
  - Security hardening, launch checklist, and optional log shipping stack remain open.
