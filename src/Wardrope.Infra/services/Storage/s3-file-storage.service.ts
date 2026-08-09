import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  IFileStorageService,
  PrivateFileContent,
  StorePrivateFileInput,
  StoredPrivateFile,
} from '../../../Wardrope.Core/services/ServicesInterface/Storage/file-storage.service.interface';

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_EXTENSION = /^[A-Za-z0-9]{1,16}$/;

function assertSafePathSegment(segment: string): string {
  if (!SAFE_PATH_SEGMENT.test(segment)) {
    throw new Error('Invalid private storage path segment.');
  }

  return segment;
}

function assertSafeFileExtension(extension: string): string {
  if (!SAFE_EXTENSION.test(extension)) {
    throw new Error('Invalid private storage file extension.');
  }

  return extension;
}

export interface S3FileStorageOptions {
  region: string;
  bucketName: string;
  rootPrefix: string;
}

export class S3FileStorageService implements IFileStorageService {
  private readonly client: S3Client;

  constructor(private readonly options: S3FileStorageOptions) {
    assertSafePathSegment(options.rootPrefix);
    this.client = new S3Client({
      region: options.region,
      maxAttempts: 3,
    });
  }

  async storePrivateFile(input: StorePrivateFileInput): Promise<StoredPrivateFile> {
    const folder = assertSafePathSegment(input.folder);
    const extension = assertSafeFileExtension(input.fileExtension);
    const objectKey = [
      this.options.rootPrefix,
      folder,
      `${randomUUID()}.${extension}`,
    ].join('/');

    const response = await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucketName,
      Key: objectKey,
      Body: input.body,
      ContentType: input.contentType,
      ServerSideEncryption: 'AES256',
      CacheControl: 'private, no-cache',
    }));

    return {
      objectKey,
      etag: response.ETag ?? null,
    };
  }

  async getPrivateFile(objectKey: string): Promise<PrivateFileContent | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.options.bucketName,
        Key: objectKey,
      }));

      if (!response.Body) {
        return null;
      }

      const bytes = await response.Body.transformToByteArray();
      return {
        body: bytes,
        contentType: response.ContentType ?? 'application/octet-stream',
        contentLength: bytes.byteLength,
        etag: response.ETag ?? null,
        lastModified: response.LastModified ?? null,
      };
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deletePrivateFile(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.options.bucketName,
      Key: objectKey,
    }));
  }

  shutdown(): void {
    this.client.destroy();
  }
}
