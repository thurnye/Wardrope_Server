import type {
  DressMeEngine,
  DressMeProviderContext,
  DressMeProviderRecommendation,
  DressMeRequestDto,
  DressMeResult,
} from '../../../Models/DressMe/dress-me.model';

export interface IDressMeRecommendationProvider {
  readonly engine: DressMeEngine;
  recommend(context: DressMeProviderContext): Promise<DressMeProviderRecommendation[]>;
}

export interface IDressMeService {
  recommend(userId: string, input: DressMeRequestDto): Promise<DressMeResult>;
}
