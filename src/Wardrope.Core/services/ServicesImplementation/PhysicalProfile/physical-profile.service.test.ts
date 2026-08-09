import { describe, expect, it, vi } from 'vitest';
import type {
  IPhysicalProfileRepository,
  PhysicalProfileRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/PhysicalProfile/physical-profile.repository.interface';
import { PhysicalProfileService } from './physical-profile.service';

const USER_ID = '64b000000000000000000001';

function record(overrides: Partial<PhysicalProfileRecord> = {}): PhysicalProfileRecord {
  return {
    userId: USER_ID,
    heightCm: null,
    shoulderWidthCm: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    inseamCm: null,
    sleeveLengthCm: null,
    bodyShape: null,
    skinTone: null,
    fitPreference: null,
    usualTopSize: null,
    usualBottomSize: null,
    usualOnePieceSize: null,
    usualOuterwearSize: null,
    shoeSize: null,
    shoeSizeSystem: null,
    createdAt: new Date('2026-08-09T05:00:00.000Z'),
    updatedAt: new Date('2026-08-09T06:00:00.000Z'),
    ...overrides,
  };
}

function harness() {
  const repository: IPhysicalProfileRepository = {
    findByUserId: vi.fn().mockResolvedValue(null),
    replace: vi.fn().mockImplementation(async (userId, input) => record({ userId, ...input })),
    delete: vi.fn().mockResolvedValue(false),
    ensureIndexes: vi.fn(),
  };

  return {
    repository,
    service: new PhysicalProfileService(repository),
  };
}

describe('PhysicalProfileService', () => {
  it('returns null when the authenticated user has not created a profile', async () => {
    const { service } = harness();
    await expect(service.get(USER_ID)).resolves.toBeNull();
  });

  it('normalizes size text and fully clears omitted prior facts on replacement', async () => {
    const { service, repository } = harness();

    const result = await service.replace(USER_ID, {
      heightCm: 182.5,
      usualTopSize: '  Large   Tall ',
      fitPreference: 'relaxed',
    });

    expect(repository.replace).toHaveBeenCalledWith(USER_ID, {
      heightCm: 182.5,
      shoulderWidthCm: null,
      chestCm: null,
      waistCm: null,
      hipsCm: null,
      inseamCm: null,
      sleeveLengthCm: null,
      bodyShape: null,
      skinTone: null,
      fitPreference: 'relaxed',
      usualTopSize: 'Large Tall',
      usualBottomSize: null,
      usualOnePieceSize: null,
      usualOuterwearSize: null,
      shoeSize: null,
      shoeSizeSystem: null,
    });
    expect(result.heightCm).toBe(182.5);
    expect(result.usualTopSize).toBe('Large Tall');
    expect(result.waistCm).toBeNull();
    expect(result).not.toHaveProperty('userId');
  });

  it('requires shoe size and size system together as a Core invariant', async () => {
    const { service, repository } = harness();

    await expect(service.replace(USER_ID, {
      shoeSize: '10.5',
    })).rejects.toThrow(/provided together/i);
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it('maps persistence timestamps to public ISO timestamps', async () => {
    const { service, repository } = harness();
    vi.mocked(repository.findByUserId).mockResolvedValueOnce(record({
      heightCm: 180,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-09T06:30:00.000Z'),
    }));

    const result = await service.get(USER_ID);
    expect(result).toMatchObject({
      heightCm: 180,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-09T06:30:00.000Z',
    });
  });

  it('resets the authenticated user profile without exposing deletion state', async () => {
    const { service, repository } = harness();
    await service.reset(USER_ID);
    expect(repository.delete).toHaveBeenCalledWith(USER_ID);
  });
});
