import { toFragranceDto } from '../../../mappers/Fragrance/fragrance.mapper';
import type {
  FragranceRecord,
  FragranceStoredImageRecord,
  IFragranceRepository,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Fragrance/fragrance.repository.interface';
import {
  PrivateImageValidationError,
  type IPrivateImageProcessingService,
} from '../../ServicesInterface/PrivateImageProcessing/private-image-processing.service.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import type {
  FragranceImageMutationResult,
  FragranceImageReadResult,
  IFragranceImageService,
  ReplaceFragranceImageInput,
} from '../../ServicesInterface/FragranceImage/fragrance-image.service.interface';

export class FragranceImageService implements IFragranceImageService {
  constructor(
    private readonly fragranceRepository: IFragranceRepository,
    private readonly imageProcessing: IPrivateImageProcessingService,
    private readonly fileStorage: IFileStorageService,
    private readonly logger: IApplicationLogger,
  ) {}

  private async deleteBestEffort(objectKey: string, event: string, fragranceId: string): Promise<void> {
    try {
      await this.fileStorage.deletePrivateFile(objectKey);
    } catch {
      this.logger.warn(event, { fragranceId });
    }
  }

  private async resolveCasFailure(userId: string, fragranceId: string): Promise<FragranceImageMutationResult> {
    try {
      return await this.fragranceRepository.findById(userId, fragranceId)
        ? { ok: false, reason: 'CONFLICT' }
        : { ok: false, reason: 'NOT_FOUND' };
    } catch {
      this.logger.error('fragrance_image_cas_resolution_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
  }

  async replace(
    userId: string,
    fragranceId: string,
    input: ReplaceFragranceImageInput,
  ): Promise<FragranceImageMutationResult> {
    let current: FragranceRecord | null;
    try {
      current = await this.fragranceRepository.findById(userId, fragranceId);
    } catch {
      this.logger.error('fragrance_image_lookup_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
    if (!current) return { ok: false, reason: 'NOT_FOUND' };

    let processed;
    try {
      processed = await this.imageProcessing.processPrivateImage(input);
    } catch (error) {
      if (error instanceof PrivateImageValidationError) {
        return { ok: false, reason: 'INVALID_IMAGE', validationReason: error.reason };
      }
      this.logger.error('fragrance_image_processing_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    let stored;
    try {
      stored = await this.fileStorage.storePrivateFile({
        body: processed.bytes,
        contentType: processed.contentType,
        fileExtension: 'webp',
        pathSegments: ['Frangrances'],
      });
    } catch {
      this.logger.error('fragrance_image_store_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    const image: FragranceStoredImageRecord = {
      objectKey: stored.objectKey,
      etag: stored.etag,
      contentType: processed.contentType,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      updatedAt: new Date(),
    };

    let updated: FragranceRecord | null;
    try {
      updated = await this.fragranceRepository.replaceImage(
        userId,
        fragranceId,
        current.image?.objectKey ?? null,
        image,
      );
    } catch {
      await this.deleteBestEffort(stored.objectKey, 'fragrance_image_compensation_failed', fragranceId);
      this.logger.error('fragrance_image_persistence_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!updated) {
      await this.deleteBestEffort(stored.objectKey, 'fragrance_image_conflict_compensation_failed', fragranceId);
      return this.resolveCasFailure(userId, fragranceId);
    }

    if (current.image) {
      await this.deleteBestEffort(current.image.objectKey, 'fragrance_image_previous_cleanup_failed', fragranceId);
    }

    return { ok: true, fragrance: toFragranceDto(updated) };
  }

  async read(userId: string, fragranceId: string): Promise<FragranceImageReadResult> {
    let fragrance: FragranceRecord | null;
    try {
      fragrance = await this.fragranceRepository.findById(userId, fragranceId);
    } catch {
      this.logger.error('fragrance_image_read_lookup_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
    if (!fragrance?.image) return { ok: false, reason: 'NOT_FOUND' };

    try {
      const image = await this.fileStorage.getPrivateFile(fragrance.image.objectKey);
      if (!image) {
        this.logger.error('fragrance_image_object_missing', { fragranceId });
        return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
      }
      return { ok: true, image };
    } catch {
      this.logger.error('fragrance_image_read_storage_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
  }

  async remove(userId: string, fragranceId: string): Promise<FragranceImageMutationResult> {
    let current: FragranceRecord | null;
    try {
      current = await this.fragranceRepository.findById(userId, fragranceId);
    } catch {
      this.logger.error('fragrance_image_remove_lookup_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
    if (!current) return { ok: false, reason: 'NOT_FOUND' };
    if (!current.image) return { ok: true, fragrance: toFragranceDto(current) };

    let updated: FragranceRecord | null;
    try {
      updated = await this.fragranceRepository.clearImage(
        userId,
        fragranceId,
        current.image.objectKey,
      );
    } catch {
      this.logger.error('fragrance_image_remove_persistence_failed', { fragranceId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
    if (!updated) return this.resolveCasFailure(userId, fragranceId);

    await this.deleteBestEffort(current.image.objectKey, 'fragrance_image_remove_cleanup_failed', fragranceId);
    return { ok: true, fragrance: toFragranceDto(updated) };
  }
}
