# Physical Profile

Wardrope Physical Profile is a private, optional singleton owned by the authenticated user. It stores only clothing-fit and recommendation inputs the user deliberately chooses to provide.

## API

```text
GET    /api/v1/physical-profile
PUT    /api/v1/physical-profile
DELETE /api/v1/physical-profile
```

- `GET` returns the current profile or `null`.
- `PUT` is a **full replacement**. Omitted or `null` facts are cleared so stale measurements are not silently retained.
- `DELETE` explicitly resets the profile document and is idempotent.
- `PUT` and `DELETE` require the authenticated cookie session and CSRF token.
- Ownership always comes from the authenticated request context. The API does not accept or return `userId` or a profile identifier.

## Data minimization

The MVP deliberately does **not** collect:

- age or date of birth;
- weight;
- sex or gender identity;
- health, disability, medication, or medical information;
- inferred body classification.

Optional profile facts are limited to:

- height and selected clothing measurements in canonical centimeters;
- usual clothing sizes;
- shoe size plus its sizing system;
- fit preference;
- a user-selected body-shape descriptor;
- a user-selected broad skin-tone depth.

`bodyShape` and `skinTone` are never required or inferred. They are self-described recommendation inputs only and can be removed at any time by replacing or resetting the profile.

## Canonical measurement policy

The API and MongoDB store measurements in centimeters. Presentation layers may display imperial values, but conversions belong at the UI boundary so recommendation logic receives one canonical unit system.

## Security and privacy properties

- one profile per authenticated user, enforced by a unique MongoDB `userId` index;
- all MongoDB reads/writes/deletes are owner-scoped with server-derived user identity;
- strict allowlisted request schema rejects unknown fields and ownership injection;
- bounded numeric measurements and bounded size strings;
- shoe size and shoe-size system must be provided together;
- all-empty writes are rejected; use `DELETE` for an explicit reset;
- profile IDs and internal ownership fields never appear in public DTOs;
- profile endpoints inherit Wardrope's trusted-origin, rate-limit, request-ID, security-header, session, and error-sanitization middleware.

These profile values remain private Wardrope application data. Future recommendation integrations must pass only the minimum fields needed for a specific request and must not treat profile values as privileged AI instructions.
