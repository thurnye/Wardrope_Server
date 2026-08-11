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
const NEW_OBJECT_KEY = `Wardrope/clothes/${USER_ID}/${ITEM_ID}/new.webp`;

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
    images: imageObjectKey
      ? [{
          objectKey: imageObjectKey,
          etag: '"old"',
          contentType: 'image/webp',
          width: 900,
          height: 1200,
          sizeBytes: 1000,
          updatedAt: now,
        }]
      : [],
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
    replaceImages: vi.fn().mockImplementation(async (_userId, _itemId, _expected, images) => ({
      ...current,
      images,
    })),
    replaceImage: vi.fn().mockImplementation(async (_userId, _itemId, _expected, image) => ({
      ...current,
      images: [image],
    })),
    clearImage: vi.fn().mockResolvedValue({ ...current, images: [] }),
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
  it('stores wardrobe images in shared category folders without user or item IDs', async () => {
    const cases = [
      ['top', 'clothings'], ['bottom', 'clothings'], ['one-piece', 'clothings'],
      ['outerwear', 'clothings'], ['bag', 'accessories'], ['accessory', 'accessories'],
      ['jewelry', 'accessories'], ['footwear', 'Footware'],
    ] as const;
    for (const [category, folder] of cases) {
      const h = harness(item(null, category));
      const result = await h.service.replace(USER_ID, ITEM_ID, {
        bytes: Buffer.from('input'),
        declaredContentType: 'image/png',
      });

      expect(result.ok).toBe(true);
      expect(h.fileStorage.storePrivateFile).toHaveBeenCalledWith(
        expect.objectContaining({
          pathSegments: [folder],
          fileExtension: 'webp',
        }),
      );
      expect(h.fileStorage.storePrivateFile).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathSegments: expect.arrayContaining([USER_ID, ITEM_ID]) }),
      );
      expect(JSON.stringify(result)).not.toContain(NEW_OBJECT_KEY);
    }
  });

  it('appends a new image without retiring existing image objects', async () => {
    const h = harness(item('wardrope/old.webp', 'outerwear'));
    const calls: string[] = [];
    vi.mocked(h.imageRepository.replaceImages!).mockImplementation(async (_userId, _itemId, _expected, images) => {
      calls.push('db');
      return { ...item('wardrope/old.webp'), images };
    });
    vi.mocked(h.fileStorage.deletePrivateFile).mockImplementation(async () => {
      calls.push('s3-delete');
    });

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['db']);
    expect(h.fileStorage.deletePrivateFile).not.toHaveBeenCalled();
    expect(h.imageRepository.replaceImages).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      ['wardrope/old.webp'],
      expect.arrayContaining([
        expect.objectContaining({ objectKey: 'wardrope/old.webp' }),
        expect.objectContaining({ objectKey: NEW_OBJECT_KEY }),
      ]),
    );
  });

  it('deletes the newly uploaded object when Mongo compare-and-swap loses a race', async () => {
    const h = harness(item('wardrope/old.webp'));
    vi.mocked(h.imageRepository.replaceImages!).mockResolvedValueOnce(null);
    vi.mocked(h.wardrobeRepository.findById)
      .mockResolvedValueOnce(item('wardrope/old.webp'))
      .mockResolvedValueOnce(item('wardrope/other.webp'));

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result).toEqual({ ok: false, reason: 'CONFLICT' });
    expect(h.fileStorage.deletePrivateFile).toHaveBeenCalledWith(NEW_OBJECT_KEY);
    expect(h.fileStorage.deletePrivateFile).not.toHaveBeenCalledWith('wardrope/old.webp');
  });

  it('reads the first image object key exactly as stored', async () => {
    const h = harness(item('wardrope/private.webp'));

    const result = await h.service.read(USER_ID, ITEM_ID);

    expect(result.ok).toBe(true);
    expect(h.fileStorage.getPrivateFile).toHaveBeenCalledWith('wardrope/private.webp');
  });

  it('clears Mongo before best-effort deletion of the private object', async () => {
    const h = harness(item('wardrope/private.webp'));
    const calls: string[] = [];
    vi.mocked(h.imageRepository.clearImage).mockImplementation(async () => {
      calls.push('db');
      return { ...item('wardrope/private.webp'), images: [] };
    });
    vi.mocked(h.fileStorage.deletePrivateFile).mockImplementation(async () => {
      calls.push('s3');
    });

    const result = await h.service.remove(USER_ID, ITEM_ID);

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['db', 's3']);
  });

  it('removes only the selected image and preserves the others', async () => {
    const current = item('wardrope/first.webp');
    current.images.push({
      ...current.images[0]!,
      objectKey: 'wardrope/second.webp',
    });
    const h = harness(current);

    const result = await h.service.remove(USER_ID, ITEM_ID, 1);

    expect(result.ok).toBe(true);
    expect(h.imageRepository.replaceImages).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      ['wardrope/first.webp', 'wardrope/second.webp'],
      [expect.objectContaining({ objectKey: 'wardrope/first.webp' })],
    );
    expect(h.fileStorage.deletePrivateFile).toHaveBeenCalledWith('wardrope/second.webp');
    expect(h.fileStorage.deletePrivateFile).not.toHaveBeenCalledWith('wardrope/first.webp');
  });

  it('rejects an appended photo when the item already has ten', async () => {
    const current = item('wardrope/1.webp');
    current.images = Array.from({ length: 10 }, (_, index) => ({
      ...current.images[0]!,
      objectKey: `wardrope/${index + 1}.webp`,
    }));
    const h = harness(current);

    const result = await h.service.replace(USER_ID, ITEM_ID, {
      bytes: Buffer.from('input'),
      declaredContentType: 'image/png',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'INVALID_IMAGE',
      validationReason: 'INVALID_IMAGE_COUNT',
    });
    expect(h.imageProcessing.processWardrobeImage).not.toHaveBeenCalled();
    expect(h.fileStorage.storePrivateFile).not.toHaveBeenCalled();
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
