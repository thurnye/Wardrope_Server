import { ObjectId, type Filter } from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  OUTFITS_COLLECTION,
  WEAR_HISTORY_COLLECTION,
  type OutfitDocument,
  type WearHistoryDocument,
} from '../../../models/Outfit/outfit.model';
import type {
  CreateOutfitDto,
  CreateWearHistoryDto,
  UpdateOutfitDto,
  UpdateWearHistoryDto,
} from '../../../../Wardrope.Core/Models/Outfit/outfit.model';
import type {
  IOutfitRepository,
  IWearHistoryRepository,
  OutfitRecord,
  OutfitRepositoryListResult,
  OutfitRepositoryQuery,
  WearHistoryRecord,
  WearHistoryRepositoryListResult,
  WearHistoryRepositoryQuery,
} from '../../RepositoryInterface/Outfit/outfit.repository.interface';

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function parseObjectIds(values: string[]): ObjectId[] | null {
  const parsed = values.map(parseObjectId);
  return parsed.some((value) => value === null) ? null : parsed as ObjectId[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapOutfit(document: OutfitDocument): OutfitRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    name: document.name,
    wardrobeItemIds: document.wardrobeItemIds.map((id) => id.toHexString()),
    fragranceId: document.fragranceId?.toHexString() ?? null,
    favorite: document.favorite,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function mapWearHistory(document: WearHistoryDocument): WearHistoryRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    wornAt: document.wornAt,
    wardrobeItemIds: document.wardrobeItemIds.map((id) => id.toHexString()),
    fragranceId: document.fragranceId?.toHexString() ?? null,
    sourceOutfitId: document.sourceOutfitId?.toHexString() ?? null,
    source: document.source,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export class OutfitRepository implements IOutfitRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database.getDatabase().collection<OutfitDocument>(OUTFITS_COLLECTION);
  }

  async create(userId: string, input: CreateOutfitDto): Promise<OutfitRecord> {
    const ownerId = parseObjectId(userId);
    const itemIds = parseObjectIds(input.wardrobeItemIds);
    const fragranceId = input.fragranceId ? parseObjectId(input.fragranceId) : null;
    if (!ownerId || !itemIds || (input.fragranceId && !fragranceId)) {
      throw new Error('Invalid outfit identifiers.');
    }

    const now = new Date();
    const document: OutfitDocument = {
      _id: new ObjectId(),
      userId: ownerId,
      name: input.name,
      wardrobeItemIds: itemIds,
      fragranceId,
      favorite: input.favorite ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(document);
    return mapOutfit(document);
  }

  async list(userId: string, query: OutfitRepositoryQuery): Promise<OutfitRepositoryListResult> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return { items: [], totalItems: 0 };

    const filter: Filter<OutfitDocument> = { userId: ownerId };
    if (query.favorite !== undefined) filter.favorite = query.favorite;
    if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');
    const skip = (query.page - 1) * query.pageSize;
    const [documents, totalItems] = await Promise.all([
      this.collection.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items: documents.map(mapOutfit), totalItems };
  }

  async findById(userId: string, outfitId: string): Promise<OutfitRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(outfitId);
    if (!ownerId || !_id) return null;
    const document = await this.collection.findOne({ _id, userId: ownerId });
    return document ? mapOutfit(document) : null;
  }

  async update(userId: string, outfitId: string, input: UpdateOutfitDto): Promise<OutfitRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(outfitId);
    if (!ownerId || !_id) return null;

    const fields: Partial<OutfitDocument> = { updatedAt: new Date() };
    if (input.name !== undefined) fields.name = input.name;
    if (input.wardrobeItemIds !== undefined) {
      const itemIds = parseObjectIds(input.wardrobeItemIds);
      if (!itemIds) return null;
      fields.wardrobeItemIds = itemIds;
    }
    if (input.fragranceId !== undefined) {
      if (input.fragranceId === null) fields.fragranceId = null;
      else {
        const fragranceId = parseObjectId(input.fragranceId);
        if (!fragranceId) return null;
        fields.fragranceId = fragranceId;
      }
    }
    if (input.favorite !== undefined) fields.favorite = input.favorite;

    const result = await this.collection.updateOne({ _id, userId: ownerId }, { $set: fields });
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapOutfit(updated) : null;
  }

  async delete(userId: string, outfitId: string): Promise<boolean> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(outfitId);
    if (!ownerId || !_id) return false;
    return (await this.collection.deleteOne({ _id, userId: ownerId })).deletedCount === 1;
  }

  async removeWardrobeItemReferences(userId: string, wardrobeItemId: string): Promise<void> {
    const ownerId = parseObjectId(userId);
    const itemId = parseObjectId(wardrobeItemId);
    if (!ownerId || !itemId) return;
    await this.collection.updateMany(
      { userId: ownerId, wardrobeItemIds: itemId },
      { $pull: { wardrobeItemIds: itemId }, $set: { updatedAt: new Date() } },
    );
    await this.collection.deleteMany({ userId: ownerId, wardrobeItemIds: { $size: 0 } });
  }

  async clearFragranceReferences(userId: string, fragranceId: string): Promise<void> {
    const ownerId = parseObjectId(userId);
    const scentId = parseObjectId(fragranceId);
    if (!ownerId || !scentId) return;
    await this.collection.updateMany(
      { userId: ownerId, fragranceId: scentId },
      { $set: { fragranceId: null, updatedAt: new Date() } },
    );
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ userId: 1, updatedAt: -1, _id: -1 }, { name: 'ix_outfits_owner_updated' }),
      this.collection.createIndex({ userId: 1, favorite: 1 }, { name: 'ix_outfits_owner_favorite' }),
      this.collection.createIndex({ userId: 1, wardrobeItemIds: 1 }, { name: 'ix_outfits_owner_items' }),
      this.collection.createIndex({ userId: 1, fragranceId: 1 }, { name: 'ix_outfits_owner_fragrance' }),
    ]);
  }
}

