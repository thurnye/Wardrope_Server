import sharp from 'sharp';
import {
  WardrobeImageValidationError,
  type IImageProcessingService,
  type IncomingWardrobeImage,
  type ProcessedWardrobeImage,
} from '../../../Wardrope.Core/services/ServicesInterface/ImageProcessing/image-processing.service.interface';

const MAX_RAW_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_DIMENSION = 8_000;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_OUTPUT_DIMENSION = 2_048;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isPixelLimitError(error: unknown): boolean {
  return error instanceof Error && /pixel limit|input image exceeds/i.test(error.message);
}

export class SharpImageProcessingService implements IImageProcessingService {
  async processWardrobeImage(input: IncomingWardrobeImage): Promise<ProcessedWardrobeImage> {
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_RAW_BYTES) {
      throw new WardrobeImageValidationError('INVALID_IMAGE');
    }

    const buffer = Buffer.from(input.bytes);
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);

    if (!detected) {
      throw new WardrobeImageValidationError('INVALID_IMAGE');
    }

    if (!SUPPORTED_MIME_TYPES.has(detected.mime)) {
      throw new WardrobeImageValidationError('UNSUPPORTED_IMAGE_TYPE');
    }

    let metadata;
    try {
      metadata = await sharp(buffer, {
        animated: true,
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
    } catch (error) {
      throw new WardrobeImageValidationError(
        isPixelLimitError(error) ? 'IMAGE_DIMENSIONS_EXCEEDED' : 'INVALID_IMAGE',
      );
    }

    if (!metadata.width || !metadata.height) {
      throw new WardrobeImageValidationError('INVALID_IMAGE');
    }

    if (
      metadata.width > MAX_INPUT_DIMENSION
      || metadata.height > MAX_INPUT_DIMENSION
      || metadata.width * metadata.height > MAX_INPUT_PIXELS
    ) {
      throw new WardrobeImageValidationError('IMAGE_DIMENSIONS_EXCEEDED');
    }

    if ((metadata.pages ?? 1) > 1) {
      throw new WardrobeImageValidationError('ANIMATED_IMAGE');
    }

    let output;
    try {
      output = await sharp(buffer, {
        animated: false,
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: MAX_OUTPUT_DIMENSION,
          height: MAX_OUTPUT_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 86,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new WardrobeImageValidationError('INVALID_IMAGE');
    }

    if (output.data.byteLength > MAX_OUTPUT_BYTES) {
      throw new WardrobeImageValidationError('PROCESSED_IMAGE_TOO_LARGE');
    }

    return {
      bytes: output.data,
      contentType: 'image/webp',
      width: output.info.width,
      height: output.info.height,
      sizeBytes: output.data.byteLength,
    };
  }
}
