import type { WardrobeItemDto } from '../../Models/Wardrobe/wardrobe.model';
import type { WardrobeItemRecord } from '../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';

export function toWardrobeItemDto(record: WardrobeItemRecord): WardrobeItemDto {
  const images = record.images.map((image) => ({
    contentType: image.contentType,
    width: image.width,
    height: image.height,
    sizeBytes: image.sizeBytes,
    updatedAt: image.updatedAt.toISOString(),
  }));
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    subcategory: record.subcategory,
    brand: record.brand,
    description: record.description ?? null,
    colors: [...record.colors],
    materials: [...record.materials],
    pattern: record.pattern,
    size: record.size,
    favorite: record.favorite,
    sourceUrl: record.sourceUrl ?? null,
    images,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
