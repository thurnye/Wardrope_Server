import { ObjectId, type Filter } from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  FRAGRANCES_COLLECTION,
  type FragranceDocument,
  type FragranceImageDocument,
} from '../../../models/Fragrance/fragrance.model';
import type {
  CreateFragranceDto,
  UpdateFragranceDto,
} from '../../../../Wardrope.Core/Models/Fragrance/fragrance.model';
import type {
  FragranceRecord,
  FragranceRepositoryListResult,
  FragranceRepositoryQuery,
  FragranceStoredImageRecord,
  IFragranceRepository,
} from '../../RepositoryInterface/Fragrance/fragrance.repository.interface';

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapImage(image: FragranceImageDocument | null | undefined): FragranceStoredImageRecord | null {
  return image ? { ...image } : null;
}

function mapRecord(document: FragranceDocument): FragranceRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    brand: document.brand,
    name: document.name,
    productLine: document.productLine,
    concentration: document.concentration,
    fragranceFamily: document.fragranceFamily,
    scentType: document.scentType,
    keyNotes: [...document.keyNotes],
    bottleSizeMl: document.bottleSizeMl,
    amountRemainingPercent: document.amountRemainingPercent,
    purchaseDate: document.purchaseDate,
    purchasePrice: document.purchasePrice ? { ...document.purchasePrice } : null,
    available: document.available,
    sourceUrl: document.sourceUrl ?? null,
    image: mapImage(document.image),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function imageCompareFilter(
  _id: ObjectId,
  userId: ObjectId,
  expectedObjectKey: string | null,
): Filter<FragranceDocument> {
  const filter: Filter<FragranceDocument> = { _id, userId };
  if (expectedObjectKey === null) {
    filter.$or = [{ image: null }, { image: { $exists: false } }];
  } else {
    Object.assign(filter, { 'image.objectKey': expectedObjectKey });
  }
  return filter;
}

export class FragranceRepository implements IFragranceRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database.getDatabase().collection<FragranceDocument>(FRAGRANCES_COLLECTION);
  }

  async create(userId: string, input: CreateFragranceDto): Promise<FragranceRecord> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) throw new Error('Cannot create a fragrance for an invalid user identifier.');

    const now = new Date();
    const document: FragranceDocument = {
      _id: new ObjectId(),
      userId: ownerId,
      brand: input.brand,
      name: input.name,
      productLine: input.productLine ?? null,
      concentration: input.concentration ?? null,
      fragranceFamily: input.fragranceFamily ?? null,
      scentType: input.scentType ?? null,
      keyNotes: [...(input.keyNotes ?? [])],
      bottleSizeMl: input.bottleSizeMl ?? null,
      amountRemainingPercent: input.amountRemainingPercent ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchasePrice: input.purchasePrice ? { ...input.purchasePrice } : null,
      available: input.available ?? true,
      sourceUrl: input.sourceUrl ?? null,
      image: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(document);
    return mapRecord(document);
  }

  async list(userId: string, query: FragranceRepositoryQuery): Promise<FragranceRepositoryListResult> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return { items: [], totalItems: 0 };

    const filter: Filter<FragranceDocument> = { userId: ownerId };
    if (query.available !== undefined) filter.available = query.available;
    if (query.concentration) filter.concentration = query.concentration;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { brand: search },
        { name: search },
        { productLine: search },
        { fragranceFamily: search },
        { scentType: search },
        { keyNotes: search },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [documents, totalItems] = await Promise.all([
      this.collection.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).toArray(),
      this.collection.countDocuments(filter),
    ]);

    return { items: documents.map(mapRecord), totalItems };
  }

  async findById(userId: string, fragranceId: string): Promise<FragranceRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(fragranceId);
    if (!ownerId || !_id) return null;
    const document = await this.collection.findOne({ _id, userId: ownerId });
    return document ? mapRecord(document) : null;
  }

  async update(userId: string, fragranceId: string, input: UpdateFragranceDto): Promise<FragranceRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(fragranceId);
    if (!ownerId || !_id) return null;

    const fields: Partial<FragranceDocument> = { updatedAt: new Date() };
    if (input.brand !== undefined) fields.brand = input.brand;
    if (input.name !== undefined) fields.name = input.name;
    if (input.productLine !== undefined) fields.productLine = input.productLine;
    if (input.concentration !== undefined) fields.concentration = input.concentration;
    if (input.fragranceFamily !== undefined) fields.fragranceFamily = input.fragranceFamily;
    if (input.scentType !== undefined) fields.scentType = input.scentType;
    if (input.keyNotes !== undefined) fields.keyNotes = [...input.keyNotes];
    if (input.bottleSizeMl !== undefined) fields.bottleSizeMl = input.bottleSizeMl;
    if (input.amountRemainingPercent !== undefined) fields.amountRemainingPercent = input.amountRemainingPercent;
    if (input.purchaseDate !== undefined) fields.purchaseDate = input.purchaseDate;
    if (input.purchasePrice !== undefined) fields.purchasePrice = input.purchasePrice ? { ...input.purchasePrice } : null;
    if (input.available !== undefined) fields.available = input.available;
    if (input.sourceUrl !== undefined) fields.sourceUrl = input.sourceUrl;

    const result = await this.collection.updateOne({ _id, userId: ownerId }, { $set: fields });
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async replaceImage(
    userId: string,
    fragranceId: string,
    expectedObjectKey: string | null,
    image: FragranceStoredImageRecord,
  ): Promise<FragranceRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(fragranceId);
    if (!ownerId || !_id) return null;

    const result = await this.collection.updateOne(
      imageCompareFilter(_id, ownerId, expectedObjectKey),
      { $set: { image: { ...image }, updatedAt: new Date() } },
    );
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async clearImage(userId: string, fragranceId: string, expectedObjectKey: string): Promise<FragranceRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(fragranceId);
    if (!ownerId || !_id) return null;

    const result = await this.collection.updateOne(
      imageCompareFilter(_id, ownerId, expectedObjectKey),
      { $set: { image: null, updatedAt: new Date() } },
    );
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async deleteWithRecord(userId: string, fragranceId: string): Promise<FragranceRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(fragranceId);
    if (!ownerId || !_id) return null;
    const deleted = await this.collection.findOneAndDelete({ _id, userId: ownerId });
    return deleted ? mapRecord(deleted) : null;
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ userId: 1, createdAt: -1, _id: -1 }, { name: 'ix_fragrances_owner_created' }),
      this.collection.createIndex({ userId: 1, available: 1 }, { name: 'ix_fragrances_owner_available' }),
      this.collection.createIndex({ userId: 1, concentration: 1 }, { name: 'ix_fragrances_owner_concentration' }),
    ]);
  }
}
