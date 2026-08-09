import { describe, expect, it, vi } from 'vitest';
import type { IImageProcessingService } from '../../ServicesInterface/ImageProcessing/image-processing.service.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import type {
  IWardrobeRepository,
  WardrobeItemRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeImageRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/WardrobeImage/wardrobe-image.repository.interface';
import { WardrobeImageService } from './wardrobe-image.service';

const USER_ID = '64b000000000000000000001';
const ITEM_ID = '64c000000000000000000001';
const NEW_OBJECT_KEY = 'wardrope/clothings/new.webp';

function item(
  imageObjectKey: string | null = null,
  category: WardrobeItemRecord['category'] = 'outerwear',
): WardrobeItemRecord {
  const now = new Date('2026-08-09T06:00:00.000Z');
  return {
    id: ITEM_ID,
    userId: USER_ID,
    name: 'Navy Blazer',
    category,
    subcategory: 'Blazer',
    brand: 'Canali',
    colors: ['Navy'],
    materials: ['Wool'],
    pattern: 'solid',
    size: '40R',
    favorite: false,
    sourceUrl: null,
    image: imageObjectKey
      ? {
          objectKey: imageObjectKey,
          etag: '"old"',
          contentType: 'image/webp',
          width: 900,
          height: 1200,
          sizeBytes: 1000,
          updatedAt: now,
        }
      : null,
    createdAt: now,
    updatedAt: now,
  };
}

function harness(current = item(), objectKey = NEW_OBJECT_KEY) {
  const wardrobeRepository: IWardrobeRepository = {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(current),
    update: vi.fn(),
    delete: vi.fn(),
    ensureIndexes: vi.fn(),
  } as unknown as IWardrobeRepository;

  const imageRepository: IWardrobeImageRepository = {
    replaceImage: vi.fn().mockImplementation(async (_userId, _itemId, _expected, image) => ({
      ...current,
      image,
    })),
    clearImage: vi.fn().mockResolvedValue({ ...current, image: null }),
    deleteWithRecord: vi.fn(),
  };

  const imageProcessing: IImageProcessingService = {
    processWardrobeImage: vi.fn().mockResolvedValue({
      bytes: Buffer.from('processed'),
      contentType: 'image/webp',
      width: 800,
      height: 1200,
      sizeBytes: 9,
    }),
  };

  const fileStorage: IFileStorageService = {
    storePrivateFile: vi.fn().mockResolvedValue({
      objectKey,
      etag: '"new"',
    }),
    getPrivateFile: vi.fn().mockResolvedValue({
      body: Buffer.from('private-image'),
      contentType: 'image/webp',
      contentLength: 13,
      etag: '"new"',
      lastModified: new Date('2026-08-09T06:00:00.000Z'),
    }),
    deletePrivateFile: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn(),
  };

  const logger: IApplicationLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    service: new WardrobeImageService(
      wardrobeRepository,
      imageRepository,
      imageProcessing,
      fileStorage,
      logger,
    ),
    wardrobeRepository,
    imageRepository,
    imageProcessing,
    fileStorage,
    logger,
  };
}

describe('WardrobeImageService', () => {
  it('stores clothing in the shared clothings folder without user or item path segments', async () => {
    const h = harness(item('wardrobe/old.webp', 'outerwear'));

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result.ok).toBe(true);
    expect(h.fileStorage.storePrivateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'clothings',
        fileExtension: 'webp',
      }),
    );
    const storageInput = vi.mocked(h.fileStorage.storePrivateFile).mock.calls[0]?.[0];
    expect(JSON.stringify(storageInput)).not.toContain(USER_ID);
    expect(JSON.stringify(storageInput)).not.toContain(ITEM_ID);
    expect(h.imageRepository.replaceImage).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      'wardrobe/old.webp',
      expect.objectContaining({ objectKey: NEW_OBJECT_KEY }),
    );
    expect(h.fileStorage.deletePrivateFile).toHaveBeenCalledWith('wardrobe/old.webp');
    expect(JSON.stringify(result)).not.toContain(NEW_OBJECT_KEY);
  });

  it.each([
    ['top', 'clothings'],
    ['bottom', 'clothings'],
    ['one-piece', 'clothings'],
    ['outerwear', 'clothings'],
    ['bag', 'accessories'],
    ['accessory', 'accessories'],
    ['jewelry', 'accessories'],
    ['footwear', 'Footware'],
  ] as const)('routes %s images to %s', async (category, folder) => {
    const objectKey = `wardrope/${folder}/new.webp`;
    const h = harness(item(null, category), objectKey);

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result.ok).toBe(true);
    expect(h.fileStorage.storePrivateFile).toHaveBeenCalledWith(
      expect.objectContaining({ folder }),
    );
  });

  it('deletes the newly uploaded object when Mongo compare-and-swap loses a race', async () => {
    const h = harness(item('wardrobe/old.webp'));
    vi.mocked(h.imageRepository.replaceImage).mockResolvedValueOnce(null);
    vi.mocked(h.wardrobeRepository.findById)
      .mockResolvedValueOnce(item('wardrobe/old.webp'))
      .mockResolvedValueOnce(item('wardrobe/other.webp'));

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result).toEqual({ ok: false, reason: 'CONFLICT' });
    expect(h.fileStorage.deletePrivateFile).toHaveBeenCalledWith(NEW_OBJECT_KEY);
    expect(h.fileStorage.deletePrivateFile).not.toHaveBeenCalledWith('wardrobe/old.webp');
  });

  it('reads an existing legacy object key exactly as stored for backward compatibility', async () => {
    const h = harness(item('wardrobe/private.webp'));

    const result = await h.service.read(USER_ID, ITEM_ID);

    expect(result.ok).toBe(true);
    expect(h.fileStorage.getPrivateFile).toHaveBeenCalledWith('wardrobe/private.webp');
  });

  it('clears Mongo before best-effort deletion of the private object', async () => {
    const h = harness(item('wardrobe/private.webp'));
    const calls: string[] = [];
    vi.mocked(h.imageRepository.clearImage).mockImplementation(async () => {
      calls.push('db');
      return { ...item('wardrobe/private.webp'), image: null };
    });
    vi.mocked(h.fileStorage.deletePrivateFile).mockImplementation(async () => {
      calls.push('s3');
    });

    const result = await h.service.remove(USER_ID, ITEM_ID);

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['db', 's3']);
  });

  it('does not process or upload when the owner-scoped item does not exist', async () => {
    const h = harness(item());
    vi.mocked(h.wardrobeRepository.findById).mockResolvedValueOnce(null);

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(h.imageProcessing.processWardrobeImage).not.toHaveBeenCalled();
    expect(h.fileStorage.storePrivateFile).not.toHaveBeenCalled();
  });
});
