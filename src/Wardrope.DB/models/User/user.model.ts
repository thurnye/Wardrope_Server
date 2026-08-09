import type { ObjectId } from 'mongodb';

export const USERS_COLLECTION = 'users';

export interface UserDocument {
  _id: ObjectId;
  email: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
