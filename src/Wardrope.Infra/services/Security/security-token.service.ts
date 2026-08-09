import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ISecurityTokenService } from '../../../Wardrope.Core/services/ServicesInterface/Security/security-token.service.interface';

const TOKEN_BYTES = 32;
const SHA256_HEX_LENGTH = 64;

export class SecurityTokenService implements ISecurityTokenService {
  generateToken(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  verifyToken(token: string, expectedHash: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(expectedHash) || expectedHash.length !== SHA256_HEX_LENGTH) {
      return false;
    }

    const actual = Buffer.from(this.hashToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
