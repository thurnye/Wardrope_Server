export interface StorePrivateFileInput {
  body: Uint8Array;
  contentType: string;
  fileExtension: string;
  pathSegments: readonly string[];
}

export interface StoredPrivateFile {
  objectKey: string;
  etag: string | null;
}

export interface PrivateFileContent {
  body: Uint8Array;
  contentType: string;
  contentLength: number;
  etag: string | null;
  lastModified: Date | null;
}

export interface IFileStorageService {
  storePrivateFile(input: StorePrivateFileInput): Promise<StoredPrivateFile>;
  getPrivateFile(objectKey: string): Promise<PrivateFileContent | null>;
  deletePrivateFile(objectKey: string): Promise<void>;
  shutdown(): void;
}
