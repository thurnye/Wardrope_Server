# Wardrope Server

Wardrope Server is the Node.js + Express + TypeScript backend for Wardrope. It uses a Moose Server-style N-tier architecture with explicit API, Core, DB, and Infrastructure boundaries.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full structure and dependency rules.

## Security-first integration boundary

The React frontend never connects directly to AWS S3, MongoDB, AI providers, or the weather provider.

Image flow:

1. The authenticated frontend submits a multipart request to the API.
2. API middleware validates access and the uploaded file.
3. Core coordinates the use case.
4. Infrastructure processes and uploads the image to private S3 storage.
5. DB persists the object reference and associated domain data in MongoDB.
6. API returns a sanitized response.

AWS, database, AI, weather, signing, and other privileged credentials are server-only.
