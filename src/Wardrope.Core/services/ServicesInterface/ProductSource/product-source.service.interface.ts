export type ProductSourceFailureReason =
  | 'URL_NOT_ALLOWED'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_TOO_LARGE'
  | 'UNSUPPORTED_CONTENT'
  | 'PRODUCT_NOT_RECOGNIZED'
  | 'IMAGE_NOT_FOUND';

export class ProductSourceError extends Error {
  constructor(
    public readonly reason: ProductSourceFailureReason,
    message: string,
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
  imageUrl: string | null;
}

export interface DownloadedProductImage {
  bytes: Uint8Array;
  declaredContentType: string | null;
}

export interface IProductSourceService {
  inspect(sourceUrl: string): Promise<ProductSourceSnapshot>;
  downloadPrimaryImage(sourceUrl: string): Promise<DownloadedProductImage>;
}
