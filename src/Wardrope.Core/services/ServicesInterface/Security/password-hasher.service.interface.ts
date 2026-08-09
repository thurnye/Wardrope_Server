export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash?: string): Promise<boolean>;
}
