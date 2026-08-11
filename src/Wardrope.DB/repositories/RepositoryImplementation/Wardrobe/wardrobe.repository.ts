import {
  ObjectId,
  type Filter,
} from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  WARDROBE_ITEMS_COLLECTION,
  type WardrobeImageDocument,
  type WardrobeItemDocument,
} from '../../../models/WardrobeItem/wardrobe-item.model';
import type {
  CreateWardrobeItemDto,
  UpdateWardrobeItemDto,
} from '../../../../Wardrope.Core/Models/Wardrobe/wardrobe.model';
import type {
  IWardrobeRepository,
  WardrobeItemRecord,
  WardrobeRepositoryListResult,
  WardrobeRepositoryQuery,
  WardrobeStoredImageRecord,
} from '../../RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeImageRepository } from '../../RepositoryInterface/WardrobeImage/wardrobe-image.repository.interface';

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapImage(document: WardrobeImageDocument | null | undefined): WardrobeStoredImageRecord | null {
  if (!document) {
    return null;
  }

  return {
    objectKey: document.objectKey,
    etag: document.etag,
    contentType: document.contentType,
    width: document.width,
    height: document.height,
    sizeBytes: document.sizeBytes,
    updatedAt: document.updatedAt,
  };
}

function mapRecord(document: WardrobeItemDocument): WardrobeItemRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    name: document.name,
    category: document.category,
    subcategory: document.subcategory,
    brand: document.brand,
    description: document.description ?? null,
    colors: [...document.colors],
    materials: [...document.materials],
    pattern: document.pattern,
    size: document.size,
    favorite: document.favorite,
    sourceUrl: document.sourceUrl ?? null,
    images: document.images.map(mapImage).filter((image): image is WardrobeStoredImageRecord => image !== null),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toImageDocument(image: WardrobeStoredImageRecord): WardrobeImageDocument {
  return {
    objectKey: image.objectKey,
    etag: image.etag,
    contentType: image.contentType,
    width: image.width,
    height: image.height,
    sizeBytes: image.sizeBytes,
    updatedAt: image.updatedAt,
  };
}

function imageCompareFilter(
  _id: ObjectId,
  userId: ObjectId,
  expectedObjectKey: string | null,
): Filter<WardrobeItemDocument> {
  const filter: Filter<WardrobeItemDocument> = { _id, userId };

  if (expectedObjectKey === null) {
    filter.$or = [{ images: { $size: 0 } }, { images: { $exists: false } }];
    return filter;
  }

  Object.assign(filter, { 'images.0.objectKey': expectedObjectKey });
  return filter;
}

