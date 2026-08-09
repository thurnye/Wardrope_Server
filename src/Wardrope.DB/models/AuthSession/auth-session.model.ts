import type { ObjectId } from 'mongodb';

export const AUTH_SESSIONS_COLLECTION = 'authSessions';

export interface AuthSessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  csrfTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}
