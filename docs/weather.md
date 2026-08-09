# Weather context

Weather is transient request-time context for outfit recommendations. Wardrope does not create a weather collection and does not persist precise user coordinates or weather history in MongoDB.

## API

```text
GET /api/v1/weather/context?latitude=<decimal>&longitude=<decimal>
```

The endpoint requires an authenticated Wardrope session. It is read-only, so it does not require CSRF, and it has a provider-specific rate limit.

The API strictly accepts only `latitude` and `longitude`. Latitude must be between -90 and 90 and longitude between -180 and 180.

## Privacy flow

1. The browser obtains location only after the user/browser grants geolocation permission, or later from an explicit user-entered location flow.
2. The browser sends coordinates only to Wardrope Server for the immediate weather request.
3. Core rounds the coordinates to two decimal places before any provider call. The original browser precision is not forwarded.
4. Infrastructure calls WeatherAPI.com with the reduced-precision coordinates and the server-only `WEATHER_API_KEY`.
5. The provider response is validated and normalized.
6. Wardrope returns a resolved place label plus outfit-relevant weather facts. Coordinates and provider credentials are not returned.
7. No weather/location record is written to MongoDB.

Application logs must not contain raw coordinates, provider URLs, provider response bodies, or provider keys.

## Normalized context

The response contains:

- resolved city/region/country/timezone labels when available;
- current temperature and feels-like temperature;
- condition text/code and day/night state;
- humidity and cloud cover;
- wind and gust speed;
- precipitation and UV index;
- today's min/max temperature, precipitation, max wind, and rain/snow probability;
- up to the next 24 hourly forecast entries across today/tomorrow.

The browser does not receive provider-specific image URLs or raw provider JSON.

## Provider boundary

The first infrastructure adapter uses WeatherAPI.com `forecast.json` with two forecast days, air quality disabled, and alerts disabled. The Core contract is provider-agnostic so a later provider change does not alter controllers, Dress Me orchestration, or frontend DTOs.

`WEATHER_API_KEY` is required for non-test runtime and belongs only in backend deployment secrets. Do not expose it through Vite environment variables or frontend code.

Provider requests use a fixed HTTPS host, an 8-second timeout, no redirect following, JSON content checks, a bounded 2 MB response, and schema validation before mapping.
