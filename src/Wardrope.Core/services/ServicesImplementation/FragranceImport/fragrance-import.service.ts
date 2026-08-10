import type { IFragranceRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import type { FragranceConcentration, FragranceImportPreviewDto } from '../../../Models/Fragrance/fragrance.model';
import type { IFragranceImageService } from '../../ServicesInterface/FragranceImage/fragrance-image.service.interface';
import type { IFragranceImportService, FragranceImportResult } from '../../ServicesInterface/FragranceImport/fragrance-import.service.interface';
import { ProductSourceError, type IProductSourceService } from '../../ServicesInterface/ProductSource/product-source.service.interface';

function concentration(name: string | null): FragranceConcentration | null {
  const value = name?.toLowerCase() ?? '';
  if (/extrait/.test(value)) return 'extrait-de-parfum';
  if (/eau de parfum|\bedp\b/.test(value)) return 'eau-de-parfum';
  if (/eau de toilette|\bedt\b/.test(value)) return 'eau-de-toilette';
  if (/eau de cologne|\bedc\b/.test(value)) return 'eau-de-cologne';
  if (/\bparfum\b/.test(value)) return 'parfum';
  return null;
}

export class FragranceImportService implements IFragranceImportService {
  constructor(
    private readonly repository: IFragranceRepository,
    private readonly imageService: IFragranceImageService,
    private readonly sourceService: IProductSourceService,
  ) {}

  async preview(sourceUrl: string): Promise<FragranceImportResult<FragranceImportPreviewDto>> {
    try {
      const source = await this.sourceService.inspect(sourceUrl);
      return { ok: true, value: {
        sourceUrl: source.sourceUrl,
        brand: source.brand,
        name: source.name,
        concentration: concentration(source.name),
        imageUrls: source.imageUrls,
      } };
    } catch {
      return { ok: false, reason: 'SOURCE_UNAVAILABLE' };
    }
  }

  async importImage(userId: string, fragranceId: string, imageUrl?: string): Promise<FragranceImportResult<import('../../../Models/Fragrance/fragrance.model').FragranceDto>> {
    let fragrance;
    try { fragrance = await this.repository.findById(userId, fragranceId); }
    catch { return { ok: false, reason: 'STORAGE_UNAVAILABLE' }; }
    if (!fragrance) return { ok: false, reason: 'NOT_FOUND' };
    if (!fragrance.sourceUrl) return { ok: false, reason: 'SOURCE_URL_MISSING' };
    try {
      const downloaded = await this.sourceService.downloadPrimaryImage(fragrance.sourceUrl, imageUrl);
      const result = await this.imageService.replace(userId, fragranceId, downloaded);
      if (result.ok) return { ok: true, value: result.fragrance };
      return { ok: false, reason: result.reason };
    } catch (error) {
      if (error instanceof ProductSourceError && error.reason === 'IMAGE_NOT_FOUND') return { ok: false, reason: 'SOURCE_IMAGE_MISSING' };
      return { ok: false, reason: 'SOURCE_UNAVAILABLE' };
    }
  }
}
