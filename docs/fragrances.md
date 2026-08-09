# Fragrances

Fragrances stores objective product and ownership facts for bottles the authenticated user wants Wardrope to consider. Recommendation suitability is inferred later from these facts plus outfit, physical profile, style preferences, occasion, weather, time, and wear history.

## API

```text
GET    /api/v1/fragrances
POST   /api/v1/fragrances
GET    /api/v1/fragrances/:fragranceId
PATCH  /api/v1/fragrances/:fragranceId
DELETE /api/v1/fragrances/:fragranceId

GET    /api/v1/fragrances/:fragranceId/image
PUT    /api/v1/fragrances/:fragranceId/image
DELETE /api/v1/fragrances/:fragranceId/image
```

All routes require authentication. Mutations require CSRF. Ownership is derived only from the authenticated session, and missing/wrong-owner IDs share the same not-found behavior.

## Persisted product facts

- brand;
- fragrance name;
- optional product line;
- concentration (`eau-de-cologne`, `eau-de-toilette`, `eau-de-parfum`, `parfum`, `extrait-de-parfum`, or `other`);
- optional fragrance family and scent type labels;
- bounded key-note labels;
- bottle size in millilitres;
- estimated amount remaining as 0–100 percent;
- optional purchase date and purchase price/currency;
- `available`, meaning the bottle can currently be considered for recommendations;
- private image metadata and timestamps.

The model intentionally does **not** persist labels such as `date-night`, `office`, `summer`, `formal`, `sexy`, `evening`, or other recommendation judgments. Those are contextual outputs, not product facts.

## Bottle image flow

Fragrance images follow the same backend-only upload choreography as wardrobe images:

1. the authenticated frontend sends multipart form-data to Wardrope API;
2. auth, CSRF, rate limiting, and fragrance ownership are checked before Multer buffers the image;
3. the hardened Sharp pipeline validates the real image signature, dimensions/pixels, animation, and output size, strips metadata, and converts to WebP;
4. the backend uploads to the shared private S3 namespace:

```text
<bucket>/wardrope/fragrances/<random-uuid>.webp
```

5. MongoDB stores the internal object key/ETag and safe image metadata;
6. API responses expose only content type, dimensions, size, and updated timestamp;
7. reads are authenticated API-proxied binary responses with private revalidation caching.

New object paths contain no `userId` or `fragranceId`. The browser never chooses the S3 folder/key and never receives AWS credentials, bucket names, object keys, or direct upload destinations.

Image replacement uses a compare-and-swap Mongo switch. A new S3 object is deleted if persistence loses a race; the old object is retired only after Mongo points to the replacement. Whole-fragrance deletion removes the Mongo record first, then best-effort cleans the private image so cleanup failure cannot leave a live record pointing to a missing object.

## Search and filtering

List supports bounded pagination plus `available`, `concentration`, and literal escaped `search`. Search covers brand, name, product line, fragrance family, scent type, and key notes.
