import type {
  PhysicalProfileDto,
  ReplacePhysicalProfileDto,
} from '../../../Models/PhysicalProfile/physical-profile.model';
import type {
  IPhysicalProfileRepository,
  PhysicalProfileRecord,
  ReplacePhysicalProfileRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/PhysicalProfile/physical-profile.repository.interface';
import type { IPhysicalProfileService } from '../../ServicesInterface/PhysicalProfile/physical-profile.service.interface';

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function toDto(record: PhysicalProfileRecord): PhysicalProfileDto {
  return {
    heightCm: record.heightCm,
    shoulderWidthCm: record.shoulderWidthCm,
    chestCm: record.chestCm,
    waistCm: record.waistCm,
    hipsCm: record.hipsCm,
    inseamCm: record.inseamCm,
    sleeveLengthCm: record.sleeveLengthCm,
    bodyShape: record.bodyShape,
    skinTone: record.skinTone,
    fitPreference: record.fitPreference,
    usualTopSize: record.usualTopSize,
    usualBottomSize: record.usualBottomSize,
    usualOnePieceSize: record.usualOnePieceSize,
    usualOuterwearSize: record.usualOuterwearSize,
    shoeSize: record.shoeSize,
    shoeSizeSystem: record.shoeSizeSystem,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toReplacement(input: ReplacePhysicalProfileDto): ReplacePhysicalProfileRecord {
  const shoeSize = normalizeNullableText(input.shoeSize);
  const shoeSizeSystem = input.shoeSizeSystem ?? null;

  if ((shoeSize === null) !== (shoeSizeSystem === null)) {
    throw new Error('Shoe size and shoe-size system must be provided together.');
  }

  return {
    heightCm: input.heightCm ?? null,
    shoulderWidthCm: input.shoulderWidthCm ?? null,
    chestCm: input.chestCm ?? null,
    waistCm: input.waistCm ?? null,
    hipsCm: input.hipsCm ?? null,
    inseamCm: input.inseamCm ?? null,
    sleeveLengthCm: input.sleeveLengthCm ?? null,
    bodyShape: input.bodyShape ?? null,
    skinTone: input.skinTone ?? null,
    fitPreference: input.fitPreference ?? null,
    usualTopSize: normalizeNullableText(input.usualTopSize),
    usualBottomSize: normalizeNullableText(input.usualBottomSize),
    usualOnePieceSize: normalizeNullableText(input.usualOnePieceSize),
    usualOuterwearSize: normalizeNullableText(input.usualOuterwearSize),
    shoeSize,
    shoeSizeSystem,
  };
}

export class PhysicalProfileService implements IPhysicalProfileService {
  constructor(private readonly physicalProfileRepository: IPhysicalProfileRepository) {}

  async get(userId: string): Promise<PhysicalProfileDto | null> {
    const profile = await this.physicalProfileRepository.findByUserId(userId);
    return profile ? toDto(profile) : null;
  }

  async replace(userId: string, input: ReplacePhysicalProfileDto): Promise<PhysicalProfileDto> {
    return toDto(await this.physicalProfileRepository.replace(userId, toReplacement(input)));
  }

  async reset(userId: string): Promise<void> {
    await this.physicalProfileRepository.delete(userId);
  }
}
