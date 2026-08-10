export type ProductSourceFailureReason =
  | 'URL_NOT_ALLOWED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_TOO_LARGE'
  | 'UNSUPPORTED_CONTENT'
  | 'PRODUCT_NOT_RECOGNIZED'
  | 'IMAGE_NOT_FOUND';

export interface ProductSourceErrorMetadata {
  statusCode?: number;
  remoteBlocked?: boolean;
}

export class ProductSourceError extends Error {
  constructor(
    public readonly reason: ProductSourceFailureReason,
    message: string,
    public readonly metadata?: ProductSourceErrorMetadata,
  ) {
    super(message);
    this.name = 'ProductSourceError';
  }
}

export interface ProductSourceSnapshot {
  sourceUrl: string;
  name: string | null;
  brand: string | null;
  colors: string[];
  materials: string[];
  categoryHint: string | null;
  imageUrls: string[];
  fragranceDetails?: {
    fragranceFamily: string | null;
    scentType: string | null;
    keyNotes: string[];
    bottleSizeMl: number | null;
    price: number | null;
    currency: string | null;
  } | undefined;
}

export interface DownloadedProductImage {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export interface IProductSourceService {
  inspect(sourceUrl: string): Promise<ProductSourceSnapshot>;
  downloadPrimaryImage(
    sourceUrl: string,
    imageUrl?: string,
  ): Promise<DownloadedProductImage>;
}
