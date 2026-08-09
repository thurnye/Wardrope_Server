import type {
  PhysicalProfileDto,
  ReplacePhysicalProfileDto,
} from '../../../Models/PhysicalProfile/physical-profile.model';

export interface IPhysicalProfileService {
  get(userId: string): Promise<PhysicalProfileDto | null>;
  replace(userId: string, input: ReplacePhysicalProfileDto): Promise<PhysicalProfileDto>;
  reset(userId: string): Promise<void>;
}
