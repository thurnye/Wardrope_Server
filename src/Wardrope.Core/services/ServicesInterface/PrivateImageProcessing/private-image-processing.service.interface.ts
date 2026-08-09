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

export interface IPrivateImageProcessingService {
  processPrivateImage(input: IncomingPrivateImage): Promise<ProcessedPrivateImage>;
}
