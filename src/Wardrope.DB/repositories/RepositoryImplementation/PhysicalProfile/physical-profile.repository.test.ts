import { ObjectId } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import { PhysicalProfileRepository } from './physical-profile.repository';

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
    getDatabase: () => ({
      collection: () => collection,
    }),
  } as unknown as MongoDatabaseConnection;

  return {
    repository: new PhysicalProfileRepository(database),
    collection,
  };
}

const replacement = {
  heightCm: 180,
  shoulderWidthCm: null,
  chestCm: 102,
  waistCm: 86,
  hipsCm: null,
  inseamCm: 81,
  sleeveLengthCm: null,
  bodyShape: 'rectangle' as const,
  skinTone: 'deep' as const,
  fitPreference: 'regular' as const,
  usualTopSize: 'L',
  usualBottomSize: '34',
  usualOnePieceSize: null,
  usualOuterwearSize: '42R',
  shoeSize: '10.5',
  shoeSizeSystem: 'US_MENS' as const,
};

describe('PhysicalProfileRepository', () => {
  it('scopes profile reads to the authenticated owner ObjectId', async () => {
    const { repository, collection } = createHarness();
    await repository.findByUserId(USER_ID);

    const filter = collection.findOne.mock.calls[0]?.[0];
    expect(hex(filter?.userId)).toBe(USER_ID);
  });

  it('uses one owner-scoped upsert and full replacement fields', async () => {
    const { repository, collection } = createHarness();
    const now = new Date('2026-08-09T06:00:00.000Z');
    collection.findOneAndUpdate.mockResolvedValueOnce({
      _id: new ObjectId(),
      userId: new ObjectId(USER_ID),
      ...replacement,
      createdAt: now,
      updatedAt: now,
    });

    await repository.replace(USER_ID, replacement);

    const [filter, update, options] = collection.findOneAndUpdate.mock.calls[0] ?? [];
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(update?.$set).toMatchObject(replacement);
    expect(update?.$set?.updatedAt).toBeInstanceOf(Date);
    expect(update?.$setOnInsert?._id).toBeInstanceOf(ObjectId);
    expect(update?.$setOnInsert?.createdAt).toBeInstanceOf(Date);
    expect(options).toEqual({ upsert: true, returnDocument: 'after' });
  });

  it('scopes reset to the authenticated owner', async () => {
    const { repository, collection } = createHarness();
    await repository.delete(USER_ID);

    const filter = collection.deleteOne.mock.calls[0]?.[0];
    expect(hex(filter?.userId)).toBe(USER_ID);
  });

  it('never queries MongoDB for malformed owner identifiers', async () => {
    const { repository, collection } = createHarness();

    await expect(repository.findByUserId('bad-user')).resolves.toBeNull();
    await expect(repository.delete('bad-user')).resolves.toBe(false);
    await expect(repository.replace('bad-user', replacement)).rejects.toThrow(/invalid user identifier/i);

    expect(collection.findOne).not.toHaveBeenCalled();
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled();
    expect(collection.deleteOne).not.toHaveBeenCalled();
  });

  it('creates a unique singleton index on userId', async () => {
    const { repository, collection } = createHarness();
    await repository.ensureIndexes();

    expect(collection.createIndex).toHaveBeenCalledWith(
      { userId: 1 },
      { unique: true, name: 'ux_physical_profiles_owner' },
    );
  });
});
