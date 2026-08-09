# Wardrope Server

Wardrope Server is the Node.js + Express + TypeScript backend for Wardrope. It uses a Moose Server-style N-tier architecture with explicit API, Core, DB and Infrastructure boundaries.

## Stack

- Node.js 24 LTS project baseline
- Express + TypeScript
- MongoDB native driver
- Zod environment/request validation
- Helmet + explicit CORS + rate limiting
- Node crypto for scrypt password hashing and secure session tokens
- Vitest + Supertest

## Getting started

```bash
nvm use
cp .env.example .env
npm install
npm run dev
```

A local MongoDB connection is required to run the API outside the test environment. The default API root is `http://localhost:4000/api/v1`.

## Implemented endpoints

Health:

```text
GET  /api/v1/health
GET  /api/v1/health/readiness
```

Authentication:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/session
POST /api/v1/auth/logout
```

`/health` reports process liveness. `/health/readiness` returns `503` until required dependencies are ready.

Authentication uses a host-only `HttpOnly` session cookie. The raw session token is never returned in JSON and only a SHA-256 hash is persisted. Login also issues a separate same-site CSRF cookie bound to the session's server-side CSRF hash. `GET /auth/session` returns the current public user and the same valid CSRF token when possible; it replaces the token only if the CSRF cookie is missing or invalid. Authenticated state-changing browser requests must send the token in `X-CSRF-Token`.

Registration does not automatically create a session. For a valid registration payload, the API deliberately returns the same `201` acceptance response whether the normalized email is newly created or already unavailable. That prevents the registration endpoint from exposing account existence through status codes or response bodies. The user continues by signing in, where invalid credentials are also returned generically.

## Quality checks

```bash
npm run type-check
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the architecture and [`SECURITY.md`](./SECURITY.md) for mandatory security requirements.

## Security-first integration boundary

The React frontend never connects directly to AWS S3, MongoDB, AI providers or the weather provider.

Image flow:

1. The authenticated frontend submits a multipart request to the API.
2. API middleware validates authentication, authorization and the uploaded file.
3. Core coordinates the use case.
4. Infrastructure processes and uploads the image to private S3 storage.
5. DB persists the controlled object reference and associated domain data in MongoDB.
6. API returns a sanitized response.

AWS, database, AI, weather, signing and other privileged credentials are server-only.

## Implemented slices

### Foundation

- validated runtime configuration and MongoDB connection lifecycle;
- Moose-style Health API/Core/DB layers;
- centralized request IDs, Helmet, explicit credentialed CORS, request-size limits and rate limiting;
- globally enforced trusted browser origins;
- sanitized 404/error responses and production-safe error logging;
- separate liveness/readiness endpoints;
- graceful bounded shutdown;
- HTTP tests for healthy/unready behavior, headers, CORS/origin policy, request-ID validation, oversized payloads and unknown routes;
- CI type-check, test, build and production dependency audit gates.

### Authentication

- validated registration and login requests;
- identical accepted registration response for new and duplicate normalized emails;
- unique normalized-email persistence constraint;
- salted scrypt password hashing with timing-safe verification;
- dummy password verification for unknown accounts and equalized duplicate-registration hashing work;
- random server-managed session tokens stored only as hashes in MongoDB;
- MongoDB TTL expiry for sessions;
- `HttpOnly`, `SameSite=Lax` session cookies and production `__Host-` prefix;
- same-site CSRF cookie bound to a server-side CSRF hash, plus header enforcement for authenticated writes;
- stable CSRF bootstrap across browser refreshes/tabs without unnecessary cookie mutation;
- dedicated register/login rate limits;
- HTTP and crypto tests covering the important happy and abuse paths.

Feature endpoints are added only when their complete controller, Core service, repository/provider behavior, authorization and failure-path tests are ready. We do not publish placeholder routes.
