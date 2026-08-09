import type {
  AccessoryLevel,
  ExperimentationLevel,
  LayeringLevel,
  PatternLevel,
  RepeatPreference,
  StyleAesthetic,
} from '../../../../Wardrope.Core/Models/Preferences/preferences.model';

export interface PreferencesRecord {
  userId: string;
  preferredAesthetics: StyleAesthetic[];
  avoidedAesthetics: StyleAesthetic[];
  preferredColors: string[];
  avoidedColors: string[];
  experimentationLevel: ExperimentationLevel | null;
  accessoryLevel: AccessoryLevel | null;
  patternLevel: PatternLevel | null;
  layeringLevel: LayeringLevel | null;
  repeatPreference: RepeatPreference | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReplacePreferencesRecord = Omit<
  PreferencesRecord,
  'userId' | 'createdAt' | 'updatedAt'
>;

export interface IPreferencesRepository {
  findByUserId(userId: string): Promise<PreferencesRecord | null>;
  replace(userId: string, input: ReplacePreferencesRecord): Promise<PreferencesRecord>;
  delete(userId: string): Promise<boolean>;
  ensureIndexes(): Promise<void>;
}
