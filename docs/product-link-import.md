# Product Link Import

Wardrope can import wardrobe item details from a user-supplied product page while keeping network access, product-image retrieval, AWS S3, and internal object references on the backend.

## User flow

1. The authenticated user pastes an HTTPS product-page URL.
2. The web app sends the URL to `POST /api/v1/wardrobe/import-preview` with the in-memory CSRF token.
3. The server safely fetches the public page and extracts bounded, best-effort product metadata from structured Product JSON-LD and standard social metadata.
4. Wardrope returns editable suggestions such as name, brand, colors, materials, category/subcategory hints, and whether a primary image is available. The remote image URL is not returned.
5. The user reviews or corrects the fields and creates the wardrobe item. The normalized original product URL is saved as `sourceUrl` for provenance.
6. For a saved item with `sourceUrl`, the web app may call `POST /api/v1/wardrobe/:itemId/image/import-source`.
7. The backend re-fetches the stored product page, locates its primary image, downloads bounded bytes, and hands those bytes to the existing Wardrobe image pipeline.
8. The image pipeline validates the real file signature, dimensions and image safety, processes it to the canonical private WebP representation, uploads it to the Wardrope S3 prefix, and persists only the private object reference in MongoDB.

The archived S3 image becomes Wardrope's durable wardrobe copy. Future reads use the authenticated Wardrope image endpoint and do not depend on the retailer continuing to host the original image.

## Security boundary

Product URLs and every redirect are treated as untrusted input.

The backend importer:

- accepts HTTPS product URLs only;
- rejects URL credentials and non-standard HTTPS ports;
- rejects literal IP addresses;
- rejects localhost, local/internal names and known cloud-metadata hostnames;
- resolves domain names before connecting and rejects a hostname if any resolved address is not publicly routable;
- validates the complete DNS answer set before attempting any connection, deduplicates validated addresses, prefers IPv4 for broader hosting compatibility, and caps one request to four pinned-address attempts;
- retries only validated pinned addresses after transport-level failures and never falls back to an unvalidated hostname connection;
- retains the original hostname for TLS SNI and the Host header while connecting to the validated public address;
- repeats URL and DNS validation on every redirect and limits redirect depth;
- applies one bounded request deadline across address retries so multi-address fallback cannot create unbounded request time;
- enforces response header and byte-size limits;
- records only bounded operational diagnostics for DNS, timeout, TLS, network, redirect-limit and remote HTTP failures; diagnostics include the hostname and safe status/error codes but not query strings, response bodies, cookies, Authorization headers or Wardrope credentials;
- does not forward user cookies, Wardrope credentials or Authorization headers to retailer sites;
- does not persist arbitrary remote HTML;
- never accepts an image URL from the browser for archival;
- always routes downloaded image bytes through the same signature/Sharp/S3 lifecycle as direct image uploads.

Authentication and CSRF protection are required before either product-page preview or source-image import can cause an outbound request. Product import also has its own rate limit.

## Stored data

Wardrope stores the normalized product-page `sourceUrl` as optional item provenance. It does not store the retailer's remote image URL. Existing wardrobe documents without `sourceUrl` remain compatible and map to `null`.

Users can continue creating items manually and uploading images directly through the Wardrope API when a retailer blocks automated access or exposes insufficient metadata.
