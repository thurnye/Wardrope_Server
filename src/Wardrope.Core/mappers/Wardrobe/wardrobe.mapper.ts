import type { WardrobeItemDto } from '../../Models/Wardrobe/wardrobe.model';
import type { WardrobeItemRecord } from '../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';

export function toWardrobeItemDto(record: WardrobeItemRecord): WardrobeItemDto {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    subcategory: record.subcategory,
    brand: record.brand,
    colors: [...record.colors],
    materials: [...record.materials],
    pattern: record.pattern,
    size: record.size,
    favorite: record.favorite,
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
