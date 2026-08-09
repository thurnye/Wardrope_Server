import { describe, expect, it, vi } from 'vitest';
import type { IFragranceRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import { FragranceService } from './fragrance.service';

const USER_ID = '64b000000000000000000001';
const FRAGRANCE_ID = '64d000000000000000000001';
const now = new Date('2026-08-09T15:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: FRAGRANCE_ID,
    userId: USER_ID,
    brand: 'Maison Francis Kurkdjian',
    name: 'Baccarat Rouge 540',
    productLine: null,
    concentration: 'eau-de-parfum' as const,
    fragranceFamily: 'Amber Floral',
    scentType: null,
    keyNotes: ['Jasmine', 'Saffron'],
    bottleSizeMl: 70,
    amountRemainingPercent: 80,
    purchaseDate: null,
    purchasePrice: null,
    available: true,
    image: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function harness() {
  const repository = {
    create: vi.fn().mockImplementation(async (_userId, input) => record(input)),
    list: vi.fn().mockResolvedValue({ items: [record()], totalItems: 1 }),
    findById: vi.fn().mockResolvedValue(record()),
    update: vi.fn().mockImplementation(async (_userId, _id, input) => record(input)),
    deleteWithRecord: vi.fn().mockResolvedValue(record()),
    replaceImage: vi.fn(),
    clearImage: vi.fn(),
    ensureIndexes: vi.fn(),
  } satisfies IFragranceRepository;
  const fileStorage = {
    storePrivateFile: vi.fn(),
    getPrivateFile: vi.fn(),
    deletePrivateFile: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn(),
  } satisfies IFileStorageService;
  const logger: IApplicationLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { repository, fileStorage, logger, service: new FragranceService(repository, fileStorage, logger) };
}

describe('FragranceService', () => {
  it('normalizes objective product facts and de-duplicates notes', async () => {
    const h = harness();
    const result = await h.service.create(USER_ID, {
      brand: '  Maison   Francis Kurkdjian ',
      name: ' Baccarat   Rouge 540 ',
      keyNotes: [' Jasmine ', 'jasmine', ' Cedar   wood '],
      purchasePrice: { amount: 450, currency: 'cad' },
    });

    expect(h.repository.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      brand: 'Maison Francis Kurkdjian',
      name: 'Baccarat Rouge 540',
      keyNotes: ['Jasmine', 'Cedar wood'],
      purchasePrice: { amount: 450, currency: 'CAD' },
    }));
    expect(result).not.toHaveProperty('userId');
  });

  it('returns owner-scoped pagination', async () => {
    const h = harness();
    const result = await h.service.list(USER_ID, { page: 1, pageSize: 24, search: ' rouge ' });
    expect(h.repository.list).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ search: 'rouge' }));
    expect(result.pagination).toEqual({ page: 1, pageSize: 24, totalItems: 1, totalPages: 1 });
  });

  it('deletes Mongo first and then cleans up a private bottle image best-effort', async () => {
    const h = harness();
    vi.mocked(h.repository.deleteWithRecord).mockResolvedValueOnce(record({
      image: {
        objectKey: 'wardrope/fragrances/bottle.webp',
        etag: '"etag"',
        contentType: 'image/webp',
        width: 800,
        height: 1200,
        sizeBytes: 1000,
        updatedAt: now,
      },
    }));
    await expect(h.service.delete(USER_ID, FRAGRANCE_ID)).resolves.toBe(true);
    expect(h.fileStorage.deletePrivateFile).toHaveBeenCalledWith('wardrope/fragrances/bottle.webp');
  });
});
