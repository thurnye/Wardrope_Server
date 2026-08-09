# Wardrope Server

Wardrope Server is the Node.js + Express + TypeScript backend for Wardrope. It uses a Moose Server-style N-tier architecture with explicit API, Core, DB and Infrastructure boundaries.

## Stack

- Node.js 24 LTS project baseline
- Express + TypeScript
- MongoDB native driver
- Zod environment/request validation
- Helmet + explicit CORS + rate limiting
- Vitest + Supertest

## Getting started

```bash
nvm use
cp .env.example .env
npm install
npm run dev
```

A local MongoDB connection is required to run the API outside the test environment. The default API root is `http://localhost:4000/api/v1`.

Health endpoints:

```text
GET /api/v1/health
GET /api/v1/health/readiness
```

`/health` reports process liveness. `/health/readiness` returns `503` until required dependencies are ready.

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

## Current implemented slice

The initial foundation contains:

- validated runtime configuration and MongoDB connection lifecycle;
- Moose-style Health API/Core/DB layers;
- centralized request IDs, Helmet, explicit credentialed CORS, request-size limits and rate limiting;
- sanitized 404/error responses and production-safe error logging;
- separate liveness/readiness endpoints;
- graceful bounded shutdown;
- HTTP tests for healthy/unready behavior, headers, CORS, request-ID validation, oversized payloads and unknown routes;
- CI type-check, test, build and production dependency audit gates.

Feature endpoints are added only when their complete controller, Core service, repository/provider behavior, authorization and failure-path tests are ready. We do not publish placeholder routes.
