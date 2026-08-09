# Wardrope Server Architecture

## Architectural style

Wardrope Server is a feature-oriented N-tier monolith modeled directly after Moose Server. The naming and folder conventions intentionally stay familiar between the two codebases.

The four primary tiers are:

- `Wardrope.API`: HTTP boundary, routing, controllers, middleware, request validation and response models.
- `Wardrope.Core`: use cases, business rules, domain/application models, service interfaces and service implementations.
- `Wardrope.DB`: MongoDB connection, persistence models, repository interfaces and repository implementations.
- `Wardrope.Infra`: concrete external-provider implementations such as AWS S3, image processing, AI, weather, email and observability integrations.

## Target structure

```text
Wardrope_Server/
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── Wardrope.API/
│   │   ├── controllers/
│   │   │   ├── BaseApiController/
│   │   │   ├── AuthController/
│   │   │   ├── UserController/
│   │   │   ├── WardrobeController/
│   │   │   ├── ProductController/
│   │   │   ├── UploadController/
│   │   │   ├── PhysicalProfileController/
│   │   │   ├── PreferenceController/
│   │   │   ├── OutfitController/
│   │   │   ├── RecommendationController/
│   │   │   ├── FragranceController/
│   │   │   ├── WeatherController/
│   │   │   └── HealthController/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   │   ├── AuthRoute/
│   │   │   ├── UserRoute/
│   │   │   ├── WardrobeRoute/
│   │   │   ├── ProductRoute/
│   │   │   ├── UploadRoute/
│   │   │   ├── PhysicalProfileRoute/
│   │   │   ├── PreferenceRoute/
│   │   │   ├── OutfitRoute/
│   │   │   ├── RecommendationRoute/
│   │   │   ├── FragranceRoute/
│   │   │   ├── WeatherRoute/
│   │   │   └── HealthRoute/
│   │   └── server/
│   │       ├── app.ts
│   │       └── app-runtime.ts
│   ├── Wardrope.Core/
│   │   ├── Models/
│   │   │   ├── Auth/
│   │   │   ├── User/
│   │   │   ├── Wardrobe/
│   │   │   ├── Product/
│   │   │   ├── PhysicalProfile/
│   │   │   ├── Preference/
│   │   │   ├── Outfit/
│   │   │   ├── Recommendation/
│   │   │   ├── Fragrance/
│   │   │   ├── Weather/
│   │   │   └── Health/
│   │   └── services/
│   │       ├── ServicesInterface/
│   │       │   ├── Auth/
│   │       │   ├── User/
│   │       │   ├── Wardrobe/
│   │       │   ├── Product/
│   │       │   ├── Upload/
│   │       │   ├── PhysicalProfile/
│   │       │   ├── Preference/
│   │       │   ├── Outfit/
│   │       │   ├── Recommendation/
│   │       │   ├── Fragrance/
│   │       │   ├── Weather/
│   │       │   ├── AI/
│   │       │   ├── Storage/
│   │       │   ├── ImageProcessing/
│   │       │   └── Health/
│   │       └── ServicesImplementation/
│   │           ├── Auth/
│   │           ├── User/
│   │           ├── Wardrobe/
│   │           ├── Product/
│   │           ├── Upload/
│   │           ├── PhysicalProfile/
│   │           ├── Preference/
│   │           ├── Outfit/
│   │           ├── Recommendation/
│   │           ├── Fragrance/
│   │           └── Health/
│   ├── Wardrope.DB/
│   │   ├── connection/
│   │   ├── models/
│   │   │   ├── User/
│   │   │   ├── WardrobeItem/
│   │   │   ├── PhysicalProfile/
│   │   │   ├── Preference/
│   │   │   ├── Outfit/
│   │   │   ├── WearHistory/
│   │   │   └── Fragrance/
│   │   └── repositories/
│   │       ├── RepositoryInterface/
│   │       │   ├── Auth/
│   │       │   ├── User/
│   │       │   ├── Wardrobe/
│   │       │   ├── PhysicalProfile/
│   │       │   ├── Preference/
│   │       │   ├── Outfit/
│   │       │   ├── Fragrance/
│   │       │   └── Health/
│   │       └── RepositoryImplementation/
│   │           ├── Auth/
│   │           ├── User/
│   │           ├── Wardrobe/
│   │           ├── PhysicalProfile/
│   │           ├── Preference/
│   │           ├── Outfit/
│   │           ├── Fragrance/
│   │           └── Health/
│   ├── Wardrope.Infra/
│   │   └── services/
│   │       ├── AI/
│   │       ├── Storage/
│   │       ├── Weather/
│   │       ├── Security/
│   │       └── ImageProcessing/
│   └── index.ts
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
└── tsconfig.json
```

