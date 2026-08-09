import type { ObjectId } from 'mongodb';
import type { WearHistorySource } from '../../../Wardrope.Core/Models/Outfit/outfit.model';

export const OUTFITS_COLLECTION = 'outfits';
export const WEAR_HISTORY_COLLECTION = 'wear_history';

export interface OutfitDocument {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  wardrobeItemIds: ObjectId[];
  fragranceId: ObjectId | null;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WearHistoryDocument {
  _id: ObjectId;
  userId: ObjectId;
  wornAt: Date;
  wardrobeItemIds: ObjectId[];
  fragranceId: ObjectId | null;
  sourceOutfitId: ObjectId | null;
  source: WearHistorySource;
  createdAt: Date;
  updatedAt: Date;
}
