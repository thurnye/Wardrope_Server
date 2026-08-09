# Wardrope Preferences

Preferences is a private, optional singleton that stores durable style choices used to tune recommendations. It is deliberately structured rather than a free-text AI prompt.

## API

```text
GET    /api/v1/preferences
PUT    /api/v1/preferences
DELETE /api/v1/preferences
```

- `GET` returns the authenticated user's preferences or `null`.
- `PUT` is full replacement: omitted lists become empty and omitted scalar controls become `null`.
- `DELETE` explicitly resets the preference document and is idempotent.
- mutations require the authenticated cookie session and CSRF token.
- ownership comes only from the authenticated request context; `userId` and internal IDs are never accepted or returned.

## Persisted fields

- preferred/avoided style aesthetics;
- preferred/avoided color labels;
- experimentation level;
- accessory level;
- pattern boldness level;
- layering level;
- rewear-versus-variety preference.

## Deliberate exclusions

Preferences does not store:

- fit preference or clothing/shoe sizes — those belong to Physical Profile;
- occasion or dress-code request context — that belongs to each Dress Me request;
- location or weather — weather context is resolved at request time;
- fragrance product/context labels — those belong to the Fragrances domain and contextual recommendation logic;
- age, gender, health, or other demographic data;
- arbitrary free-text instructions/notes for the AI.

This separation prevents multiple sources of truth and reduces both privacy and prompt-injection risk.

## Validation and normalization

- aesthetics are allowlisted enums, at most 8 per preferred/avoided list;
- color labels are bounded to 40 characters, at most 12 per preferred/avoided list, with control characters rejected;
- arrays are normalized/deduplicated by Core;
- case/whitespace-equivalent color conflicts are rejected;
- the same aesthetic cannot be both preferred and avoided;
- all-empty PUT requests are rejected in favor of explicit DELETE reset;
- MongoDB enforces one preferences document per user through a unique `userId` index.

## AI trust boundary

All Preferences values remain **untrusted user data**, even when allowlisted/bounded. Future recommendation code must not concatenate user-controlled values into system/developer instructions.

When Preferences are supplied to an AI provider, the recommendation layer must:

1. serialize them as structured data fields;
2. keep system/developer instructions separate from user data;
3. treat color labels and every other user-controlled string as content, never instructions;
4. bound the amount of preference data included in a request;
5. avoid logging raw recommendation context unless explicitly required and privacy-reviewed;
6. validate the model's structured response before using it in Wardrope.
