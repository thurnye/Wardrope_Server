import { MongoServerError, ObjectId } from 'mongodb';
import type { MongoDatabaseConnection } from '../../../connection/mongo-database.connection';
import {
  AUTH_SESSIONS_COLLECTION,
  type AuthSessionDocument,
} from '../../../models/AuthSession/auth-session.model';
import { USERS_COLLECTION, type UserDocument } from '../../../models/User/user.model';
import type {
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthSessionInput,
  CreateAuthUserInput,
  IAuthRepository,
} from '../../RepositoryInterface/Auth/auth.repository.interface';

function mapUser(document: UserDocument): AuthUserRecord {
  return {
    id: document._id.toHexString(),
    email: document.email,
    emailNormalized: document.emailNormalized,
    displayName: document.displayName,
    passwordHash: document.passwordHash,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function mapSession(document: AuthSessionDocument): AuthSessionRecord {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    tokenHash: document.tokenHash,
    csrfTokenHash: document.csrfTokenHash,
    createdAt: document.createdAt,
    expiresAt: document.expiresAt,
  };
}

function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly database: MongoDatabaseConnection) {}

  private get users() {
    return this.database.getDatabase().collection<UserDocument>(USERS_COLLECTION);
  }

  private get sessions() {
    return this.database
      .getDatabase()
      .collection<AuthSessionDocument>(AUTH_SESSIONS_COLLECTION);
  }

  async findUserByNormalizedEmail(emailNormalized: string): Promise<AuthUserRecord | null> {
    const user = await this.users.findOne({ emailNormalized });
    return user ? mapUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const _id = parseObjectId(userId);

    if (!_id) {
      return null;
    }

    const user = await this.users.findOne({ _id });
    return user ? mapUser(user) : null;
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord | null> {
    const now = new Date();
    const document: UserDocument = {
      _id: new ObjectId(),
      email: input.email,
      emailNormalized: input.emailNormalized,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.users.insertOne(document);
      return mapUser(document);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return null;
      }

      throw error;
    }
  }

  async createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    const userId = parseObjectId(input.userId);

    if (!userId) {
      throw new Error('Cannot create an auth session for an invalid user identifier.');
    }

    const document: AuthSessionDocument = {
      _id: new ObjectId(),
      userId,
      tokenHash: input.tokenHash,
      csrfTokenHash: input.csrfTokenHash,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    };

    await this.sessions.insertOne(document);
    return mapSession(document);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = await this.sessions.findOne({ tokenHash });
    return session ? mapSession(session) : null;
  }

  async rotateCsrfToken(sessionId: string, csrfTokenHash: string): Promise<boolean> {
    const _id = parseObjectId(sessionId);

    if (!_id) {
      return false;
    }

    const result = await this.sessions.updateOne(
      { _id },
      { $set: { csrfTokenHash } },
    );

    return result.matchedCount === 1;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const _id = parseObjectId(sessionId);

    if (!_id) {
      return;
    }

    await this.sessions.deleteOne({ _id });
  }

  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.users.createIndex({ emailNormalized: 1 }, { unique: true, name: 'uq_users_email_normalized' }),
      this.sessions.createIndex({ tokenHash: 1 }, { unique: true, name: 'uq_auth_sessions_token_hash' }),
      this.sessions.createIndex({ userId: 1 }, { name: 'ix_auth_sessions_user_id' }),
      this.sessions.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: 'ttl_auth_sessions_expires_at' },
      ),
    ]);
  }
}
