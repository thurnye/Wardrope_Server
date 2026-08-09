import type {
  BodyShape,
  FitPreference,
  ShoeSizeSystem,
  SkinTone,
} from '../../../../Wardrope.Core/Models/PhysicalProfile/physical-profile.model';

export interface PhysicalProfileRecord {
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export type ReplacePhysicalProfileRecord = Omit<
  PhysicalProfileRecord,
  'userId' | 'createdAt' | 'updatedAt'
>;

export interface IPhysicalProfileRepository {
  findByUserId(userId: string): Promise<PhysicalProfileRecord | null>;
  replace(
    userId: string,
    input: ReplacePhysicalProfileRecord,
  ): Promise<PhysicalProfileRecord>;
  delete(userId: string): Promise<boolean>;
  ensureIndexes(): Promise<void>;
}
