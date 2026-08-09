# OpenAI Dress Me provider

The OpenAI Dress Me provider is an optional server-only ranking adapter behind the existing `IDressMeRecommendationProvider` contract. It does not change the browser request or response shape.

## Configuration

Configure both backend-only environment variables to enable AI ranking:

```text
OPENAI_API_KEY=<server secret>
OPENAI_DRESS_ME_MODEL=<deployment-selected Responses-compatible model>
```

If both are omitted, Wardrope uses the deterministic baseline provider. If only one is configured, runtime configuration fails closed rather than running in a partially configured state.

The model name is intentionally deployment-configured instead of hardcoded so model upgrades do not require an application code change.

The API key must never be exposed through Vite variables, browser code, logs, MongoDB, API responses, or client-side configuration.

## OpenAI request

The infrastructure adapter calls only:

```text
POST https://api.openai.com/v1/responses
```

The request uses:

- a fixed HTTPS endpoint;
- `Authorization: Bearer <OPENAI_API_KEY>`;
- `store: false`;
- fixed privileged `instructions` owned by Wardrope;
- user/context data only inside a JSON-serialized user `input` message;
- Structured Outputs through `text.format` with a strict JSON schema;
- `max_output_tokens: 1200`;
- a 12-second timeout;
- redirect rejection;
- JSON response content-type validation;
- a 1 MB maximum response body.

No raw OpenAI request, model input, model output, API error body, or API key is logged.

## Prompt-injection boundary

Wardrobe/profile/fragrance text is untrusted data. Product names, brands, materials, and other fields may contain arbitrary strings, including text that resembles instructions.

The fixed privileged instructions explicitly tell the ranker that every value in the user JSON is data only and that instructions embedded in those values must be ignored. User-controlled values are never concatenated into the privileged `instructions` string.

The browser has no free-text Dress Me prompt field, so users cannot place arbitrary text directly into a privileged prompt channel.

## Data minimization

The model receives only information needed to rank the current bounded candidates.

Wardrobe candidates include:

- ID;
- name/category/subcategory;
- optional brand;
- colors/materials/pattern/size;
- favorite state.

The model does **not** receive wardrobe source URLs, image metadata, or persistence timestamps.

Fragrance candidates include:

- ID;
- brand/name;
- concentration;
- fragrance family/scent type;
- key notes;
- estimated amount remaining.

The model does **not** receive fragrance purchase price/date, bottle images, or persistence timestamps.

Physical Profile is minimized to:

- fit preference;
- usual top size;
- usual bottom size;
- usual one-piece size;
- usual outerwear size.

Exact body measurements, body-shape descriptor, skin-tone descriptor, shoe information, and profile persistence timestamps are not sent to the external AI provider in this MVP.

Preferences are sent as their bounded structured controls. Saved outfit context contains only item IDs, optional fragrance ID, and favorite state. Wear History is reduced to the most recent 30 events and contains only worn time, item IDs, optional fragrance ID, and server-controlled source.

## Structured output and trust boundary

OpenAI returns a structured object containing recommendation item IDs, optional fragrance ID, score, and fixed reason codes. The infrastructure adapter parses it with Zod before returning it to Core.

AI output is still treated as untrusted. `DressMeService` remains the final security boundary and independently:

- rejects wardrobe IDs outside the authenticated candidate set;
- rejects fragrance IDs outside the authenticated available-fragrance set;
- enforces 1–12 unique wardrobe IDs;
- clamps finite scores to 0–100;
- filters reason codes through the fixed allowlist;
- deduplicates recommendations;
- enforces the requested maximum result count.

The AI provider never receives direct repository access and cannot fetch arbitrary Wardrope records.

## Baseline fallback

When OpenAI is configured, AI is the primary ranking provider and the deterministic baseline remains a server-side fallback.

Wardrope falls back when:

- the OpenAI adapter throws because of timeout, HTTP failure, refusal/missing output, malformed JSON, schema failure, or another provider error; or
- no AI recommendation survives the authenticated candidate-set validation.

Fallback logs only the generic event `dress_me_provider_fallback`. If the fallback also fails, the orchestration logs only `dress_me_provider_failed` and returns the existing sanitized service-unavailable response.

The API response reports the provider that actually produced the final recommendations through `engine: "ai" | "baseline"`.

## Persistence

Neither AI input nor AI output is persisted by this provider. Dress Me continues to be request-time context. Saving a recommendation still creates a normal saved Outfit through the existing Outfits API, without persisting the Dress Me request, location, weather, score, or AI reasoning.
