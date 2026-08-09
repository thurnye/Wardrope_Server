import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { IPasswordHasher } from '../../../Wardrope.Core/services/ServicesInterface/Security/password-hasher.service.interface';

const DEFAULT_N = 32_768;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$O6IXwFp19H55kDOpYo-hYWaDLukV_d0PXBz-ba-tGq7l2f2FECKSy8vNYFeYCfFWeU2_okFOpOtFJBnf744Ngw';

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function parseHash(encodedHash: string): ParsedHash | null {
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw, ...extra] = encodedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    !nRaw ||
    !rRaw ||
    !pRaw ||
    !saltRaw ||
    !hashRaw ||
    extra.length > 0
  ) {
    return null;
  }

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 2 ||
    n > 131_072 ||
    (n & (n - 1)) !== 0 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 8
  ) {
    return null;
  }

  try {
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(hashRaw, 'base64url');

    if (salt.length < 16 || expected.length < 32 || expected.length > 128) {
      return null;
    }

    return { n, r, p, salt, expected };
  } catch {
    return null;
  }
}

export class ScryptPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await deriveKey(password, salt, KEY_LENGTH, {
      N: DEFAULT_N,
      r: DEFAULT_R,
      p: DEFAULT_P,
      maxmem: MAX_MEMORY_BYTES,
    });

    return [
      'scrypt',
      DEFAULT_N,
      DEFAULT_R,
      DEFAULT_P,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash?: string): Promise<boolean> {
    const parsed = parseHash(encodedHash || DUMMY_HASH);

    if (!parsed) {
      await this.verify(password, DUMMY_HASH);
      return false;
    }

    const derived = await deriveKey(password, parsed.salt, parsed.expected.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
      maxmem: MAX_MEMORY_BYTES,
    });
    const matches = timingSafeEqual(derived, parsed.expected);

    return encodedHash ? matches : false;
  }
}
