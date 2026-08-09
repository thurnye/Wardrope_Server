# Outfits and Wear History

Outfits and Wear History form the non-AI bridge between owned wardrobe data and the future Dress Me recommendation engine.

## Saved outfits

```text
GET    /api/v1/outfits
POST   /api/v1/outfits
GET    /api/v1/outfits/:outfitId
PATCH  /api/v1/outfits/:outfitId
DELETE /api/v1/outfits/:outfitId
POST   /api/v1/outfits/:outfitId/wear
```

A saved outfit contains only:

- a user-defined name;
- 1–12 unique wardrobe item IDs;
- an optional fragrance ID;
- favorite state;
- timestamps.

It does **not** persist occasion, dress code, weather, precise location, free-text AI instructions, or generated recommendation reasoning.

Every wardrobe/fragrance reference is resolved through the authenticated owner before create/update. A caller cannot supply `userId`.

When a wardrobe item is deleted, it is removed from that user's saved outfits; outfits left with zero items are removed. When a fragrance is deleted, its saved-outfit reference is cleared. These cleanup operations never rewrite historical wear entries.

## Wear History

```text
GET    /api/v1/outfits/wear-history
POST   /api/v1/outfits/wear-history
GET    /api/v1/outfits/wear-history/:historyId
PATCH  /api/v1/outfits/wear-history/:historyId
DELETE /api/v1/outfits/wear-history/:historyId
```

Wear History records what was actually worn:

- `wornAt`;
- 1–12 wardrobe item IDs;
- optional fragrance ID;
- server-controlled provenance (`manual`, `saved-outfit`, or future `dress-me`);
- optional server-controlled source outfit ID;
- timestamps.

Manual browser entries can submit only `wornAt`, wardrobe item IDs, and an optional fragrance ID. The API rejects `source`, `sourceOutfitId`, `userId`, location, weather, occasion, and other extra fields.

`POST /outfits/:outfitId/wear` snapshots the current saved outfit into Wear History and marks provenance as `saved-outfit` on the server. The browser cannot forge this provenance. Future Dress Me orchestration will similarly write `dress-me` provenance internally rather than accepting it from clients.

Wear History intentionally retains historical IDs if a wardrobe item, fragrance, or saved outfit is later deleted. This preserves the factual historical event instead of rewriting history. Editing a history record does not allow its provenance to be changed.

Wear timestamps cannot be materially in the future. List queries support bounded pagination and optional `from`/`to` timestamp filtering.

## Privacy and recommendation boundary

Neither collection stores precise location or weather history. Occasion and dress code remain request-time Dress Me context. This means future recommendation logic can use current weather plus prior wear frequency without turning transient location/weather context into persistent user tracking.
