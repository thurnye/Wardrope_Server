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
    findOneAndDelete: vi.fn().mockResolvedValue(null),
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

const storedImage = {
  objectKey: 'wardrobe/new.webp',
  etag: '"new-etag"',
  contentType: 'image/webp' as const,
  width: 1200,
  height: 1600,
  sizeBytes: 420_000,
  updatedAt: new Date('2026-08-09T06:00:00.000Z'),
};

describe('WardrobeRepository ownership filters', () => {
  it('scopes list/count queries to the owner and treats search as literal text', async () => {
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
      Object.values(condition)[0],
    );
    expect(regexes).toHaveLength(3);
    for (const regex of regexes) {
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test('prefix [navy.* suffix')).toBe(true);
      expect(regex.test('navyyyy')).toBe(false);
    }
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

  it('uses owner-scoped compare-and-swap filters when adding the first image', async () => {
    const { repository, collection } = createHarness();

    await repository.replaceImage(USER_ID, ITEM_ID, null, storedImage);

    const filter = collection.updateOne.mock.calls[0]?.[0];
    const update = collection.updateOne.mock.calls[0]?.[1];
    expect(hex(filter?._id)).toBe(ITEM_ID);
    expect(hex(filter?.userId)).toBe(USER_ID);
    expect(filter?.$or).toEqual([
      { image: null },
      { image: { $exists: false } },
    ]);
    expect(update?.$set?.image).toMatchObject({
      objectKey: storedImage.objectKey,
      contentType: 'image/webp',
    });
  });

  it('requires the previously observed object key when replacing or clearing an image', async () => {
    const { repository, collection } = createHarness();

    await repository.replaceImage(USER_ID, ITEM_ID, 'wardrobe/old.webp', storedImage);
    const replaceFilter = collection.updateOne.mock.calls[0]?.[0];
    expect(hex(replaceFilter?._id)).toBe(ITEM_ID);
    expect(hex(replaceFilter?.userId)).toBe(USER_ID);
    expect(replaceFilter?.['image.objectKey']).toBe('wardrobe/old.webp');

    collection.updateOne.mockClear();
    await repository.clearImage(USER_ID, ITEM_ID, 'wardrobe/new.webp');
    const clearFilter = collection.updateOne.mock.calls[0]?.[0];
    expect(hex(clearFilter?._id)).toBe(ITEM_ID);
    expect(hex(clearFilter?.userId)).toBe(USER_ID);
    expect(clearFilter?.['image.objectKey']).toBe('wardrobe/new.webp');
  });

  it('returns the deleted record through the lifecycle delete operation using owner scope', async () => {
    const { repository, collection } = createHarness();

    await repository.deleteWithRecord(USER_ID, ITEM_ID);

    const filter = collection.findOneAndDelete.mock.calls[0]?.[0];
    expect(hex(filter?._id)).toBe(ITEM_ID);
    expect(hex(filter?.userId)).toBe(USER_ID);
  });

  it('does not query Mongo for malformed owner or item identifiers', async () => {
    const { repository, collection } = createHarness();

    await expect(repository.findById('bad-user', ITEM_ID)).resolves.toBeNull();
    await expect(repository.findById(USER_ID, 'bad-item')).resolves.toBeNull();
    await expect(repository.update(USER_ID, 'bad-item', { favorite: true })).resolves.toBeNull();
    await expect(repository.delete('bad-user', ITEM_ID)).resolves.toBe(false);
    await expect(repository.replaceImage(USER_ID, 'bad-item', null, storedImage)).resolves.toBeNull();
    await expect(repository.clearImage('bad-user', ITEM_ID, storedImage.objectKey)).resolves.toBeNull();
    await expect(repository.deleteWithRecord(USER_ID, 'bad-item')).resolves.toBeNull();

    expect(collection.findOne).not.toHaveBeenCalled();
    expect(collection.updateOne).not.toHaveBeenCalled();
    expect(collection.deleteOne).not.toHaveBeenCalled();
    expect(collection.findOneAndDelete).not.toHaveBeenCalled();
  });
});
