import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifier is invalid.');
const itemIdsSchema = z.array(objectIdSchema).min(1).max(12).superRefine((values, ctx) => {
  const normalized = values.map((value) => value.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Wardrobe item IDs must be unique.' });
  }
});
const isoDateTimeSchema = z.string().datetime({ offset: true }).refine((value) => {
  const timestamp = new Date(value).getTime();
  return timestamp <= Date.now() + 5 * 60 * 1_000;
}, { message: 'Wear time cannot be in the future.' });

export const outfitIdParamsSchema = z.object({ outfitId: objectIdSchema }).strict();
export const wearHistoryIdParamsSchema = z.object({ historyId: objectIdSchema }).strict();

export const createOutfitBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  wardrobeItemIds: itemIdsSchema,
  fragranceId: objectIdSchema.nullable().optional(),
  favorite: z.boolean().optional(),
}).strict();

export const updateOutfitBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  wardrobeItemIds: itemIdsSchema.optional(),
  fragranceId: objectIdSchema.nullable().optional(),
  favorite: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one outfit field must be provided.',
});

export const outfitListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  favorite: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  search: z.string().trim().min(1).max(80).optional(),
}).strict();

export const createWearHistoryBodySchema = z.object({
  wornAt: isoDateTimeSchema,
  wardrobeItemIds: itemIdsSchema,
  fragranceId: objectIdSchema.nullable().optional(),
}).strict();

export const recordOutfitWearBodySchema = z.object({
  wornAt: isoDateTimeSchema,
}).strict();

export const updateWearHistoryBodySchema = z.object({
  wornAt: isoDateTimeSchema.optional(),
  wardrobeItemIds: itemIdsSchema.optional(),
  fragranceId: objectIdSchema.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one wear history field must be provided.',
});

export const wearHistoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to), {
  message: '`from` must not be after `to`.',
});
