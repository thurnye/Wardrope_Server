import { z } from 'zod';
import {
  WARDROBE_CATEGORIES,
  WARDROBE_PATTERNS,
} from '../../Wardrope.Core/Models/Wardrobe/wardrobe.model';

const nameSchema = z.string().trim().min(1).max(100);
const subcategorySchema = z.string().trim().min(1).max(60);
const brandSchema = z.string().trim().min(1).max(80);
const colorSchema = z.string().trim().min(1).max(40);
const materialSchema = z.string().trim().min(1).max(60);
const sizeSchema = z.string().trim().min(1).max(40);
const sourceUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .url()
  .refine((value) => new URL(value).protocol === 'https:', {
    message: 'Product links must use HTTPS.',
  });

export const wardrobeItemIdParamsSchema = z
  .object({
    itemId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Wardrobe item ID is invalid.'),
  })
  .strict();

export const createWardrobeItemBodySchema = z
  .object({
    name: nameSchema,
    category: z.enum(WARDROBE_CATEGORIES),
    subcategory: subcategorySchema,
    brand: brandSchema.nullable().optional(),
    colors: z.array(colorSchema).min(1).max(5),
    materials: z.array(materialSchema).max(8).optional(),
    pattern: z.enum(WARDROBE_PATTERNS).nullable().optional(),
    size: sizeSchema.nullable().optional(),
    favorite: z.boolean().optional(),
    sourceUrl: sourceUrlSchema.nullable().optional(),
  })
  .strict();

export const updateWardrobeItemBodySchema = z
  .object({
    name: nameSchema.optional(),
    category: z.enum(WARDROBE_CATEGORIES).optional(),
    subcategory: subcategorySchema.optional(),
    brand: brandSchema.nullable().optional(),
    colors: z.array(colorSchema).min(1).max(5).optional(),
    materials: z.array(materialSchema).max(8).optional(),
    pattern: z.enum(WARDROBE_PATTERNS).nullable().optional(),
    size: sizeSchema.nullable().optional(),
    favorite: z.boolean().optional(),
    sourceUrl: sourceUrlSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one wardrobe field must be provided.',
  });

export const productImportPreviewBodySchema = z
  .object({
    sourceUrl: sourceUrlSchema,
  })
  .strict();

export const importProductImageBodySchema = z
  .object({
    imageUrl: z.string().trim().url().optional(),
    imageUrls: z.array(z.string().trim().url()).min(1).max(8).optional(),
  })
  .strict()
  .refine((value) => !(value.imageUrl && value.imageUrls), {
    message: 'Send imageUrls or the legacy imageUrl, not both.',
  });

export const wardrobeListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(60).default(24),
    category: z.enum(WARDROBE_CATEGORIES).optional(),
    favorite: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
