import type {
  DressMeProviderContext,
  DressMeProviderRecommendation,
  DressMeRequestDto,
  DressMeResult,
} from '../../../Models/DressMe/dress-me.model';

export interface IDressMeRecommendationProvider {
  recommend(context: DressMeProviderContext): Promise<DressMeProviderRecommendation[]>;
}

export interface IDressMeService {
  recommend(userId: string, input: DressMeRequestDto): Promise<DressMeResult>;
}
