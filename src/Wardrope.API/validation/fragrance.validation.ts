import { z } from 'zod';
import { FRAGRANCE_CONCENTRATIONS } from '../../Wardrope.Core/Models/Fragrance/fragrance.model';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => requiredText(max).nullable().optional();
const noteSchema = requiredText(60);
const sourceUrlSchema = z.string().trim().url().refine((value) => new URL(value).protocol === 'https:');
const purchaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must use YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, { message: 'Purchase date is invalid.' });
const priceSchema = z.object({
  amount: z.number().finite().min(0).max(1_000_000),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Currency must be a three-letter code.'),
}).strict();

export const fragranceIdParamsSchema = z.object({
  fragranceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Fragrance ID is invalid.'),
}).strict();

export const createFragranceBodySchema = z.object({
  brand: requiredText(100),
  name: requiredText(120),
  productLine: optionalText(120),
  concentration: z.enum(FRAGRANCE_CONCENTRATIONS).nullable().optional(),
  fragranceFamily: optionalText(80),
  scentType: optionalText(80),
  keyNotes: z.array(noteSchema).max(20).optional(),
  bottleSizeMl: z.number().finite().positive().max(5_000).nullable().optional(),
  amountRemainingPercent: z.number().finite().min(0).max(100).nullable().optional(),
  purchaseDate: purchaseDateSchema.nullable().optional(),
  purchasePrice: priceSchema.nullable().optional(),
  available: z.boolean().optional(),
  sourceUrl: sourceUrlSchema.nullable().optional(),
}).strict();

export const updateFragranceBodySchema = z.object({
  brand: requiredText(100).optional(),
  name: requiredText(120).optional(),
  productLine: optionalText(120),
  concentration: z.enum(FRAGRANCE_CONCENTRATIONS).nullable().optional(),
  fragranceFamily: optionalText(80),
  scentType: optionalText(80),
  keyNotes: z.array(noteSchema).max(20).optional(),
  bottleSizeMl: z.number().finite().positive().max(5_000).nullable().optional(),
  amountRemainingPercent: z.number().finite().min(0).max(100).nullable().optional(),
  purchaseDate: purchaseDateSchema.nullable().optional(),
  purchasePrice: priceSchema.nullable().optional(),
  available: z.boolean().optional(),
  sourceUrl: sourceUrlSchema.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one fragrance field must be provided.',
});

export const fragranceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  available: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  concentration: z.enum(FRAGRANCE_CONCENTRATIONS).optional(),
  search: z.string().trim().min(1).max(80).optional(),
}).strict();
