import type { OutfitDto, WearHistoryDto } from '../../Models/Outfit/outfit.model';
import type { OutfitRecord, WearHistoryRecord } from '../../../Wardrope.DB/repositories/RepositoryInterface/Outfit/outfit.repository.interface';

export function toOutfitDto(record: OutfitRecord): OutfitDto {
  return {
    id: record.id,
    name: record.name,
    wardrobeItemIds: [...record.wardrobeItemIds],
    fragranceId: record.fragranceId,
    favorite: record.favorite,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toWearHistoryDto(record: WearHistoryRecord): WearHistoryDto {
  return {
    id: record.id,
    wornAt: record.wornAt.toISOString(),
    wardrobeItemIds: [...record.wardrobeItemIds],
    fragranceId: record.fragranceId,
    sourceOutfitId: record.sourceOutfitId,
    source: record.source,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
