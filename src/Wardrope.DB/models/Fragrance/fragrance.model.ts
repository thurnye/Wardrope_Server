import type { ObjectId } from 'mongodb';
import type { FragranceConcentration } from '../../../Wardrope.Core/Models/Fragrance/fragrance.model';

export const FRAGRANCES_COLLECTION = 'fragrances';

export interface FragranceImageDocument {
  objectKey: string;
  etag: string | null;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: Date;
}

export interface FragrancePurchasePriceDocument {
  amount: number;
  currency: string;
}

export interface FragranceDocument {
  _id: ObjectId;
  userId: ObjectId;
  brand: string;
  name: string;
  productLine: string | null;
  concentration: FragranceConcentration | null;
  fragranceFamily: string | null;
  scentType: string | null;
  keyNotes: string[];
  bottleSizeMl: number | null;
  amountRemainingPercent: number | null;
  purchaseDate: string | null;
  purchasePrice: FragrancePurchasePriceDocument | null;
  available: boolean;
  sourceUrl?: string | null;
  image: FragranceImageDocument | null;
  createdAt: Date;
  updatedAt: Date;
}