export class WearHistoryRepository implements IWearHistoryRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database.getDatabase().collection<WearHistoryDocument>(WEAR_HISTORY_COLLECTION);
  }

  async create(userId: string, input: CreateWearHistoryDto): Promise<WearHistoryRecord> {
    const ownerId = parseObjectId(userId);
    const itemIds = parseObjectIds(input.wardrobeItemIds);
    const fragranceId = input.fragranceId ? parseObjectId(input.fragranceId) : null;
    const sourceOutfitId = input.sourceOutfitId ? parseObjectId(input.sourceOutfitId) : null;
    if (!ownerId || !itemIds || (input.fragranceId && !fragranceId) || (input.sourceOutfitId && !sourceOutfitId)) {
      throw new Error('Invalid wear history identifiers.');
    }

    const now = new Date();
    const document: WearHistoryDocument = {
      _id: new ObjectId(),
      userId: ownerId,
      wornAt: new Date(input.wornAt),
      wardrobeItemIds: itemIds,
      fragranceId,
      sourceOutfitId,
      source: input.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(document);
    return mapWearHistory(document);
  }

  async list(userId: string, query: WearHistoryRepositoryQuery): Promise<WearHistoryRepositoryListResult> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return { items: [], totalItems: 0 };

    const filter: Filter<WearHistoryDocument> = { userId: ownerId };
    if (query.from || query.to) {
      filter.wornAt = {};
      if (query.from) filter.wornAt.$gte = query.from;
      if (query.to) filter.wornAt.$lte = query.to;
    }
    const skip = (query.page - 1) * query.pageSize;
    const [documents, totalItems] = await Promise.all([
      this.collection.find(filter).sort({ wornAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { items: documents.map(mapWearHistory), totalItems };
  }

  async findById(userId: string, historyId: string): Promise<WearHistoryRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(historyId);
    if (!ownerId || !_id) return null;
    const document = await this.collection.findOne({ _id, userId: ownerId });
    return document ? mapWearHistory(document) : null;
  }

  async update(userId: string, historyId: string, input: UpdateWearHistoryDto): Promise<WearHistoryRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(historyId);
    if (!ownerId || !_id) return null;

    const fields: Partial<WearHistoryDocument> = { updatedAt: new Date() };
    if (input.wornAt !== undefined) fields.wornAt = new Date(input.wornAt);
    if (input.wardrobeItemIds !== undefined) {
      const itemIds = parseObjectIds(input.wardrobeItemIds);
      if (!itemIds) return null;
      fields.wardrobeItemIds = itemIds;
    }
    if (input.fragranceId !== undefined) {
      if (input.fragranceId === null) fields.fragranceId = null;
      else {
        const fragranceId = parseObjectId(input.fragranceId);
        if (!fragranceId) return null;
        fields.fragranceId = fragranceId;
      }
    }
    if (input.sourceOutfitId !== undefined) {
      if (input.sourceOutfitId === null) fields.sourceOutfitId = null;
      else {
        const sourceOutfitId = parseObjectId(input.sourceOutfitId);
        if (!sourceOutfitId) return null;
        fields.sourceOutfitId = sourceOutfitId;
      }
    }
    if (input.source !== undefined) fields.source = input.source;

    const result = await this.collection.updateOne({ _id, userId: ownerId }, { $set: fields });
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapWearHistory(updated) : null;
  }

  async delete(userId: string, historyId: string): Promise<boolean> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(historyId);
    if (!ownerId || !_id) return false;
    return (await this.collection.deleteOne({ _id, userId: ownerId })).deletedCount === 1;
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ userId: 1, wornAt: -1, _id: -1 }, { name: 'ix_wear_history_owner_worn_at' }),
      this.collection.createIndex({ userId: 1, wardrobeItemIds: 1, wornAt: -1 }, { name: 'ix_wear_history_owner_items' }),
      this.collection.createIndex({ userId: 1, fragranceId: 1, wornAt: -1 }, { name: 'ix_wear_history_owner_fragrance' }),
    ]);
  }
}