export class WardrobeRepository implements IWardrobeRepository, IWardrobeImageRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database
      .getDatabase()
      .collection<WardrobeItemDocument>(WARDROBE_ITEMS_COLLECTION);
  }

  async create(userId: string, input: CreateWardrobeItemDto): Promise<WardrobeItemRecord> {
    const ownerId = parseObjectId(userId);

    if (!ownerId) {
      throw new Error('Cannot create a wardrobe item for an invalid user identifier.');
    }

    const now = new Date();
    const document: WardrobeItemDocument = {
      _id: new ObjectId(),
      userId: ownerId,
      name: input.name,
      category: input.category,
      subcategory: input.subcategory,
      brand: input.brand ?? null,
      description: input.description ?? null,
      colors: [...input.colors],
      materials: [...(input.materials ?? [])],
      pattern: input.pattern ?? null,
      size: input.size ?? null,
      favorite: input.favorite ?? false,
      sourceUrl: input.sourceUrl ?? null,
      images: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.insertOne(document);
    return mapRecord(document);
  }

  async list(
    userId: string,
    query: WardrobeRepositoryQuery,
  ): Promise<WardrobeRepositoryListResult> {
    const ownerId = parseObjectId(userId);

    if (!ownerId) {
      return { items: [], totalItems: 0 };
    }

    const filter: Filter<WardrobeItemDocument> = { userId: ownerId };

    if (query.category) {
      filter.category = query.category;
    }

    if (query.favorite !== undefined) {
      filter.favorite = query.favorite;
    }

    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { name: search },
        { brand: search },
        { subcategory: search },
        { description: search },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [documents, totalItems] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return {
      items: documents.map(mapRecord),
      totalItems,
    };
  }

  async findById(userId: string, itemId: string): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return null;
    }

    const document = await this.collection.findOne({ _id, userId: ownerId });
    return document ? mapRecord(document) : null;
  }

  async update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return null;
    }

    const updateFields: Partial<WardrobeItemDocument> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateFields.name = input.name;
    if (input.category !== undefined) updateFields.category = input.category;
    if (input.subcategory !== undefined) updateFields.subcategory = input.subcategory;
    if (input.brand !== undefined) updateFields.brand = input.brand;
    if (input.description !== undefined) updateFields.description = input.description;
    if (input.colors !== undefined) updateFields.colors = [...input.colors];
    if (input.materials !== undefined) updateFields.materials = [...input.materials];
    if (input.pattern !== undefined) updateFields.pattern = input.pattern;
    if (input.size !== undefined) updateFields.size = input.size;
    if (input.favorite !== undefined) updateFields.favorite = input.favorite;
    if (input.sourceUrl !== undefined) updateFields.sourceUrl = input.sourceUrl;

    const result = await this.collection.updateOne(
      { _id, userId: ownerId },
      { $set: updateFields },
    );

    if (result.matchedCount !== 1) {
      return null;
    }

    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async replaceImage(
    userId: string,
    itemId: string,
    expectedObjectKey: string | null,
    image: WardrobeStoredImageRecord,
  ): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return null;
    }

    const result = await this.collection.updateOne(
      imageCompareFilter(_id, ownerId, expectedObjectKey),
      {
        $set: {
          images: [toImageDocument(image)],
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount !== 1) {
      return null;
    }

    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async replaceImages(
    userId: string,
    itemId: string,
    expectedObjectKeys: string[],
    images: WardrobeStoredImageRecord[],
  ): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);
    if (!ownerId || !_id || images.length === 0) return null;

    const current = await this.collection.findOne({ _id, userId: ownerId });
    if (!current) return null;
    const currentKeys = current.images.map((image) => image.objectKey);
    if (currentKeys.length !== expectedObjectKeys.length ||
        currentKeys.some((key, index) => key !== expectedObjectKeys[index])) return null;

    const documents = images.map(toImageDocument);
    const result = await this.collection.updateOne(
      { _id, userId: ownerId, updatedAt: current.updatedAt },
      { $set: { images: documents, updatedAt: new Date() } },
    );
    if (result.matchedCount !== 1) return null;
    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async clearImage(
    userId: string,
    itemId: string,
    expectedObjectKey: string,
  ): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return null;
    }

    const result = await this.collection.updateOne(
      imageCompareFilter(_id, ownerId, expectedObjectKey),
      {
        $set: {
          images: [],
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount !== 1) {
      return null;
    }

    const updated = await this.collection.findOne({ _id, userId: ownerId });
    return updated ? mapRecord(updated) : null;
  }

  async delete(userId: string, itemId: string): Promise<boolean> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return false;
    }

    const result = await this.collection.deleteOne({ _id, userId: ownerId });
    return result.deletedCount === 1;
  }

  async deleteWithRecord(userId: string, itemId: string): Promise<WardrobeItemRecord | null> {
    const ownerId = parseObjectId(userId);
    const _id = parseObjectId(itemId);

    if (!ownerId || !_id) {
      return null;
    }

    const deleted = await this.collection.findOneAndDelete({ _id, userId: ownerId });
    return deleted ? mapRecord(deleted) : null;
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex(
        { userId: 1, createdAt: -1, _id: -1 },
        { name: 'ix_wardrobe_owner_created' },
      ),
      this.collection.createIndex(
        { userId: 1, category: 1 },
        { name: 'ix_wardrobe_owner_category' },
      ),
      this.collection.createIndex(
        { userId: 1, favorite: 1 },
        { name: 'ix_wardrobe_owner_favorite' },
      ),
    ]);
  }
}
