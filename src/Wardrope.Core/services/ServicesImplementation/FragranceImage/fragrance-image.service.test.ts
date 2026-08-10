import { describe, expect, it, vi } from 'vitest';
import type {
  FragranceRecord,
  IFragranceRepository,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IPrivateImageProcessingService } from '../../ServicesInterface/PrivateImageProcessing/private-image-processing.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import { FragranceImageService } from './fragrance-image.service';

const USER_ID = '64b000000000000000000001';
const FRAGRANCE_ID = '64d000000000000000000001';
const NEW_KEY = `Wardrope/fragrances/${USER_ID}/${FRAGRANCE_ID}/new.webp`;
const now = new Date('2026-08-09T15:00:00.000Z');

function record(imageKey: string | null = null): FragranceRecord {
  return {
    id: FRAGRANCE_ID,
    userId: USER_ID,
    brand: 'Dior',
    name: 'Sauvage',
    productLine: null,
    concentration: 'eau-de-parfum',
    fragranceFamily: 'Aromatic',
    scentType: null,
    keyNotes: ['Bergamot'],
    bottleSizeMl: 100,
    amountRemainingPercent: 75,
    purchaseDate: null,
    purchasePrice: null,
    available: true,
    image: imageKey ? {
      objectKey: imageKey,
      etag: '"old"',
      contentType: 'image/webp',
      width: 800,
      height: 1200,
      sizeBytes: 1000,
      updatedAt: now,
    } : null,
    createdAt: now,
    updatedAt: now,
  };
}

function harness(current = record()) {
  const repository = {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(current),
    update: vi.fn(),
    deleteWithRecord: vi.fn(),
    replaceImage: vi.fn().mockImplementation(async (_userId, _id, _expected, image) => ({ ...current, image })),
    clearImage: vi.fn().mockResolvedValue({ ...current, image: null }),
    ensureIndexes: vi.fn(),
  } satisfies IFragranceRepository;
  const processing: IPrivateImageProcessingService = {
    processPrivateImage: vi.fn().mockResolvedValue({
      bytes: Buffer.from('processed'),
      contentType: 'image/webp',
      width: 800,
      height: 1200,
      sizeBytes: 9,
    }),
  };
  const storage: IFileStorageService = {
    storePrivateFile: vi.fn().mockResolvedValue({ objectKey: NEW_KEY, etag: '"new"' }),
    getPrivateFile: vi.fn().mockResolvedValue({
      body: Buffer.from('image'),
      contentType: 'image/webp',
      contentLength: 5,
      etag: '"new"',
      lastModified: now,
    }),
    deletePrivateFile: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn(),
  };
  const logger: IApplicationLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { repository, processing, storage, logger, service: new FragranceImageService(repository, processing, storage, logger) };
}

describe('FragranceImageService', () => {
  it('stores new bottle images in the shared fragrance folder without identifiers', async () => {
    const h = harness(record('wardrope/fragrances/old.webp'));
    const result = await h.service.replace(USER_ID, FRAGRANCE_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result.ok).toBe(true);
    expect(h.storage.storePrivateFile).toHaveBeenCalledWith(expect.objectContaining({
      pathSegments: ['Frangrances'],
      fileExtension: 'webp',
    }));
    expect(h.storage.deletePrivateFile).toHaveBeenCalledWith('wardrope/fragrances/old.webp');
    expect(JSON.stringify(result)).not.toContain(NEW_KEY);
  });

  it('compensates the new S3 object on a CAS conflict', async () => {
    const h = harness(record('wardrope/fragrances/old.webp'));
    vi.mocked(h.repository.replaceImage).mockResolvedValueOnce(null);
    vi.mocked(h.repository.findById)
      .mockResolvedValueOnce(record('wardrope/fragrances/old.webp'))
      .mockResolvedValueOnce(record('wardrope/fragrances/other.webp'));

    await expect(h.service.replace(USER_ID, FRAGRANCE_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/jpeg',
    })).resolves.toEqual({ ok: false, reason: 'CONFLICT' });
    expect(h.storage.deletePrivateFile).toHaveBeenCalledWith(NEW_KEY);
  });

  it('checks ownership before processing/uploading', async () => {
    const h = harness();
    vi.mocked(h.repository.findById).mockResolvedValueOnce(null);
    await expect(h.service.replace(USER_ID, FRAGRANCE_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    })).resolves.toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(h.processing.processPrivateImage).not.toHaveBeenCalled();
    expect(h.storage.storePrivateFile).not.toHaveBeenCalled();
  });

  it('reads older object keys exactly as persisted', async () => {
    const h = harness(record('wardrope/fragrances/legacy.webp'));
    await expect(h.service.read(USER_ID, FRAGRANCE_ID)).resolves.toMatchObject({ ok: true });
    expect(h.storage.getPrivateFile).toHaveBeenCalledWith('wardrope/fragrances/legacy.webp');
  });
});
