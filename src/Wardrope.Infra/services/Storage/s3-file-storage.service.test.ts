import { describe, expect, it } from 'vitest';
import { S3FileStorageService } from './s3-file-storage.service';

describe('S3FileStorageService configuration', () => {
  it('rejects an unsafe root prefix before creating the S3 client', () => {
    expect(() => new S3FileStorageService({
      region: 'ca-central-1',
      bucketName: 'private-bucket',
      rootPrefix: '../Wardrope',
    })).toThrow('Invalid private storage path segment.');
  });
});
