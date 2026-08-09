# Wardrope Server

Wardrope Server is the Node.js + Express + TypeScript backend for Wardrope. It uses a Moose Server-style N-tier architecture with explicit API, Core, DB and Infrastructure boundaries.

## Stack

- Node.js 24 LTS project baseline
- Express + TypeScript
- MongoDB native driver
- Zod environment/request validation
- Helmet + explicit CORS + rate limiting
- Node crypto for scrypt password hashing and secure session tokens
- AWS S3 for private backend-managed image storage
- Nodemon + tsx for local development reloads
- Vitest + Supertest

## Getting started

```bash
nvm use
cp .env.example .env
npm install
npm run dev
```

`npm run dev` runs the TypeScript API through Nodemon and automatically restarts when files under `src/` change. Production continues to run the compiled output through `npm start`.

A local MongoDB connection is required to run the API outside the test environment. The default API root is `http://localhost:4000/api/v1`.

For image storage, configure the existing S3 bucket name with `AWS_S3_BUCKET_NAME`. `AWS_S3_ROOT_PREFIX` defaults to lowercase `wardrope` and must be a single safe S3 prefix segment.

Wardrope follows the Moose upload choreography: the client sends a multipart file to the API, the backend chooses a trusted logical storage folder, the S3 adapter generates a UUID filename and uploads the bytes, and MongoDB stores the resulting private object reference. The browser never chooses the S3 key.

New images use shared folders rather than user/item partitions:

```text
<bucket>/wardrope/clothings/<random-uuid>.webp
<bucket>/wardrope/accessories/<random-uuid>.webp
<bucket>/wardrope/user/<random-uuid>.<extension>
<bucket>/wardrope/fragrances/<random-uuid>.<extension>
<bucket>/wardrope/Footware/<random-uuid>.webp
```

Current wardrobe category routing is backend-owned: tops, bottoms, one-piece items and outerwear go to `clothings`; bags, accessories and jewelry go to `accessories`; footwear goes to `Footware`. The `user` folder is reserved for user avatars and `fragrances` is reserved for fragrance images.

The bucket remains private and server-only. Existing object keys already saved in MongoDB remain readable and removable exactly as stored, so this layout change does not require a destructive migration.

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

Wardrobe:

```text
GET    /api/v1/wardrobe
POST   /api/v1/wardrobe
GET    /api/v1/wardrobe/:itemId
PATCH  /api/v1/wardrobe/:itemId
DELETE /api/v1/wardrobe/:itemId
```

Wardrobe reads require authentication. Wardrobe creates, edits and deletes require both authentication and a valid `X-CSRF-Token`. Ownership always comes from the authenticated session; the API does not accept a browser-supplied `userId` as an ownership authority.

List filters are allowlisted: `page`, `pageSize`, `category`, `favorite`, and `search`. Search text is treated literally rather than as caller-controlled regular-expression syntax.

Wardrobe items are deliberately editable after creation. `PATCH` may also explicitly clear nullable facts such as `brand`, `pattern`, and `size` by sending `null`.

`/health` reports process liveness. `/health/readiness` returns `503` until required dependencies are ready.

Authentication uses a host-only `HttpOnly` session cookie. The raw session token is never returned in JSON and only a SHA-256 hash is persisted. Login also issues a separate same-site CSRF cookie bound to the session's server-side CSRF hash. `GET /auth/session` returns the current public user and the same valid CSRF token when possible; it replaces the token only if the CSRF cookie is missing or invalid. Authenticated state-changing browser requests must send the token in `X-CSRF-Token`.

Registration does not automatically create a session. For a valid registration payload, the API deliberately returns the same `201` acceptance response whether the normalized email is newly created or already unavailable. That prevents the registration endpoint from exposing account existence through status codes or response bodies. The user continues by signing in, where invalid credentials are also returned generically.

## Wardrobe data principle

Persisted wardrobe fields are objective product/ownership facts:

- name
- category and subcategory
- brand
- colors
- materials
- pattern
- size
- favorite state
- created/updated timestamps

Contextual labels such as `date-night`, `office`, `summer`, `formal`, or similar recommendation judgments are not stored as product facts. Recommendation services infer suitability from the item data plus the user's profile, preferences, occasion, weather, history, and other context.

Wardrobe images use the secure backend-only image/S3 flow. The browser uploads to and reads through the Wardrope API; it never receives AWS credentials, the S3 bucket name, internal object keys, or a direct S3 upload URL.

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
3. Core coordinates the use case and selects the allowed storage folder from trusted domain data.
4. Infrastructure processes the image, generates the UUID filename and uploads it to private S3 storage.
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

### Wardrobe CRUD

- strict objective wardrobe data model with bounded enums and text/list limits;
- create, list, read, edit and delete endpoints;
- authenticated user ownership derived only from the session;
- Mongo queries scoped by both owner ID and item ID for item-level access;
- wrong-owner resources deliberately look identical to missing resources;
- CSRF enforcement on all wardrobe mutations;
- strict schemas reject unknown fields, including attempted client ownership overrides;
- bounded allowlisted filters and pagination;
- escaped literal text search across name, brand and subcategory;
- normalized whitespace and case-insensitive duplicate removal for colors/materials;
- nullable fields can be intentionally cleared during edits;
- owner/category/favorite database indexes;
- HTTP tests for CRUD, validation, filtering, ownership isolation, CSRF and origin enforcement;
- direct repository tests verify production Mongo owner filters and search escaping.

Feature endpoints are added only when their complete controller, Core service, repository/provider behavior, authorization and failure-path tests are ready. We do not publish placeholder routes.
