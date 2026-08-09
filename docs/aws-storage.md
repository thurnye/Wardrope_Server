# Private AWS S3 image layout

Wardrope uses one private S3 bucket configured only on the backend.

The bucket name is supplied through `AWS_S3_BUCKET_NAME`. Object keys are rooted at `AWS_S3_ROOT_PREFIX`, which defaults to lowercase `wardrope`.

Wardrope follows the Moose upload pattern: the client sends the file to the Wardrope API, the backend chooses a trusted logical folder, the storage adapter generates a random UUID filename, uploads the bytes to S3, and MongoDB stores the resulting private object reference. The browser never chooses an S3 folder or object key.

The shared object layout is intentionally not partitioned by `userId` or wardrobe `itemId`:

```text
<bucket>/
└── wardrope/
    ├── clothings/
    │   └── <random-uuid>.webp
    ├── accessories/
    │   └── <random-uuid>.webp
    ├── user/
    │   └── <random-uuid>.<extension>
    ├── fragrances/
    │   └── <random-uuid>.<extension>
    └── Footware/
        └── <random-uuid>.webp
```

Current wardrobe category routing is server-owned:

- `top`, `bottom`, `one-piece`, `outerwear` -> `clothings`
- `bag`, `accessory`, `jewelry` -> `accessories`
- `footwear` -> `Footware`

The `user` namespace is reserved for user avatars. The `fragrances` namespace is reserved for fragrance images when that feature is implemented.

S3 remains private. Wardrobe image reads continue through the authenticated Wardrope API rather than exposing bucket names, object keys, AWS credentials, direct object URLs, or presigned browser upload destinations.

Existing MongoDB records that contain older object keys remain supported because reads and deletions use the exact stored key. No destructive migration is required for existing objects.
