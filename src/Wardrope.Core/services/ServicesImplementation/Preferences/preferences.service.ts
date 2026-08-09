import type {
  PreferencesDto,
  ReplacePreferencesDto,
  StyleAesthetic,
} from '../../../Models/Preferences/preferences.model';
import type {
  IPreferencesRepository,
  PreferencesRecord,
  ReplacePreferencesRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Preferences/preferences.repository.interface';
import type { IPreferencesService } from '../../ServicesInterface/Preferences/preferences.service.interface';

function normalizeColor(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeColorList(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const color = normalizeColor(value);
    const key = color.toLocaleLowerCase('en');
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(color);
    }
  }

  return normalized;
}

function uniqueAesthetics(values: StyleAesthetic[] | undefined): StyleAesthetic[] {
  return [...new Set(values ?? [])];
}

function assertNoOverlap<T extends string>(
  preferred: T[],
  avoided: T[],
  label: string,
  normalize: (value: T) => string = (value) => value,
): void {
  const avoidedKeys = new Set(avoided.map(normalize));
  const conflict = preferred.find((value) => avoidedKeys.has(normalize(value)));

  if (conflict) {
    throw new Error(`${label} cannot be both preferred and avoided.`);
  }
}

function toReplacement(input: ReplacePreferencesDto): ReplacePreferencesRecord {
  const preferredAesthetics = uniqueAesthetics(input.preferredAesthetics);
  const avoidedAesthetics = uniqueAesthetics(input.avoidedAesthetics);
  const preferredColors = normalizeColorList(input.preferredColors);
  const avoidedColors = normalizeColorList(input.avoidedColors);

  assertNoOverlap(preferredAesthetics, avoidedAesthetics, 'An aesthetic');
  assertNoOverlap(
    preferredColors,
    avoidedColors,
    'A color',
    (value) => value.toLocaleLowerCase('en'),
  );

  return {
    preferredAesthetics,
    avoidedAesthetics,
    preferredColors,
    avoidedColors,
    experimentationLevel: input.experimentationLevel ?? null,
    accessoryLevel: input.accessoryLevel ?? null,
    patternLevel: input.patternLevel ?? null,
    layeringLevel: input.layeringLevel ?? null,
    repeatPreference: input.repeatPreference ?? null,
  };
}

function toDto(record: PreferencesRecord): PreferencesDto {
  return {
    preferredAesthetics: [...record.preferredAesthetics],
    avoidedAesthetics: [...record.avoidedAesthetics],
    preferredColors: [...record.preferredColors],
    avoidedColors: [...record.avoidedColors],
    experimentationLevel: record.experimentationLevel,
    accessoryLevel: record.accessoryLevel,
    patternLevel: record.patternLevel,
    layeringLevel: record.layeringLevel,
    repeatPreference: record.repeatPreference,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PreferencesService implements IPreferencesService {
  constructor(private readonly preferencesRepository: IPreferencesRepository) {}

  async get(userId: string): Promise<PreferencesDto | null> {
    const record = await this.preferencesRepository.findByUserId(userId);
    return record ? toDto(record) : null;
  }

  async replace(userId: string, input: ReplacePreferencesDto): Promise<PreferencesDto> {
    return toDto(await this.preferencesRepository.replace(userId, toReplacement(input)));
  }

  async reset(userId: string): Promise<void> {
    await this.preferencesRepository.delete(userId);
  }
}
