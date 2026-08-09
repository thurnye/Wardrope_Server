export const STYLE_AESTHETICS = [
  'classic',
  'minimalist',
  'smart-casual',
  'business',
  'formal',
  'streetwear',
  'sporty',
  'preppy',
  'vintage',
  'bohemian',
  'romantic',
  'edgy',
  'workwear',
  'contemporary',
] as const;

export type StyleAesthetic = (typeof STYLE_AESTHETICS)[number];

export const EXPERIMENTATION_LEVELS = [
  'familiar',
  'balanced',
  'experimental',
] as const;
export type ExperimentationLevel = (typeof EXPERIMENTATION_LEVELS)[number];

export const ACCESSORY_LEVELS = [
  'minimal',
  'balanced',
  'statement',
] as const;
export type AccessoryLevel = (typeof ACCESSORY_LEVELS)[number];

export const PATTERN_LEVELS = [
  'minimal',
  'balanced',
  'bold',
] as const;
export type PatternLevel = (typeof PATTERN_LEVELS)[number];

export const LAYERING_LEVELS = [
  'minimal',
  'balanced',
  'layered',
] as const;
export type LayeringLevel = (typeof LAYERING_LEVELS)[number];

export const REPEAT_PREFERENCES = [
  'rewear-friendly',
  'balanced',
  'maximize-variety',
] as const;
export type RepeatPreference = (typeof REPEAT_PREFERENCES)[number];

export interface PreferencesDto {
  preferredAesthetics: StyleAesthetic[];
  avoidedAesthetics: StyleAesthetic[];
  preferredColors: string[];
  avoidedColors: string[];
  experimentationLevel: ExperimentationLevel | null;
  accessoryLevel: AccessoryLevel | null;
  patternLevel: PatternLevel | null;
  layeringLevel: LayeringLevel | null;
  repeatPreference: RepeatPreference | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * PUT uses full replacement semantics. Missing list fields become empty arrays and missing scalar
 * fields become null so obsolete recommendation preferences are never silently retained.
 */
export interface ReplacePreferencesDto {
  preferredAesthetics?: StyleAesthetic[] | undefined;
  avoidedAesthetics?: StyleAesthetic[] | undefined;
  preferredColors?: string[] | undefined;
  avoidedColors?: string[] | undefined;
  experimentationLevel?: ExperimentationLevel | null | undefined;
  accessoryLevel?: AccessoryLevel | null | undefined;
  patternLevel?: PatternLevel | null | undefined;
  layeringLevel?: LayeringLevel | null | undefined;
  repeatPreference?: RepeatPreference | null | undefined;
}
