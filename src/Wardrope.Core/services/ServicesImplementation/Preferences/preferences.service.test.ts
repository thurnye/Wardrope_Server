import { describe, expect, it, vi } from 'vitest';
import type {
  IPreferencesRepository,
  PreferencesRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Preferences/preferences.repository.interface';
import { PreferencesService } from './preferences.service';

const USER_ID = '64b000000000000000000001';

function record(overrides: Partial<PreferencesRecord> = {}): PreferencesRecord {
  return {
    userId: USER_ID,
    preferredAesthetics: [],
    avoidedAesthetics: [],
    preferredColors: [],
    avoidedColors: [],
    experimentationLevel: null,
    accessoryLevel: null,
    patternLevel: null,
    layeringLevel: null,
    repeatPreference: null,
    createdAt: new Date('2026-08-09T05:00:00.000Z'),
    updatedAt: new Date('2026-08-09T06:00:00.000Z'),
    ...overrides,
  };
}

function harness() {
  const repository: IPreferencesRepository = {
    findByUserId: vi.fn().mockResolvedValue(null),
    replace: vi.fn().mockImplementation(async (userId, input) => record({ userId, ...input })),
    delete: vi.fn().mockResolvedValue(false),
    ensureIndexes: vi.fn(),
  };
  return { repository, service: new PreferencesService(repository) };
}

describe('PreferencesService', () => {
  it('returns null before preferences are created', async () => {
    const { service } = harness();
    await expect(service.get(USER_ID)).resolves.toBeNull();
  });

  it('normalizes and de-duplicates color labels and aesthetics', async () => {
    const { service, repository } = harness();

    const result = await service.replace(USER_ID, {
      preferredAesthetics: ['classic', 'classic', 'minimalist'],
      preferredColors: [' Navy ', 'navy', ' Soft   White '],
      avoidedColors: ['Orange'],
      experimentationLevel: 'balanced',
    });

    expect(repository.replace).toHaveBeenCalledWith(USER_ID, {
      preferredAesthetics: ['classic', 'minimalist'],
      avoidedAesthetics: [],
      preferredColors: ['Navy', 'Soft White'],
      avoidedColors: ['Orange'],
      experimentationLevel: 'balanced',
      accessoryLevel: null,
      patternLevel: null,
      layeringLevel: null,
      repeatPreference: null,
    });
    expect(result.preferredColors).toEqual(['Navy', 'Soft White']);
    expect(result).not.toHaveProperty('userId');
  });

  it('rejects aesthetics that are both preferred and avoided', async () => {
    const { service, repository } = harness();
    await expect(service.replace(USER_ID, {
      preferredAesthetics: ['classic'],
      avoidedAesthetics: ['classic'],
    })).rejects.toThrow(/both preferred and avoided/i);
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it('rejects color conflicts after case and whitespace normalization', async () => {
    const { service, repository } = harness();
    await expect(service.replace(USER_ID, {
      preferredColors: ['Soft White'],
      avoidedColors: [' soft   white '],
    })).rejects.toThrow(/both preferred and avoided/i);
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it('maps timestamps and resets without exposing deletion state', async () => {
    const { service, repository } = harness();
    vi.mocked(repository.findByUserId).mockResolvedValueOnce(record({
      repeatPreference: 'rewear-friendly',
      updatedAt: new Date('2026-08-09T07:00:00.000Z'),
    }));

    await expect(service.get(USER_ID)).resolves.toMatchObject({
      repeatPreference: 'rewear-friendly',
      updatedAt: '2026-08-09T07:00:00.000Z',
    });

    await service.reset(USER_ID);
    expect(repository.delete).toHaveBeenCalledWith(USER_ID);
  });
});
