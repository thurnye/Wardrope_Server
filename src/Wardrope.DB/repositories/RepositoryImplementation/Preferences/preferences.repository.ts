import { ObjectId } from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  PREFERENCES_COLLECTION,
  type PreferencesDocument,
} from '../../../models/Preferences/preferences.model';
import type {
  IPreferencesRepository,
  PreferencesRecord,
  ReplacePreferencesRecord,
} from '../../RepositoryInterface/Preferences/preferences.repository.interface';

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function mapRecord(document: PreferencesDocument): PreferencesRecord {
  return {
    userId: document.userId.toHexString(),
    preferredAesthetics: [...document.preferredAesthetics],
    avoidedAesthetics: [...document.avoidedAesthetics],
    preferredColors: [...document.preferredColors],
    avoidedColors: [...document.avoidedColors],
    experimentationLevel: document.experimentationLevel,
    accessoryLevel: document.accessoryLevel,
    patternLevel: document.patternLevel,
    layeringLevel: document.layeringLevel,
    repeatPreference: document.repeatPreference,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export class PreferencesRepository implements IPreferencesRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get collection() {
    return this.database
      .getDatabase()
      .collection<PreferencesDocument>(PREFERENCES_COLLECTION);
  }

  async findByUserId(userId: string): Promise<PreferencesRecord | null> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) return null;

    const document = await this.collection.findOne({ userId: ownerId });
    return document ? mapRecord(document) : null;
  }

  async replace(userId: string, input: ReplacePreferencesRecord): Promise<PreferencesRecord> {
    const ownerId = parseObjectId(userId);
    if (!ownerId) {
      throw new Error('Cannot replace preferences for an invalid user identifier.');
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
      throw new Error('Preferences replacement did not return the persisted record.');
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
      { unique: true, name: 'ux_preferences_owner' },
    );
  }
}
