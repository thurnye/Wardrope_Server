# Wardrope Server Architecture

## Architectural style

Wardrope Server uses a feature-oriented N-tier monolith modeled after Moose Server.

The four primary tiers are:

- `Wardrope.API`: HTTP boundary, routing, controllers, middleware, request validation, response models.
- `Wardrope.Core`: application/domain use cases, service contracts, domain models, business rules.
- `Wardrope.DB`: MongoDB connection, schemas/models, repository contracts and implementations.
- `Wardrope.Infra`: external integrations such as AWS S3, AI providers, weather provider, email, logging and security utilities.

## Target structure

```text
Wardrope_Server/
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── Wardrope.API/
│   │   ├── controllers/
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
│   │   ├── server/
│   │   ├── validation/
│   │   └── composition.ts
│   ├── Wardrope.Core/
│   │   ├── common/
│   │   │   ├── errors/
│   │   │   ├── result/
│   │   │   └── types/
│   │   ├── services/
│   │   │   ├── Auth/
│   │   │   ├── Users/
│   │   │   ├── Wardrobe/
│   │   │   ├── Products/
│   │   │   ├── Uploads/
│   │   │   ├── PhysicalProfile/
│   │   │   ├── Preferences/
│   │   │   ├── Outfits/
│   │   │   ├── Recommendations/
│   │   │   ├── Fragrances/
│   │   │   └── Weather/
│   │   └── contracts/
│   │       ├── ai/
│   │       ├── storage/
│   │       ├── weather/
│   │       └── security/
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
│   │       │   ├── User/
│   │       │   ├── Wardrobe/
│   │       │   ├── PhysicalProfile/
│   │       │   ├── Preference/
│   │       │   ├── Outfit/
│   │       │   └── Fragrance/
│   │       └── RepositoryImplementation/
│   │           ├── User/
│   │           ├── Wardrobe/
│   │           ├── PhysicalProfile/
│   │           ├── Preference/
│   │           ├── Outfit/
│   │           └── Fragrance/
│   ├── Wardrope.Infra/
│   │   ├── logging/
│   │   └── services/
│   │       ├── AI/
│   │       ├── Storage/
│   │       ├── Weather/
│   │       ├── Security/
│   │       └── ImageProcessing/
│   └── index.ts
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Dependency direction

```text
Wardrope.API
    ↓
Wardrope.Core
    ↑
Wardrope.DB      Wardrope.Infra
```

Rules:

- API coordinates HTTP concerns and calls Core services.
- Core contains business logic and must not depend on Express, MongoDB, AWS SDKs, or provider-specific SDKs.
- DB implements persistence concerns for MongoDB.
- Infra implements external service contracts used by Core.
- API composition wires concrete DB/Infra implementations into Core services.

## MVP backend features

- `Auth`: identity, login/session/token lifecycle and account access.
- `Users`: user profile and account data.
- `Wardrobe`: digital wardrobe item CRUD and ownership state.
- `Products`: objective category-specific product intelligence.
- `Uploads`: authenticated multipart ingestion and orchestration of safe server-side image handling.
- `PhysicalProfile`: physical attributes used by recommendation logic.
- `Preferences`: style and recommendation preferences.
- `Outfits`: saved outfits and wear history.
- `Recommendations`: Dress Me recommendation use cases and recommendation persistence where required.
- `Fragrances`: fragrance collection and optional complete-the-look selection.
- `Weather`: normalized weather context for recommendation use cases.
- `AI`: provider implementation in Infra only; Core consumes an interface/contract.

## Image upload flow

The frontend must never upload directly to AWS.

```text
React web app
  -> POST multipart/form-data to Wardrope.API
      -> authentication + authorization
      -> request/file validation
      -> file signature/MIME/size checks
      -> Core upload/wardrobe use case
          -> ImageProcessing service
          -> S3 Storage service (server-side AWS SDK)
          -> MongoDB repository
  <- sanitized resource response
```

Security expectations:

- private S3 bucket
- server-side AWS credentials only
- least-privilege IAM role/user
- encryption at rest
- randomized object keys; never trust client filenames
- file signature validation, not only `Content-Type`
- explicit image size/dimension limits
- image re-encoding/metadata stripping where appropriate
- authentication and ownership authorization before writes/reads
- safe error responses with no provider secrets or stack traces
- secrets loaded from environment/secret management and never committed

## AI boundary

AI-provider code belongs under `Wardrope.Infra/services/AI`. Core defines the input/output contract used by recommendation services. Controllers never call an AI SDK directly.

Recommendation context may include the user's profile, preferences, wardrobe inventory, outfit history, occasion, time, normalized weather context and fragrance collection.

## Weather boundary

Weather-provider SDK/HTTP details belong under `Wardrope.Infra/services/Weather`. The rest of the application consumes a normalized weather model rather than provider-specific payloads.

## Fragrance data principle

Fragrance records store objective data such as identity, fragrance family, scent type, key notes, concentration and ownership data. Contextual labels such as `date-night`, `office`, `summer`, `formal`, `sexy` or `evening` are not persisted as product facts; recommendation logic infers suitability from context.

## Naming

Keep Moose Server-style naming for consistency:

- controllers: `<feature>.controller.ts`
- routes: `<feature>.routes.ts`
- services: `<feature>.service.ts`
- service contracts: `<feature>.service.interface.ts`
- repositories: `<feature>.repository.ts`
- repository contracts: `<feature>.repository.interface.ts`
- MongoDB models: `<entity>.model.ts`
- validation: `<feature>.validation.ts` or focused schema files
