import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { WardrobeImageValidationError } from '../../../Wardrope.Core/services/ServicesInterface/ImageProcessing/image-processing.service.interface';
import { SharpImageProcessingService } from './sharp-image-processing.service';

async function png(width = 1200, height = 1600): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#d6d0c8',
    },
  })
    .png()
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe('SharpImageProcessingService', () => {
  const service = new SharpImageProcessingService();

  it('detects the real file type and emits bounded metadata-free WebP', async () => {
    const source = await png();
    const result = await service.processWardrobeImage({
      bytes: source,
      declaredContentType: 'application/octet-stream',
    });

    expect(result.contentType).toBe('image/webp');
    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.height).toBeLessThanOrEqual(2048);
    expect(result.sizeBytes).toBe(result.bytes.byteLength);

    const metadata = await sharp(Buffer.from(result.bytes)).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('rejects arbitrary bytes even when the declared MIME claims image/jpeg', async () => {
    await expect(service.processWardrobeImage({
      bytes: Buffer.from('<script>alert(1)</script>'),
      declaredContentType: 'image/jpeg',
    })).rejects.toMatchObject<Partial<WardrobeImageValidationError>>({
      reason: 'INVALID_IMAGE',
    });
  });

  it('rejects images exceeding the input dimension policy', async () => {
    const source = await png(8001, 1);

    await expect(service.processWardrobeImage({
      bytes: source,
      declaredContentType: 'image/png',
    })).rejects.toMatchObject<Partial<WardrobeImageValidationError>>({
      reason: 'IMAGE_DIMENSIONS_EXCEEDED',
    });
  });

  it('rejects empty input before invoking the decoder', async () => {
    await expect(service.processWardrobeImage({
      bytes: new Uint8Array(),
      declaredContentType: null,
    })).rejects.toMatchObject<Partial<WardrobeImageValidationError>>({
      reason: 'INVALID_IMAGE',
    });
  });
});
