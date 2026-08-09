export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface PublicUserDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface RegisteredUserDto {
  user: PublicUserDto;
}

export interface AuthenticatedSessionDto {
  authenticated: true;
  user: PublicUserDto;
  csrfToken: string;
  expiresAt: string;
}

export interface AnonymousSessionDto {
  authenticated: false;
}

export type SessionStatusDto = AuthenticatedSessionDto | AnonymousSessionDto;

export interface CreatedSession {
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
  user: PublicUserDto;
}

export interface AuthenticatedRequestContext {
  sessionId: string;
  csrfTokenHash: string;
  expiresAt: Date;
  user: PublicUserDto;
}
