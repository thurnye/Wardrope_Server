export interface ISecurityTokenService {
  generateToken(): string;
  hashToken(token: string): string;
  verifyToken(token: string, expectedHash: string): boolean;
}
