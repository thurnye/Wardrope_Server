import type { ObjectId } from 'mongodb';
import type {
  AccessoryLevel,
  ExperimentationLevel,
  LayeringLevel,
  PatternLevel,
  RepeatPreference,
  StyleAesthetic,
} from '../../../Wardrope.Core/Models/Preferences/preferences.model';

export const PREFERENCES_COLLECTION = 'preferences';

export interface PreferencesDocument {
  _id: ObjectId;
  userId: ObjectId;
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
