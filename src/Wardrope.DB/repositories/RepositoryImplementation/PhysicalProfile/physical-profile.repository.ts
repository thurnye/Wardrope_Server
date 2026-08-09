import { ObjectId } from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  PHYSICAL_PROFILES_COLLECTION,
  type PhysicalProfileDocument,
} from '../../../models/PhysicalProfile/physical-profile.model';
import type {
  IPhysicalProfileRepository,
  PhysicalProfileRecord,
  ReplacePhysicalProfileRecord,
} from '../../RepositoryInterface/PhysicalProfile/physical-profile.repository.interface';

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function mapRecord(document: PhysicalProfileDocument): PhysicalProfileRecord {
  return {
    userId: document.userId.toHexString(),
    heightCm: document.heightCm,
    shoulderWidthCm: document.shoulderWidthCm,
    chestCm: document.chestCm,
    waistCm: document.waistCm,
    hipsCm: document.hipsCm,
    inseamCm: document.inseamCm,
    sleeveLengthCm: document.sleeveLengthCm,
    bodyShape: document.bodyShape,
    skinTone: document.skinTone,
    fitPreference: document.fitPreference,
    usualTopSize: document.usualTopSize,
    usualBottomSize: document.usualBottomSize,
    usualOnePieceSize: document.usualOnePieceSize,
    usualOuterwearSize: document.usualOuterwearSize,
    shoeSize: document.shoeSize,
    shoeSizeSystem: document.shoeSizeSystem,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export class PhysicalProfileRepository implements IPhysicalProfileRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database
      .getDatabase()
      .collection<PhysicalProfileDocument>(PHYSICAL_PROFILES_COLLECTION);
  }

  async findByUserId(userId: string): Promise<PhysicalProfileRecord | null> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return null;

    const document = await this.collection.findOne({ userId: ownerId });
    return document ? mapRecord(document) : null;
  }

  async replace(
    userId: string,
    input: ReplacePhysicalProfileRecord,
  ): Promise<PhysicalProfileRecord> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) {
      throw new Error('Cannot replace a physical profile for an invalid user identifier.');
    }

    const now = new Date();
    const document = await this.collection.findOneAndUpdate(
      { userId: ownerId },
      {
        $set: {
          ...input,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    if (!document) {
      throw new Error('Physical profile replacement did not return the persisted record.');
    }

    return mapRecord(document);
  }

  async delete(userId: string): Promise<boolean> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return false;

    const result = await this.collection.deleteOne({ userId: ownerId });
    return result.deletedCount === 1;
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { userId: 1 },
      { unique: true, name: 'ux_physical_profiles_owner' },
    );
  }
}
