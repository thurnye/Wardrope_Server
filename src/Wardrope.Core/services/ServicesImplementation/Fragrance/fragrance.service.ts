import type {
  CreateFragranceDto,
  FragranceListDto,
  FragranceListQueryDto,
  UpdateFragranceDto,
} from '../../../Models/Fragrance/fragrance.model';
import { toFragranceDto } from '../../../mappers/Fragrance/fragrance.mapper';
import type {
  FragranceRepositoryQuery,
  IFragranceRepository,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import type { IFragranceService } from '../../ServicesInterface/Fragrance/fragrance.service.interface';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  return value === undefined ? undefined : value === null ? null : normalizeText(value);
}

function normalizeNotes(values: string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const value of values) {
    const note = normalizeText(value);
    const key = note.toLocaleLowerCase('en');
    if (!seen.has(key)) {
      seen.add(key);
      notes.push(note);
    }
  }
  return notes;
}

function normalizePrice<T extends { amount: number; currency: string } | null | undefined>(price: T): T {
  if (!price) return price;
  return { ...price, currency: price.currency.trim().toUpperCase() } as T;
}

function normalizeCreate(input: CreateFragranceDto): CreateFragranceDto {
  return {
    ...input,
    brand: normalizeText(input.brand),
    name: normalizeText(input.name),
    productLine: normalizeNullableText(input.productLine),
    fragranceFamily: normalizeNullableText(input.fragranceFamily),
    scentType: normalizeNullableText(input.scentType),
    keyNotes: normalizeNotes(input.keyNotes),
    purchasePrice: normalizePrice(input.purchasePrice),
  };
}

function normalizeUpdate(input: UpdateFragranceDto): UpdateFragranceDto {
  return {
    ...input,
    brand: input.brand === undefined ? undefined : normalizeText(input.brand),
    name: input.name === undefined ? undefined : normalizeText(input.name),
    productLine: normalizeNullableText(input.productLine),
    fragranceFamily: normalizeNullableText(input.fragranceFamily),
    scentType: normalizeNullableText(input.scentType),
    keyNotes: normalizeNotes(input.keyNotes),
    purchasePrice: normalizePrice(input.purchasePrice),
  };
}

export class FragranceService implements IFragranceService {
  constructor(
    private readonly repository: IFragranceRepository,
    private readonly fileStorage: IFileStorageService,
    private readonly logger: IApplicationLogger,
  ) {}

  async create(userId: string, input: CreateFragranceDto) {
    return toFragranceDto(await this.repository.create(userId, normalizeCreate(input)));
  }

  async list(userId: string, query: FragranceListQueryDto): Promise<FragranceListDto> {
    const repositoryQuery: FragranceRepositoryQuery = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.available !== undefined) repositoryQuery.available = query.available;
    if (query.concentration !== undefined) repositoryQuery.concentration = query.concentration;
    if (query.search) repositoryQuery.search = normalizeText(query.search);

    const result = await this.repository.list(userId, repositoryQuery);
    return {
      items: result.items.map(toFragranceDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / query.pageSize),
      },
    };
  }

  async getById(userId: string, fragranceId: string) {
    const record = await this.repository.findById(userId, fragranceId);
    return record ? toFragranceDto(record) : null;
  }

  async update(userId: string, fragranceId: string, input: UpdateFragranceDto) {
    const record = await this.repository.update(userId, fragranceId, normalizeUpdate(input));
    return record ? toFragranceDto(record) : null;
  }

  async delete(userId: string, fragranceId: string): Promise<boolean> {
    const deleted = await this.repository.deleteWithRecord(userId, fragranceId);
    if (!deleted) return false;

    if (deleted.image) {
      try {
        await this.fileStorage.deletePrivateFile(deleted.image.objectKey);
      } catch {
        this.logger.warn('fragrance_image_cleanup_after_delete_failed', { fragranceId });
      }
    }
    return true;
  }
}
