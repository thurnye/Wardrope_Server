import { ObjectId } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import { PreferencesRepository } from './preferences.repository';

const USER_ID = '64b000000000000000000001';

function hex(value: unknown): string | undefined {
  return value instanceof ObjectId ? value.toHexString() : undefined;
}

function createHarness() {
  const collection = {
    findOne: vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    createIndex: vi.fn().mockResolvedValue('index'),
  };

  const database = {
    getDatabase: () => ({ collection: () => collection }),
  } as unknown as MongoDatabaseConnection;

  return { repository: new PreferencesRepository(database), collection };
}

const replacement = {
  preferredAesthetics: ['classic', 'minimalist'] as const,
  avoidedAesthetics: ['edgy'] as const,
  preferredColors: ['Navy'],
  avoidedColors: ['Orange'],
  experimentationLevel: 'balanced' as const,
  accessoryLevel: 'minimal' as const,
  patternLevel: 'balanced' as const,
  layeringLevel: 'layered' as const,
  repeatPreference: 'rewear-friendly' as const,
};

describe('PreferencesRepository', () => {
  it('scopes reads to the authenticated owner ObjectId', async () => {
    const { repository, collection } = createHarness();
    await repository.findByUserId(USER_ID);
    expect(hex(collection.findOne.mock.calls[0]?.[0]?.userId)).toBe(USER_ID);
  });

  it('uses one owner-scoped upsert and complete replacement fields', async () => {
    const { repository, collection } = createHarness();
    const now = new Date('2026-08-09T06:00:00.000Z');
    collection.findOneAndUpdate.mockResolvedValueOnce({
      _id: new ObjectId(),
      userId: new ObjectId(USER_ID),
      ...replacement,
      preferredAesthetics: [...replacement.preferredAesthetics],
      avoidedAesthetics: [...replacement.avoidedAesthetics],
      createdAt: now,
      updatedAt: now,
    });

    await repository.replace(USER_ID, {
      ...replacement,
      preferredAesthetics: [...replacement.preferredAesthetics],
      avoidedAesthetics: [...replacement.avoidedAesthetics],
    });

    const [filter, update, options] = collection.findOneAndUpdate.mock.calls[0] ?? [];
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(update?.$set).toMatchObject(replacement);
    expect(update?.$set?.updatedAt).toBeInstanceOf(Date);
    expect(update?.$setOnInsert?._id).toBeInstanceOf(ObjectId);
    expect(options).toEqual({ upsert: true, returnDocument: 'after' });
  });

  it('scopes reset to the owner and avoids malformed owner queries', async () => {
    const { repository, collection } = createHarness();
    await repository.delete(USER_ID);
    expect(hex(collection.deleteOne.mock.calls[0]?.[0]?.userId)).toBe(USER_ID);

    collection.findOne.mockClear();
    collection.deleteOne.mockClear();
    await expect(repository.findByUserId('bad')).resolves.toBeNull();
    await expect(repository.delete('bad')).resolves.toBe(false);
    expect(collection.findOne).not.toHaveBeenCalled();
    expect(collection.deleteOne).not.toHaveBeenCalled();
  });

  it('enforces a unique singleton index on userId', async () => {
    const { repository, collection } = createHarness();
    await repository.ensureIndexes();
    expect(collection.createIndex).toHaveBeenCalledWith(
      { userId: 1 },
      { unique: true, name: 'ux_preferences_owner' },
    );
  });
});
