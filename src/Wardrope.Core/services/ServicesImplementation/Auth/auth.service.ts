import type {
  AuthenticatedRequestContext,
  CreatedSession,
  LoginRequestDto,
  PublicUserDto,
  RegisterRequestDto,
  SessionStatusDto,
} from '../../../Models/Auth/auth.model';
import type { IAuthRepository, AuthUserRecord } from '../../../../Wardrope.DB/repositories/RepositoryInterface/Auth/auth.repository.interface';
import type { IPasswordHasher } from '../../ServicesInterface/Security/password-hasher.service.interface';
import type { ISecurityTokenService } from '../../ServicesInterface/Security/security-token.service.interface';
import type {
  IAuthService,
  LoginResult,
  RegisterResult,
} from '../../ServicesInterface/Auth/auth.service.interface';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: AuthUserRecord): PublicUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export class AuthService implements IAuthService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ISecurityTokenService,
    private readonly sessionTtlMs: number,
  ) {}

  async register(request: RegisterRequestDto): Promise<RegisterResult> {
    const emailNormalized = normalizeEmail(request.email);
    const existingUser = await this.authRepository.findUserByNormalizedEmail(emailNormalized);

    if (existingUser) {
      return { ok: false, reason: 'EMAIL_UNAVAILABLE' };
    }

    const passwordHash = await this.passwordHasher.hash(request.password);
    const user = await this.authRepository.createUser({
      email: request.email.trim(),
      emailNormalized,
      displayName: request.displayName.trim(),
      passwordHash,
    });

    if (!user) {
      return { ok: false, reason: 'EMAIL_UNAVAILABLE' };
    }

    return {
      ok: true,
      value: {
        user: toPublicUser(user),
      },
    };
  }

  async login(request: LoginRequestDto): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(request.email);
    const user = await this.authRepository.findUserByNormalizedEmail(emailNormalized);
    const passwordMatches = await this.passwordHasher.verify(request.password, user?.passwordHash);

    if (!user || !passwordMatches) {
      return { ok: false, reason: 'INVALID_CREDENTIALS' };
    }

    const sessionToken = this.tokenService.generateToken();
    const csrfToken = this.tokenService.generateToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    const session = await this.authRepository.createSession({
      userId: user.id,
      tokenHash: this.tokenService.hashToken(sessionToken),
      csrfTokenHash: this.tokenService.hashToken(csrfToken),
      expiresAt,
    });

    const value: CreatedSession = {
      sessionId: session.id,
      sessionToken,
      csrfToken,
      expiresAt,
      user: toPublicUser(user),
    };

    return { ok: true, value };
  }

  async getSession(sessionToken?: string): Promise<SessionStatusDto> {
    const context = await this.authenticate(sessionToken);

    if (!context) {
      return { authenticated: false };
    }

    const csrfToken = this.tokenService.generateToken();
    const rotated = await this.authRepository.rotateCsrfToken(
      context.sessionId,
      this.tokenService.hashToken(csrfToken),
    );

    if (!rotated) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      user: context.user,
      csrfToken,
      expiresAt: context.expiresAt.toISOString(),
    };
  }

  async authenticate(sessionToken?: string): Promise<AuthenticatedRequestContext | null> {
    if (!sessionToken) {
      return null;
    }

    const session = await this.authRepository.findSessionByTokenHash(
      this.tokenService.hashToken(sessionToken),
    );

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.authRepository.deleteSession(session.id);
      return null;
    }

    const user = await this.authRepository.findUserById(session.userId);

    if (!user) {
      await this.authRepository.deleteSession(session.id);
      return null;
    }

    return {
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
      expiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  }

  verifyCsrf(context: AuthenticatedRequestContext, csrfToken?: string): boolean {
    if (!csrfToken) {
      return false;
    }

    return this.tokenService.verifyToken(csrfToken, context.csrfTokenHash);
  }

  async logout(sessionId: string): Promise<void> {
    await this.authRepository.deleteSession(sessionId);
  }
}
