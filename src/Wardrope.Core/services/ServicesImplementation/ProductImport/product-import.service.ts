import type {
  ProductImportPreviewDto,
  WardrobeCategory,
} from '../../../Models/Wardrobe/wardrobe.model';
import type { IWardrobeRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type {
  IProductImportService,
  ProductImageImportResult,
  ProductImportPreviewFailureReason,
  ProductImportPreviewResult,
} from '../../ServicesInterface/ProductImport/product-import.service.interface';
import {
  ProductSourceError,
  type IProductSourceService,
  type ProductSourceFailureReason,
  type ProductSourceSnapshot,
} from '../../ServicesInterface/ProductSource/product-source.service.interface';
import type { IWardrobeImageService } from '../../ServicesInterface/WardrobeImage/wardrobe-image.service.interface';

const CATEGORY_RULES: ReadonlyArray<{
  category: WardrobeCategory;
  keywords: readonly string[];
}> = [
  {
    category: 'footwear',
    keywords: [
      'shoe',
      'sneaker',
      'trainer',
      'boot',
      'loafer',
      'heel',
      'sandal',
      'slipper',
    ],
  },
  {
    category: 'bag',
    keywords: [
      'bag',
      'handbag',
      'backpack',
      'tote',
      'clutch',
      'purse',
      'briefcase',
    ],
  },
  {
    category: 'jewelry',
    keywords: [
      'necklace',
      'bracelet',
      'earring',
      'ring',
      'pendant',
      'jewelry',
      'jewellery',
    ],
  },
  {
    category: 'outerwear',
    keywords: [
      'coat',
      'jacket',
      'blazer',
      'parka',
      'trench',
      'overcoat',
      'windbreaker',
    ],
  },
  {
    category: 'one-piece',
    keywords: ['dress', 'jumpsuit', 'romper', 'gown', 'overall'],
  },
  {
    category: 'bottom',
    keywords: ['pant', 'trouser', 'jean', 'short', 'skirt', 'chino', 'legging'],
  },
  {
    category: 'top',
    keywords: [
      'shirt',
      't-shirt',
      'tee',
      'blouse',
      'sweater',
      'hoodie',
      'top',
      'polo',
      'cardigan',
    ],
  },
  {
    category: 'accessory',
    keywords: [
      'belt',
      'hat',
      'cap',
      'scarf',
      'tie',
      'sunglass',
      'wallet',
      'glove',
      'watch',
    ],
  },
];

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeList(
  values: string[],
  maxItems: number,
  maxLength: number,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeText(raw).slice(0, maxLength);
    const key = value.toLocaleLowerCase('en');
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= maxItems) break;
  }

  return result;
}

function inferCategory(
  snapshot: ProductSourceSnapshot,
): WardrobeCategory | null {
  const haystack =
    `${snapshot.categoryHint ?? ''} ${snapshot.name ?? ''}`.toLocaleLowerCase(
      'en',
    );

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category;
    }
  }

  return null;
}

function inferSubcategory(snapshot: ProductSourceSnapshot): string | null {
  if (snapshot.categoryHint) {
    const segments = snapshot.categoryHint
      .split(/[>|/]/)
      .map(normalizeText)
      .filter(Boolean);
    const candidate = segments.at(-1);
    if (candidate) return candidate.slice(0, 60);
  }

  const name = snapshot.name?.toLocaleLowerCase('en') ?? '';
  const labels: ReadonlyArray<[string, string]> = [
    ['sneaker', 'Sneakers'],
    ['trainer', 'Sneakers'],
    ['loafer', 'Loafers'],
    ['boot', 'Boots'],
    ['blazer', 'Blazer'],
    ['jacket', 'Jacket'],
    ['coat', 'Coat'],
    ['hoodie', 'Hoodie'],
    ['sweater', 'Sweater'],
    ['shirt', 'Shirt'],
    ['t-shirt', 'T-shirt'],
    ['dress', 'Dress'],
    ['jean', 'Jeans'],
    ['trouser', 'Trousers'],
    ['pant', 'Pants'],
    ['short', 'Shorts'],
    ['skirt', 'Skirt'],
    ['backpack', 'Backpack'],
    ['tote', 'Tote bag'],
    ['handbag', 'Handbag'],
  ];

  return labels.find(([keyword]) => name.includes(keyword))?.[1] ?? null;
}

