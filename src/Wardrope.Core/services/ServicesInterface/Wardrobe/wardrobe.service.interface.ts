import type {
  CreateWardrobeItemDto,
  UpdateWardrobeItemDto,
  WardrobeItemDto,
  WardrobeListDto,
  WardrobeListQueryDto,
} from '../../../Models/Wardrobe/wardrobe.model';

export interface IWardrobeService {
  create(userId: string, input: CreateWardrobeItemDto): Promise<WardrobeItemDto>;
  list(userId: string, query: WardrobeListQueryDto): Promise<WardrobeListDto>;
  getById(userId: string, itemId: string): Promise<WardrobeItemDto | null>;
  update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemDto | null>;
  delete(userId: string, itemId: string): Promise<boolean>;
}
