export const BODY_SHAPES = [
  'rectangle',
  'triangle',
  'inverted-triangle',
  'oval',
  'hourglass',
  'unsure',
] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];

export const SKIN_TONES = [
  'very-light',
  'light',
  'medium',
  'tan',
  'deep',
  'very-deep',
  'unsure',
] as const;

export type SkinTone = (typeof SKIN_TONES)[number];

export const FIT_PREFERENCES = [
  'close',
  'regular',
  'relaxed',
  'oversized',
  'varies',
] as const;

export type FitPreference = (typeof FIT_PREFERENCES)[number];

export const SHOE_SIZE_SYSTEMS = [
  'US_MENS',
  'US_WOMENS',
  'UK',
  'EU',
  'CM',
] as const;

export type ShoeSizeSystem = (typeof SHOE_SIZE_SYSTEMS)[number];

export interface PhysicalProfileDto {
  heightCm: number | null;
  shoulderWidthCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  inseamCm: number | null;
  sleeveLengthCm: number | null;
  bodyShape: BodyShape | null;
  skinTone: SkinTone | null;
  fitPreference: FitPreference | null;
  usualTopSize: string | null;
  usualBottomSize: string | null;
  usualOnePieceSize: string | null;
  usualOuterwearSize: string | null;
  shoeSize: string | null;
  shoeSizeSystem: ShoeSizeSystem | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * PUT semantics are full replacement. Omitted or null profile facts are cleared.
 * DELETE is the explicit reset operation for removing the profile document entirely.
 */
export interface ReplacePhysicalProfileDto {
  heightCm?: number | null | undefined;
  shoulderWidthCm?: number | null | undefined;
  chestCm?: number | null | undefined;
  waistCm?: number | null | undefined;
  hipsCm?: number | null | undefined;
  inseamCm?: number | null | undefined;
  sleeveLengthCm?: number | null | undefined;
  bodyShape?: BodyShape | null | undefined;
  skinTone?: SkinTone | null | undefined;
  fitPreference?: FitPreference | null | undefined;
  usualTopSize?: string | null | undefined;
  usualBottomSize?: string | null | undefined;
  usualOnePieceSize?: string | null | undefined;
  usualOuterwearSize?: string | null | undefined;
  shoeSize?: string | null | undefined;
  shoeSizeSystem?: ShoeSizeSystem | null | undefined;
}
