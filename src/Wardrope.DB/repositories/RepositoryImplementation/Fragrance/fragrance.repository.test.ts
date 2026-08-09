import { ObjectId } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import { FragranceRepository } from './fragrance.repository';

const USER_ID = '64b000000000000000000001';
const FRAGRANCE_ID = '64d000000000000000000001';

function hex(value: unknown) {
  return value instanceof ObjectId ? value.toHexString() : undefined;
}

function harness() {
  const cursor = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  };
  const collection = {
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    find: vi.fn().mockReturnValue(cursor),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOne: vi.fn().mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }),
    findOneAndDelete: vi.fn().mockResolvedValue(null),
    createIndex: vi.fn().mockResolvedValue('index'),
  };
  const database = { getDatabase: () => ({ collection: () => collection }) } as unknown as MongoDatabaseConnection;
  return { repository: new FragranceRepository(database), collection, cursor };
}

describe('FragranceRepository', () => {
  it('scopes item reads by both owner and fragrance ID', async () => {
    const h = harness();
    await h.repository.findById(USER_ID, FRAGRANCE_ID);
    const filter = h.collection.findOne.mock.calls[0]?.[0];
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(hex(filter?._id)).toBe(FRAGRANCE_ID);
  });

  it('escapes search as literal text inside owner-scoped queries', async () => {
    const h = harness();
    await h.repository.list(USER_ID, { page: 1, pageSize: 24, search: 'Dior.*' });
    const filter = h.collection.find.mock.calls[0]?.[0];
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(filter?.$or?.[0]?.brand).toBeInstanceOf(RegExp);
    expect(filter?.$or?.[0]?.brand.source).toContain('\\.\\*');
  });

  it('uses a unique owner context for CAS image replacement', async () => {
    const h = harness();
    await h.repository.replaceImage(USER_ID, FRAGRANCE_ID, 'wardrope/fragrances/old.webp', {
      objectKey: 'wardrope/fragrances/new.webp',
      etag: '"etag"',
      contentType: 'image/webp',
      width: 800,
      height: 1200,
      sizeBytes: 1000,
      updatedAt: new Date(),
    });
    const filter = h.collection.updateOne.mock.calls[0]?.[0];
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(hex(filter?._id)).toBe(FRAGRANCE_ID);
    expect(filter?.['image.objectKey']).toBe('wardrope/fragrances/old.webp');
  });
});
