import type {
  CreateWardrobeItemDto,
  UpdateWardrobeItemDto,
  WardrobeItemDto,
  WardrobeListDto,
  WardrobeListQueryDto,
} from '../../../Models/Wardrobe/wardrobe.model';
import type {
  IWardrobeRepository,
  WardrobeItemRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeService } from '../../ServicesInterface/Wardrobe/wardrobe.service.interface';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : normalizeText(value);
}

function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const item = normalizeText(value);
    const key = item.toLocaleLowerCase('en');

    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(item);
    }
  }

  return normalized;
}

function toDto(record: WardrobeItemRecord): WardrobeItemDto {
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeCreate(input: CreateWardrobeItemDto): CreateWardrobeItemDto {
  return {
    name: normalizeText(input.name),
    category: input.category,
    subcategory: normalizeText(input.subcategory),
    brand: normalizeNullableText(input.brand) ?? null,
    colors: normalizeList(input.colors),
    materials: normalizeList(input.materials ?? []),
    pattern: input.pattern ?? null,
    size: normalizeNullableText(input.size) ?? null,
    favorite: input.favorite ?? false,
  };
}

function normalizeUpdate(input: UpdateWardrobeItemDto): UpdateWardrobeItemDto {
  const normalized: UpdateWardrobeItemDto = {};

  if (input.name !== undefined) normalized.name = normalizeText(input.name);
  if (input.category !== undefined) normalized.category = input.category;
  if (input.subcategory !== undefined) normalized.subcategory = normalizeText(input.subcategory);
  if ('brand' in input) normalized.brand = normalizeNullableText(input.brand) ?? null;
  if (input.colors !== undefined) normalized.colors = normalizeList(input.colors);
  if (input.materials !== undefined) normalized.materials = normalizeList(input.materials);
  if ('pattern' in input) normalized.pattern = input.pattern ?? null;
  if ('size' in input) normalized.size = normalizeNullableText(input.size) ?? null;
  if (input.favorite !== undefined) normalized.favorite = input.favorite;

  return normalized;
}

export class WardrobeService implements IWardrobeService {
  constructor(private readonly wardrobeRepository: IWardrobeRepository) {}

  async create(userId: string, input: CreateWardrobeItemDto): Promise<WardrobeItemDto> {
    return toDto(await this.wardrobeRepository.create(userId, normalizeCreate(input)));
  }

  async list(userId: string, query: WardrobeListQueryDto): Promise<WardrobeListDto> {
    const result = await this.wardrobeRepository.list(userId, {
      ...query,
      search: query.search ? normalizeText(query.search) : undefined,
    });

    return {
      items: result.items.map(toDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      },
    };
  }

  async getById(userId: string, itemId: string): Promise<WardrobeItemDto | null> {
    const item = await this.wardrobeRepository.findById(userId, itemId);
    return item ? toDto(item) : null;
  }

  async update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemDto,
  ): Promise<WardrobeItemDto | null> {
    const item = await this.wardrobeRepository.update(userId, itemId, normalizeUpdate(input));
    return item ? toDto(item) : null;
  }

  delete(userId: string, itemId: string): Promise<boolean> {
    return this.wardrobeRepository.delete(userId, itemId);
  }
}
