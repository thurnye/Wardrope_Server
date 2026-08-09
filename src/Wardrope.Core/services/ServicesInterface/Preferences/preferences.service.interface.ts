import type {
  PreferencesDto,
  ReplacePreferencesDto,
} from '../../../Models/Preferences/preferences.model';

export interface IPreferencesService {
  get(userId: string): Promise<PreferencesDto | null>;
  replace(userId: string, input: ReplacePreferencesDto): Promise<PreferencesDto>;
  reset(userId: string): Promise<void>;
}
