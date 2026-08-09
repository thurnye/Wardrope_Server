import { ObjectId } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import { WardrobeRepository } from './wardrobe.repository';

const USER_ID = '64b000000000000000000001';
const ITEM_ID = '64c000000000000000000001';

function hex(value: unknown): string | undefined {
  return value instanceof ObjectId ? value.toHexString() : undefined;
}

function createHarness() {
  const cursor = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  };

  const collection = {
    find: vi.fn().mockReturnValue(cursor),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOne: vi.fn().mockResolvedValue(null),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    createIndex: vi.fn().mockResolvedValue('index'),
  };

  const database = {
    getDatabase: () => ({
      collection: () => collection,
    }),
  } as unknown as MongoDatabaseConnection;

  return {
    repository: new WardrobeRepository(database),
    collection,
  };
}

describe('WardrobeRepository ownership filters', () => {
  it('scopes list and count queries to the authenticated owner', async () => {
    const { repository, collection } = createHarness();

    await repository.list(USER_ID, {
      page: 1,
      pageSize: 24,
      category: 'outerwear',
      favorite: true,
      search: '[navy.*',
    });

    const findFilter = collection.find.mock.calls[0]?.[0];
    const countFilter = collection.countDocuments.mock.calls[0]?.[0];

    expect(hex(findFilter?.userId)).toBe(USER_ID);
    expect(hex(countFilter?.userId)).toBe(USER_ID);
    expect(findFilter?.category).toBe('outerwear');
    expect(findFilter?.favorite).toBe(true);

    const regexes = (findFilter?.$or ?? []).map((condition: Record<string, RegExp>) =>
      Object.values(condition)[0]?.source,
    );
    expect(regexes).toEqual(['\\[navy\\.\\*', '\\[navy\\.\\*', '\\[navy\\.\\*']);
  });

  it('scopes item lookup to both item id and authenticated owner id', async () => {
    const { repository, collection } = createHarness();

    await repository.findById(USER_ID, ITEM_ID);

    const filter = collection.findOne.mock.calls[0]?.[0];
    expect(hex(filter?._id)).toBe(ITEM_ID);
    expect(hex(filter?.userId)).toBe(USER_ID);
  });

  it('scopes updates to both item id and authenticated owner id', async () => {
    const { repository, collection } = createHarness();

    await repository.update(USER_ID, ITEM_ID, { favorite: true });

    const filter = collection.updateOne.mock.calls[0]?.[0];
    const update = collection.updateOne.mock.calls[0]?.[1];
    expect(hex(filter?._id)).toBe(ITEM_ID);
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(update?.$set?.favorite).toBe(true);
    expect(update?.$set?.updatedAt).toBeInstanceOf(Date);
  });

  it('scopes deletes to both item id and authenticated owner id', async () => {
    const { repository, collection } = createHarness();

    await repository.delete(USER_ID, ITEM_ID);

    const filter = collection.deleteOne.mock.calls[0]?.[0];
    expect(hex(filter?._id)).toBe(ITEM_ID);
    expect(hex(filter?.userId)).toBe(USER_ID);
  });

  it('does not query Mongo for malformed owner or item identifiers', async () => {
    const { repository, collection } = createHarness();

    await expect(repository.findById('bad-user', ITEM_ID)).resolves.toBeNull();
    await expect(repository.findById(USER_ID, 'bad-item')).resolves.toBeNull();
    await expect(repository.update(USER_ID, 'bad-item', { favorite: true })).resolves.toBeNull();
    await expect(repository.delete('bad-user', ITEM_ID)).resolves.toBe(false);

    expect(collection.findOne).not.toHaveBeenCalled();
    expect(collection.updateOne).not.toHaveBeenCalled();
    expect(collection.deleteOne).not.toHaveBeenCalled();
  });
});
