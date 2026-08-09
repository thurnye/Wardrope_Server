import type { ObjectId } from 'mongodb';
import type {
  BodyShape,
  FitPreference,
  ShoeSizeSystem,
  SkinTone,
} from '../../../Wardrope.Core/Models/PhysicalProfile/physical-profile.model';

export const PHYSICAL_PROFILES_COLLECTION = 'physicalProfiles';

export interface PhysicalProfileDocument {
  _id: ObjectId;
  userId: ObjectId;
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
