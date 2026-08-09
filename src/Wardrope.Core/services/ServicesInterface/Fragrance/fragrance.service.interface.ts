import type {
  CreateFragranceDto,
  FragranceDto,
  FragranceListDto,
  FragranceListQueryDto,
  UpdateFragranceDto,
} from '../../../Models/Fragrance/fragrance.model';

export interface IFragranceService {
  create(userId: string, input: CreateFragranceDto): Promise<FragranceDto>;
  list(userId: string, query: FragranceListQueryDto): Promise<FragranceListDto>;
  getById(userId: string, fragranceId: string): Promise<FragranceDto | null>;
  update(userId: string, fragranceId: string, input: UpdateFragranceDto): Promise<FragranceDto | null>;
  delete(userId: string, fragranceId: string): Promise<boolean>;
}