Only folders that have real code should be committed. We do not add empty directories just to make the tree look complete.

## Dependency direction

```text
Wardrope.API -> Wardrope.Core
Wardrope.API -> Wardrope.DB / Wardrope.Infra only during composition
Wardrope.Core -> service/repository interfaces and domain models
Wardrope.DB -> MongoDB driver
Wardrope.Infra -> external provider SDKs
```

Rules:

- Controllers never contain business logic and never call MongoDB, AWS, AI or weather providers directly.
- Core services own use-case orchestration and business rules.
- DB repository implementations own MongoDB persistence details.
- External service interfaces live under `Wardrope.Core/services/ServicesInterface`, matching Moose Server's storage-interface pattern.
- Infra implements those provider-facing interfaces.
- `app-runtime.ts` is the composition root that wires concrete DB and Infra implementations into Core services.
- Tests should exercise both business behavior and the HTTP contract.

## MVP backend features

- `Auth`: identity, secure session/token lifecycle, account access and security controls.
- `User`: profile and account data.
- `Wardrobe`: editable digital wardrobe item CRUD, filters, ownership state and product-specific attributes.
- `Product`: objective category-specific item intelligence shared by wardrobe flows where appropriate.
- `Upload`: authenticated multipart ingestion and safe server-side image handling.
- `PhysicalProfile`: physical attributes used by recommendations.
- `Preference`: style and recommendation preferences.
- `Outfit`: saved outfits and wear history.
- `Recommendation`: Dress Me use cases using wardrobe, profile, preferences, occasion, history and context.
- `Fragrance`: editable fragrance collection and complete-the-look selection.
- `Weather`: normalized weather context consumed by recommendation logic.
- `AI`: provider implementation in Infra only; Core consumes an interface.

## Image upload security boundary

The frontend must never upload directly to AWS.

```text
React web app
  -> POST multipart/form-data to Wardrope.API
      -> authentication + ownership authorization
      -> request/file validation
      -> file signature/MIME/size/dimension checks
      -> Core upload/wardrobe use case
          -> ImageProcessing service
          -> S3 Storage service (server-side AWS SDK)
          -> MongoDB repository
  <- sanitized Wardrope API response
```

Security expectations:

- private S3 bucket
- server-side AWS credentials only
- least-privilege IAM role/user
- encryption at rest
- randomized object keys; never trust client filenames as object keys
- file signature validation, not only `Content-Type`
- explicit image size and dimension limits
- re-encoding and metadata stripping where appropriate
- authentication and ownership authorization before writes and reads
- safe API errors with request IDs but no provider secrets or stack traces
- secrets loaded from environment/secret management and never committed
- uploads are not considered successful until S3 and MongoDB state are reconciled safely

## AI boundary

AI-provider code belongs under `Wardrope.Infra/services/AI`. Its interface belongs in Core. Controllers never call an AI SDK directly.

Recommendation context may include the user's physical profile, preferences, wardrobe inventory, outfit history, occasion, time, normalized weather context and fragrance collection. Provider-specific request/response shapes must not leak into the rest of the application.

## Weather boundary

Weather-provider SDK/HTTP details belong under `Wardrope.Infra/services/Weather`. Core consumes a normalized Wardrope weather model rather than provider-specific payloads.

## Fragrance data principle

Fragrance records store objective data such as identity, fragrance family, scent type, key notes, concentration and ownership data. Contextual labels such as `date-night`, `office`, `summer`, `formal`, `sexy` or `evening` are not persisted as product facts; recommendation logic infers suitability from context.

## Quality gate

A feature is not complete until:

1. request and domain validation exist;
2. authorization and ownership rules are enforced;
3. happy-path and important failure-path tests pass;
4. HTTP status codes and response bodies are verified;
5. type-check and production build pass;
6. security-sensitive behavior is reviewed;
7. the feature has no placeholder routes or unfinished controller methods.

## Naming

Keep Moose Server-style naming:

- controllers: `<feature>.controller.ts`
- routes: `<feature>.routes.ts`
- service implementations: `<feature>.service.ts`
- service contracts: `<feature>.service.interface.ts`
- repositories: `<feature>.repository.ts`
- repository contracts: `<feature>.repository.interface.ts`
- MongoDB models: `<entity>.model.ts`
- request validation: `<feature>.validation.ts` or focused schema files
