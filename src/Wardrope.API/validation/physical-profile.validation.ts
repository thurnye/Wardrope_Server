import { z } from 'zod';
import {
  BODY_SHAPES,
  FIT_PREFERENCES,
  SHOE_SIZE_SYSTEMS,
  SKIN_TONES,
} from '../../Wardrope.Core/Models/PhysicalProfile/physical-profile.model';

const nullableMeasurement = (min: number, max: number, label: string) =>
  z.number()
    .finite()
    .min(min, `${label} is below the supported range.`)
    .max(max, `${label} is above the supported range.`)
    .nullable()
    .optional();

const nullableSize = z.string().trim().min(1).max(32).nullable().optional();

export const replacePhysicalProfileBodySchema = z.object({
  heightCm: nullableMeasurement(80, 260, 'Height'),
  shoulderWidthCm: nullableMeasurement(15, 100, 'Shoulder width'),
  chestCm: nullableMeasurement(30, 300, 'Chest measurement'),
  waistCm: nullableMeasurement(30, 300, 'Waist measurement'),
  hipsCm: nullableMeasurement(30, 300, 'Hip measurement'),
  inseamCm: nullableMeasurement(20, 150, 'Inseam'),
  sleeveLengthCm: nullableMeasurement(20, 130, 'Sleeve length'),
  bodyShape: z.enum(BODY_SHAPES).nullable().optional(),
  skinTone: z.enum(SKIN_TONES).nullable().optional(),
  fitPreference: z.enum(FIT_PREFERENCES).nullable().optional(),
  usualTopSize: nullableSize,
  usualBottomSize: nullableSize,
  usualOnePieceSize: nullableSize,
  usualOuterwearSize: nullableSize,
  shoeSize: z.string().trim().min(1).max(16).nullable().optional(),
  shoeSizeSystem: z.enum(SHOE_SIZE_SYSTEMS).nullable().optional(),
}).strict().superRefine((value, context) => {
  const meaningfulValues = Object.values(value).filter(
    (entry) => entry !== undefined && entry !== null,
  );

  if (meaningfulValues.length === 0) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: 'Provide at least one profile detail or use DELETE to reset the profile.',
    });
  }

  const hasShoeSize = value.shoeSize !== undefined && value.shoeSize !== null;
  const hasShoeSystem = value.shoeSizeSystem !== undefined && value.shoeSizeSystem !== null;

  if (hasShoeSize !== hasShoeSystem) {
    context.addIssue({
      code: 'custom',
      path: hasShoeSize ? ['shoeSizeSystem'] : ['shoeSize'],
      message: 'Shoe size and shoe-size system must be provided together.',
    });
  }
});
