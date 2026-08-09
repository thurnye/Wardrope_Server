# Dress Me orchestration

Dress Me is a request-time recommendation feature. It consumes the authenticated user's owned wardrobe, available fragrances, saved outfits, Wear History, optional Physical Profile, structured Preferences, and optional current/near-term Weather context.

It does not persist the request, precise location, weather, occasion, dress code, or recommendation reasoning.

## API

```text
POST /api/v1/dress-me/recommend
```

The endpoint requires an authenticated session and CSRF token. It is rate-limited because a recommendation can trigger Weather/provider work.

The strict request body supports only:

```ts
{
  occasion: DressMeOccasion;
  dressCode?: DressMeDressCode | null;
  forAt?: string; // now through the next 24 hours
  location?: { latitude: number; longitude: number };
  includeFragrance?: boolean;
  recommendationCount?: 1 | 2 | 3;
}
```

There is deliberately no free-text `prompt`, `notes`, `instructions`, caller-provided `userId`, weather payload, or provenance field.

## Context assembly

The Core orchestration service loads owner-scoped, bounded context:

- up to 600 wardrobe records;
- up to 180 currently available fragrance records;
- up to 120 saved outfits;
- latest 100 Wear History entries;
- the optional Physical Profile singleton;
- the optional Preferences singleton.

If a persistent collection exceeds its context cap, Dress Me returns `candidate-limit-reached` so the caller knows recommendation context was bounded.

If coordinates are supplied, Dress Me calls the existing Weather service. That service reduces coordinate precision before provider access. Dress Me selects the weather moment nearest `forAt` and returns only normalized place/weather facts; coordinates are never returned.

If Weather fails, recommendation continues without weather and returns `weather-unavailable`. If location is omitted, Dress Me returns `weather-not-requested`.

## Provider boundary

`IDressMeRecommendationProvider` receives structured typed data, not a concatenated prompt. The first implementation is the deterministic `BaselineDressMeRecommendationProvider` and reports engine `baseline`.

The provider ranks owned pieces using bounded heuristics including:

- favorite pieces;
- preferred/avoided colors;
- repeat preference using recent Wear History;
- pattern/layer/accessory preferences;
- usual-size matches from Physical Profile;
- broad structured occasion/dress-code alignment;
- current/near-term weather and materials;
- favorite saved outfit patterns;
- fragrance availability, concentration, weather, and recent repetition.

The baseline composes one-piece looks or top+bottom looks, adds footwear when owned, and can add weather-appropriate outerwear/accessories.

## Untrusted provider output

The orchestration service treats all provider output as untrusted, including the future AI provider. Before returning recommendations it:

1. requires 1–12 unique wardrobe IDs;
2. rejects any wardrobe ID outside the authenticated candidate set;
3. rejects fragrance IDs outside the authenticated available-fragrance set;
4. requires a finite score and clamps it to 0–100;
5. filters reasons against the fixed reason-code allowlist;
6. de-duplicates identical item/fragrance recommendations;
7. enforces the requested maximum recommendation count.

If no provider output survives validation, the API returns `DRESS_ME_NO_RECOMMENDATION`.

Provider exceptions are sanitized as `DRESS_ME_UNAVAILABLE`; logs contain only the generic `dress_me_provider_failed` event, not user context, coordinates, provider bodies, or future prompt material.

## Persistence boundary

Dress Me recommendations are not automatically saved. Existing Outfits can later save an accepted composition. Future Dress Me wear recording will use a server-controlled `dress-me` provenance path; the browser will never be allowed to forge that Wear History source.

The next provider slice can add an AI implementation behind the same provider interface and response contract without changing the browser request shape or weakening the orchestration validation boundary.
