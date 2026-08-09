export interface OutfitDto {
  id: string;
  name: string;
  wardrobeItemIds: string[];
  fragranceId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutfitDto {
  name: string;
  wardrobeItemIds: string[];
  fragranceId?: string | null | undefined;
  favorite?: boolean | undefined;
}

export interface UpdateOutfitDto {
  name?: string | undefined;
  wardrobeItemIds?: string[] | undefined;
  fragranceId?: string | null | undefined;
  favorite?: boolean | undefined;
}

export interface OutfitListQueryDto {
  page: number;
  pageSize: number;
  favorite?: boolean | undefined;
  search?: string | undefined;
}

export interface OutfitListDto {
  items: OutfitDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const WEAR_HISTORY_SOURCES = ['manual', 'saved-outfit', 'dress-me'] as const;
export type WearHistorySource = (typeof WEAR_HISTORY_SOURCES)[number];

export interface WearHistoryDto {
  id: string;
  wornAt: string;
  wardrobeItemIds: string[];
  fragranceId: string | null;
  sourceOutfitId: string | null;
  source: WearHistorySource;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWearHistoryDto {
  wornAt: string;
  wardrobeItemIds: string[];
  fragranceId?: string | null | undefined;
  sourceOutfitId?: string | null | undefined;
  source?: WearHistorySource | undefined;
}

export interface UpdateWearHistoryDto {
  wornAt?: string | undefined;
  wardrobeItemIds?: string[] | undefined;
  fragranceId?: string | null | undefined;
  sourceOutfitId?: string | null | undefined;
  source?: WearHistorySource | undefined;
}

export interface WearHistoryListQueryDto {
  page: number;
  pageSize: number;
  from?: string | undefined;
  to?: string | undefined;
}

export interface WearHistoryListDto {
  items: WearHistoryDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
