# Private AWS S3 image layout

Wardrope uses one private S3 bucket configured only on the backend.

The bucket name is supplied through `AWS_S3_BUCKET_NAME`. Object keys are rooted at `AWS_S3_ROOT_PREFIX`, which defaults to `Wardrope`.

New wardrobe-item images use this layout:

```text
Wardrope/clothes/<userId>/<itemId>/<random-uuid>.webp
```

The S3 storage adapter validates every generated path segment before upload. Browser clients never supply the S3 key and never receive the bucket name or internal object key.

Existing MongoDB records that contain older object keys remain supported because reads and deletions use the exact stored key. No destructive migration is required for existing objects.

Future image-owning features should add an explicit backend-owned namespace under the same root, for example `users`, `fragrances`, or `outfits`, rather than accepting arbitrary caller-controlled prefixes.
