import { z } from 'zod';
import {
  DRESS_ME_DRESS_CODES,
  DRESS_ME_OCCASIONS,
} from '../../Wardrope.Core/Models/DressMe/dress-me.model';

const forAtSchema = z.string().datetime({ offset: true }).superRefine((value, ctx) => {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  if (timestamp < now - 5 * 60 * 1_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dress Me target time cannot be in the past.' });
  }
  if (timestamp > now + 24 * 60 * 60 * 1_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dress Me supports target times within the next 24 hours.' });
  }
});

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

export const dressMeRequestBodySchema = z.object({
  occasion: z.enum(DRESS_ME_OCCASIONS),
  dressCode: z.enum(DRESS_ME_DRESS_CODES).nullable().optional(),
  forAt: forAtSchema.optional(),
  location: locationSchema.optional(),
  includeFragrance: z.boolean().optional(),
  recommendationCount: z.number().int().min(1).max(3).optional(),
}).strict();
