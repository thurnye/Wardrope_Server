import { describe, expect, it, vi } from 'vitest';
import type { WardrobeItemRecord } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeImageService } from '../../ServicesInterface/WardrobeImage/wardrobe-image.service.interface';
import {
  ProductSourceError,
  type IProductSourceService,
} from '../../ServicesInterface/ProductSource/product-source.service.interface';
import { ProductImportService } from './product-import.service';

const USER_ID = '64b000000000000000000001';
const ITEM_ID = '64c000000000000000000001';

function item(
  sourceUrl: string | null = 'https://shop.example/products/navy-sneaker',
): WardrobeItemRecord {
  const now = new Date('2026-08-09T12:00:00.000Z');
  return {
    id: ITEM_ID,
    userId: USER_ID,
    name: 'Navy Sneaker',
    category: 'footwear',
    subcategory: 'Sneakers',
    brand: 'Example',
    colors: ['Navy'],
    materials: ['Leather'],
    pattern: 'solid',
    size: null,
    favorite: false,
    sourceUrl,
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

function harness(current: WardrobeItemRecord | null = item()) {
  const wardrobeRepository = {
    findById: vi.fn().mockResolvedValue(current),
  } as unknown as IWardrobeRepository;

  const wardrobeImageService: IWardrobeImageService = {
    replace: vi.fn().mockResolvedValue({
      ok: true,
      item: {
        id: ITEM_ID,
        name: 'Navy Sneaker',
        category: 'footwear',
        subcategory: 'Sneakers',
        brand: 'Example',
        colors: ['Navy'],
        materials: ['Leather'],
        pattern: 'solid',
        size: null,
        favorite: false,
        sourceUrl: 'https://shop.example/products/navy-sneaker',
        images: [{
          contentType: 'image/webp',
          width: 800,
          height: 800,
          sizeBytes: 1000,
          updatedAt: '2026-08-09T12:00:00.000Z',
        }],
        createdAt: '2026-08-09T12:00:00.000Z',
        updatedAt: '2026-08-09T12:00:00.000Z',
      },
    }),
    read: vi.fn(),
    remove: vi.fn(),
  };

  const productSourceService: IProductSourceService = {
    inspect: vi.fn().mockResolvedValue({
      sourceUrl: 'https://shop.example/products/navy-sneaker',
      name: ' Navy   Leather Sneaker ',
      brand: ' Example ',
      colors: ['Navy', 'navy', 'White'],
      materials: ['Leather'],
      categoryHint: 'Men > Shoes > Sneakers',
      imageUrls: ['https://cdn.example/navy.jpg'],
    }),
    downloadPrimaryImage: vi.fn().mockResolvedValue({
      bytes: Buffer.from('remote-image'),
      declaredContentType: 'image/jpeg',
    }),
  };

  return {
    service: new ProductImportService(
      wardrobeRepository,
      wardrobeImageService,
      productSourceService,
    ),
    wardrobeRepository,
    wardrobeImageService,
    productSourceService,
  };
}

describe('ProductImportService', () => {
  it('returns bounded editable product suggestions with product image choices', async () => {
    const h = harness();
    const result = await h.service.preview(
      'https://shop.example/products/navy-sneaker',
    );

    expect(result).toEqual({
      ok: true,
      preview: {
        sourceUrl: 'https://shop.example/products/navy-sneaker',
        name: 'Navy Leather Sneaker',
        brand: 'Example',
        colors: ['Navy', 'White'],
        materials: ['Leather'],
        suggestedCategory: 'footwear',
        suggestedSubcategory: 'Sneakers',
        imageAvailable: true,
        imageUrls: ['https://cdn.example/navy.jpg'],
      },
    });
  });

  it('maps blocked source URLs to a safe preview failure', async () => {
    const h = harness();
    vi.mocked(h.productSourceService.inspect).mockRejectedValueOnce(
      new ProductSourceError('URL_NOT_ALLOWED', 'blocked'),
    );

    await expect(
      h.service.preview('https://127.0.0.1/product'),
    ).resolves.toEqual({
      ok: false,
      reason: 'SOURCE_URL_NOT_ALLOWED',
    });
  });

  it('checks owner-scoped item existence before making any source request', async () => {
    const h = harness(null);
    const result = await h.service.importImage(USER_ID, ITEM_ID);

    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(h.productSourceService.downloadPrimaryImage).not.toHaveBeenCalled();
    expect(h.wardrobeImageService.replace).not.toHaveBeenCalled();
  });

  it('requires the stored source URL rather than accepting a browser-supplied image URL', async () => {
    const h = harness(item(null));
    const result = await h.service.importImage(USER_ID, ITEM_ID);

    expect(result).toEqual({ ok: false, reason: 'SOURCE_URL_MISSING' });
    expect(h.productSourceService.downloadPrimaryImage).not.toHaveBeenCalled();
  });

  it('downloads through the product source provider then reuses the existing image validation/storage service', async () => {
    const h = harness();
    const result = await h.service.importImage(USER_ID, ITEM_ID);

    expect(result.ok).toBe(true);
    expect(h.productSourceService.downloadPrimaryImage).toHaveBeenCalledWith(
      'https://shop.example/products/navy-sneaker',
    );
    expect(h.wardrobeImageService.replace).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      {
        bytes: Buffer.from('remote-image'),
        declaredContentType: 'image/jpeg',
      },
    );
  });

  it('downloads every selected product image and archives them together', async () => {
    const h = harness();
    const replaceMany = vi.fn().mockResolvedValue({ ok: true, item: {} });
    h.wardrobeImageService.replaceMany = replaceMany;
    const urls = ['https://cdn.example/front.jpg', 'https://cdn.example/back.jpg'];

    const result = await h.service.importImage(USER_ID, ITEM_ID, urls);

    expect(result.ok).toBe(true);
    expect(h.productSourceService.downloadPrimaryImage).toHaveBeenNthCalledWith(
      1, 'https://shop.example/products/navy-sneaker', urls[0],
    );
    expect(h.productSourceService.downloadPrimaryImage).toHaveBeenNthCalledWith(
      2, 'https://shop.example/products/navy-sneaker', urls[1],
    );
    expect(replaceMany).toHaveBeenCalledWith(USER_ID, ITEM_ID, [
      { bytes: Buffer.from('remote-image'), declaredContentType: 'image/jpeg' },
      { bytes: Buffer.from('remote-image'), declaredContentType: 'image/jpeg' },
    ]);
  });

  it('maps a missing remote image without attempting storage', async () => {
    const h = harness();
    vi.mocked(
      h.productSourceService.downloadPrimaryImage,
    ).mockRejectedValueOnce(
      new ProductSourceError('IMAGE_NOT_FOUND', 'missing'),
    );

    await expect(h.service.importImage(USER_ID, ITEM_ID)).resolves.toEqual({
      ok: false,
      reason: 'SOURCE_IMAGE_MISSING',
    });
    expect(h.wardrobeImageService.replace).not.toHaveBeenCalled();
  });
});
