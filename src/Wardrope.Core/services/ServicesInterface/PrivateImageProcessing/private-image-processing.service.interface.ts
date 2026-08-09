export interface IncomingPrivateImage {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export interface ProcessedPrivateImage {
  bytes: Uint8Array;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export type PrivateImageValidationReason =
  | 'INVALID_IMAGE'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_DIMENSIONS_EXCEEDED'
  | 'ANIMATED_IMAGE'
  | 'PROCESSED_IMAGE_TOO_LARGE';

export class PrivateImageValidationError extends Error {
  constructor(public readonly reason: PrivateImageValidationReason) {
    super(reason);
    this.name = 'PrivateImageValidationError';
  }
}

export interface IPrivateImageProcessingService {
  processPrivateImage(input: IncomingPrivateImage): Promise<ProcessedPrivateImage>;
}
