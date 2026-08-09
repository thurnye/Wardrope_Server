export interface AuthUserRecord {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAuthUserInput {
  email: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateAuthSessionInput {
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
}

export interface IAuthRepository {
  findUserByNormalizedEmail(emailNormalized: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord | null>;
  createSession(input: CreateAuthSessionInput): Promise<AuthSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  rotateCsrfToken(sessionId: string, csrfTokenHash: string): Promise<boolean>;
  deleteSession(sessionId: string): Promise<void>;
  ensureIndexes(): Promise<void>;
}
