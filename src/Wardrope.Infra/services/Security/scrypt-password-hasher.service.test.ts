import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.service';

describe('ScryptPasswordHasher', () => {
  it('creates a salted hash and verifies the original password', async () => {
    const hasher = new ScryptPasswordHasher();
    const password = 'a-long-wardrope-passphrase';

    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(first).not.toContain(password);
    expect(second).not.toBe(first);
    await expect(hasher.verify(password, first)).resolves.toBe(true);
    await expect(hasher.verify('wrong-password', first)).resolves.toBe(false);
  });

  it('performs the dummy verification path for a missing account hash', async () => {
    const hasher = new ScryptPasswordHasher();
    await expect(hasher.verify('any-password')).resolves.toBe(false);
  });

  it('rejects malformed or unsafe encoded hashes', async () => {
    const hasher = new ScryptPasswordHasher();
    await expect(hasher.verify('password', 'scrypt$999999999$8$1$salt$hash')).resolves.toBe(false);
    await expect(hasher.verify('password', 'not-a-password-hash')).resolves.toBe(false);
  });
});
