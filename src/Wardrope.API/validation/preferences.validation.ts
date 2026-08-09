import { z } from 'zod';
import {
  ACCESSORY_LEVELS,
  EXPERIMENTATION_LEVELS,
  LAYERING_LEVELS,
  PATTERN_LEVELS,
  REPEAT_PREFERENCES,
  STYLE_AESTHETICS,
} from '../../Wardrope.Core/Models/Preferences/preferences.model';

const aestheticList = z.array(z.enum(STYLE_AESTHETICS)).max(8).optional();
const colorList = z.array(
  z.string()
    .trim()
    .min(1)
    .max(40)
    .refine((value) => !/[\u0000-\u001F\u007F]/u.test(value), {
      message: 'Color labels cannot contain control characters.',
    }),
).max(12).optional();

function normalizedKeys(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')));
}

export const replacePreferencesBodySchema = z.object({
  preferredAesthetics: aestheticList,
  avoidedAesthetics: aestheticList,
  preferredColors: colorList,
  avoidedColors: colorList,
  experimentationLevel: z.enum(EXPERIMENTATION_LEVELS).nullable().optional(),
  accessoryLevel: z.enum(ACCESSORY_LEVELS).nullable().optional(),
  patternLevel: z.enum(PATTERN_LEVELS).nullable().optional(),
  layeringLevel: z.enum(LAYERING_LEVELS).nullable().optional(),
  repeatPreference: z.enum(REPEAT_PREFERENCES).nullable().optional(),
}).strict().superRefine((value, context) => {
  const meaningful = [
    ...(value.preferredAesthetics ?? []),
    ...(value.avoidedAesthetics ?? []),
    ...(value.preferredColors ?? []),
    ...(value.avoidedColors ?? []),
    value.experimentationLevel,
    value.accessoryLevel,
    value.patternLevel,
    value.layeringLevel,
    value.repeatPreference,
  ].some((entry) => entry !== undefined && entry !== null);

  if (!meaningful) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: 'Provide at least one preference or use DELETE to reset preferences.',
    });
  }

  const avoidedAesthetics = new Set(value.avoidedAesthetics ?? []);
  const aestheticConflict = (value.preferredAesthetics ?? []).find((item) => avoidedAesthetics.has(item));
  if (aestheticConflict) {
    context.addIssue({
      code: 'custom',
      path: ['avoidedAesthetics'],
      message: 'The same aesthetic cannot be both preferred and avoided.',
    });
  }

  const avoidedColors = normalizedKeys(value.avoidedColors);
  const colorConflict = (value.preferredColors ?? []).find((item) =>
    avoidedColors.has(item.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')),
  );
  if (colorConflict) {
    context.addIssue({
      code: 'custom',
      path: ['avoidedColors'],
      message: 'The same color cannot be both preferred and avoided.',
    });
  }
});
