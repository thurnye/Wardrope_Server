export interface IncomingWardrobeImage {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export interface ProcessedWardrobeImage {
  bytes: Uint8Array;
  contentType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
}

export type WardrobeImageValidationReason =
  | 'INVALID_IMAGE'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_DIMENSIONS_EXCEEDED'
  | 'ANIMATED_IMAGE'
  | 'PROCESSED_IMAGE_TOO_LARGE';

export class WardrobeImageValidationError extends Error {
  constructor(public readonly reason: WardrobeImageValidationReason) {
    super(reason);
    this.name = 'WardrobeImageValidationError';
  }
}

export interface IImageProcessingService {
  processWardrobeImage(input: IncomingWardrobeImage): Promise<ProcessedWardrobeImage>;
}