function mapPreviewFailure(
  reason: ProductSourceFailureReason,
): ProductImportPreviewFailureReason {
  switch (reason) {
    case 'URL_NOT_ALLOWED':
      return 'SOURCE_URL_NOT_ALLOWED';
    case 'SOURCE_TOO_LARGE':
      return 'SOURCE_TOO_LARGE';
    case 'UNSUPPORTED_CONTENT':
      return 'UNSUPPORTED_SOURCE';
    case 'PRODUCT_NOT_RECOGNIZED':
      return 'PRODUCT_NOT_RECOGNIZED';
    case 'IMAGE_NOT_FOUND':
    case 'SOURCE_UNAVAILABLE':
    default:
      return 'SOURCE_UNAVAILABLE';
  }
}

export class ProductImportService implements IProductImportService {
  constructor(
    private readonly wardrobeRepository: IWardrobeRepository,
    private readonly wardrobeImageService: IWardrobeImageService,
    private readonly productSourceService: IProductSourceService,
  ) {}

  async preview(sourceUrl: string): Promise<ProductImportPreviewResult> {
    try {
      const snapshot = await this.productSourceService.inspect(sourceUrl);
      const preview: ProductImportPreviewDto = {
        sourceUrl: snapshot.sourceUrl,
        name: snapshot.name ? normalizeText(snapshot.name).slice(0, 100) : null,
        brand: snapshot.brand
          ? normalizeText(snapshot.brand).slice(0, 80)
          : null,
        colors: normalizeList(snapshot.colors, 5, 40),
        materials: normalizeList(snapshot.materials, 8, 60),
        suggestedCategory: inferCategory(snapshot),
        suggestedSubcategory: inferSubcategory(snapshot),
        imageAvailable: snapshot.imageUrls.length > 0,
        imageUrls: snapshot.imageUrls,
      };

      if (!preview.name && !preview.brand && !preview.suggestedCategory) {
        return { ok: false, reason: 'PRODUCT_NOT_RECOGNIZED' };
      }

      return { ok: true, preview };
    } catch (error) {
      if (error instanceof ProductSourceError) {
        return { ok: false, reason: mapPreviewFailure(error.reason) };
      }
      return { ok: false, reason: 'SOURCE_UNAVAILABLE' };
    }
  }

  async importImage(
    userId: string,
    itemId: string,
    imageUrls?: string[],
  ): Promise<ProductImageImportResult> {
    let item;
    try {
      item = await this.wardrobeRepository.findById(userId, itemId);
    } catch {
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!item) return { ok: false, reason: 'NOT_FOUND' };
    if (!item.sourceUrl) return { ok: false, reason: 'SOURCE_URL_MISSING' };

    let downloaded;
    try {
      const selectedUrls = imageUrls?.length ? Array.from(new Set(imageUrls)) : [undefined];
      downloaded = await Promise.all(selectedUrls.map((imageUrl) => imageUrl
        ? this.productSourceService.downloadPrimaryImage(item.sourceUrl!, imageUrl)
        : this.productSourceService.downloadPrimaryImage(item.sourceUrl!),
      ));
    } catch (error) {
      if (error instanceof ProductSourceError) {
        switch (error.reason) {
          case 'URL_NOT_ALLOWED':
            return { ok: false, reason: 'SOURCE_URL_NOT_ALLOWED' };
          case 'SOURCE_TOO_LARGE':
            return { ok: false, reason: 'SOURCE_TOO_LARGE' };
          case 'IMAGE_NOT_FOUND':
          case 'PRODUCT_NOT_RECOGNIZED':
            return { ok: false, reason: 'SOURCE_IMAGE_MISSING' };
          case 'UNSUPPORTED_CONTENT':
          case 'SOURCE_UNAVAILABLE':
          default:
            return { ok: false, reason: 'SOURCE_UNAVAILABLE' };
        }
      }
      return { ok: false, reason: 'SOURCE_UNAVAILABLE' };
    }

    const result = this.wardrobeImageService.replaceMany
      ? await this.wardrobeImageService.replaceMany(userId, itemId, downloaded)
      : downloaded.length === 1
        ? await this.wardrobeImageService.replace(userId, itemId, downloaded[0]!)
        : { ok: false as const, reason: 'STORAGE_UNAVAILABLE' as const };
    if (result.ok) return result;

    switch (result.reason) {
      case 'NOT_FOUND':
        return { ok: false, reason: 'NOT_FOUND' };
      case 'INVALID_IMAGE':
        return { ok: false, reason: 'INVALID_IMAGE' };
      case 'CONFLICT':
        return { ok: false, reason: 'CONFLICT' };
      case 'STORAGE_UNAVAILABLE':
      default:
        return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
  }
}
