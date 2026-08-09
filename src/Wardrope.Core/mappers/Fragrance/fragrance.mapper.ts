import type { FragranceDto } from '../../Models/Fragrance/fragrance.model';
import type { FragranceRecord } from '../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';

export function toFragranceDto(record: FragranceRecord): FragranceDto {
  return {
    id: record.id,
    brand: record.brand,
    name: record.name,
    productLine: record.productLine,
    concentration: record.concentration,
    fragranceFamily: record.fragranceFamily,
    scentType: record.scentType,
    keyNotes: [...record.keyNotes],
    bottleSizeMl: record.bottleSizeMl,
    amountRemainingPercent: record.amountRemainingPercent,
    purchaseDate: record.purchaseDate,
    purchasePrice: record.purchasePrice ? { ...record.purchasePrice } : null,
    available: record.available,
    image: record.image
      ? {
          contentType: record.image.contentType,
          width: record.image.width,
          height: record.image.height,
          sizeBytes: record.image.sizeBytes,
          updatedAt: record.image.updatedAt.toISOString(),
        }
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
