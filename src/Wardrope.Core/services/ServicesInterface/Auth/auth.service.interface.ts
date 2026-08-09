import type {
  AuthenticatedRequestContext,
  CreatedSession,
  LoginRequestDto,
  RegisterRequestDto,
  RegisteredUserDto,
  SessionStatusDto,
} from '../../../Models/Auth/auth.model';

export type RegisterResult =
  | { ok: true; value: RegisteredUserDto }
  | { ok: false; reason: 'EMAIL_UNAVAILABLE' };

export type LoginResult =
  | { ok: true; value: CreatedSession }
  | { ok: false; reason: 'INVALID_CREDENTIALS' };

export interface IAuthService {
  register(request: RegisterRequestDto): Promise<RegisterResult>;
  login(request: LoginRequestDto): Promise<LoginResult>;
  getSession(sessionToken?: string, csrfToken?: string): Promise<SessionStatusDto>;
  authenticate(sessionToken?: string): Promise<AuthenticatedRequestContext | null>;
  verifyCsrf(context: AuthenticatedRequestContext, csrfToken?: string): boolean;
  logout(sessionId: string): Promise<void>;
}
