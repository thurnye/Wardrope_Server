import { toWardrobeItemDto } from '../../../mappers/Wardrobe/wardrobe.mapper';
import type {
  IWardrobeRepository,
  WardrobeItemRecord,
  WardrobeStoredImageRecord,
} from '../../../../Wardrope.DB/repositories/RepositoryInterface/Wardrobe/wardrobe.repository.interface';
import type { IWardrobeImageRepository } from '../../../../Wardrope.DB/repositories/RepositoryInterface/WardrobeImage/wardrobe-image.repository.interface';
import {
  WardrobeImageValidationError,
  type IImageProcessingService,
} from '../../ServicesInterface/ImageProcessing/image-processing.service.interface';
import type { IApplicationLogger } from '../../ServicesInterface/Logging/application-logger.service.interface';
import type { IFileStorageService } from '../../ServicesInterface/Storage/file-storage.service.interface';
import type {
  IWardrobeImageService,
  ReplaceWardrobeImageInput,
  WardrobeImageMutationResult,
  WardrobeImageReadResult,
} from '../../ServicesInterface/WardrobeImage/wardrobe-image.service.interface';

export class WardrobeImageService implements IWardrobeImageService {
  constructor(
    private readonly wardrobeRepository: IWardrobeRepository,
    private readonly wardrobeImageRepository: IWardrobeImageRepository,
    private readonly imageProcessing: IImageProcessingService,
    private readonly fileStorage: IFileStorageService,
    private readonly logger: IApplicationLogger,
  ) {}

  private async deletePrivateFileBestEffort(
    objectKey: string,
    event: string,
    itemId: string,
  ): Promise<void> {
    try {
      await this.fileStorage.deletePrivateFile(objectKey);
    } catch {
      this.logger.warn(event, { itemId });
    }
  }

  private async resolveCasFailure(
    userId: string,
    itemId: string,
  ): Promise<WardrobeImageMutationResult> {
    try {
      const latest = await this.wardrobeRepository.findById(userId, itemId);
      return latest
        ? { ok: false, reason: 'CONFLICT' }
        : { ok: false, reason: 'NOT_FOUND' };
    } catch {
      this.logger.error('wardrobe_image_cas_resolution_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
  }

  async replace(
    userId: string,
    itemId: string,
    input: ReplaceWardrobeImageInput,
  ): Promise<WardrobeImageMutationResult> {
    let current: WardrobeItemRecord | null;

    try {
      current = await this.wardrobeRepository.findById(userId, itemId);
    } catch {
      this.logger.error('wardrobe_image_item_lookup_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!current) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    let processed;
    try {
      processed = await this.imageProcessing.processWardrobeImage(input);
    } catch (error) {
      if (error instanceof WardrobeImageValidationError) {
        return {
          ok: false,
          reason: 'INVALID_IMAGE',
          validationReason: error.reason,
        };
      }

      this.logger.error('wardrobe_image_processing_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    let stored;
    try {
      stored = await this.fileStorage.storePrivateFile({
        body: processed.bytes,
        contentType: processed.contentType,
        fileExtension: 'webp',
        pathSegments: ['clothes', userId, itemId],
      });
    } catch {
      this.logger.error('wardrobe_image_store_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    const image: WardrobeStoredImageRecord = {
      objectKey: stored.objectKey,
      etag: stored.etag,
      contentType: processed.contentType,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
      updatedAt: new Date(),
    };

    let updated: WardrobeItemRecord | null;
    try {
      updated = await this.wardrobeImageRepository.replaceImage(
        userId,
        itemId,
        current.image?.objectKey ?? null,
        image,
      );
    } catch {
      await this.deletePrivateFileBestEffort(
        stored.objectKey,
        'wardrobe_image_compensation_after_persistence_failure_failed',
        itemId,
      );
      this.logger.error('wardrobe_image_persistence_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!updated) {
      await this.deletePrivateFileBestEffort(
        stored.objectKey,
        'wardrobe_image_compensation_after_conflict_failed',
        itemId,
      );
      return this.resolveCasFailure(userId, itemId);
    }

    if (current.image) {
      await this.deletePrivateFileBestEffort(
        current.image.objectKey,
        'wardrobe_image_previous_object_cleanup_failed',
        itemId,
      );
    }

    return { ok: true, item: toWardrobeItemDto(updated) };
  }

  async read(userId: string, itemId: string): Promise<WardrobeImageReadResult> {
    let item: WardrobeItemRecord | null;

    try {
      item = await this.wardrobeRepository.findById(userId, itemId);
    } catch {
      this.logger.error('wardrobe_image_read_item_lookup_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!item?.image) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    try {
      const image = await this.fileStorage.getPrivateFile(item.image.objectKey);

      if (!image) {
        this.logger.error('wardrobe_image_object_missing', { itemId });
        return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
      }

      return { ok: true, image };
    } catch {
      this.logger.error('wardrobe_image_read_storage_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }
  }

  async remove(userId: string, itemId: string): Promise<WardrobeImageMutationResult> {
    let current: WardrobeItemRecord | null;

    try {
      current = await this.wardrobeRepository.findById(userId, itemId);
    } catch {
      this.logger.error('wardrobe_image_remove_item_lookup_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!current) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    if (!current.image) {
      return { ok: true, item: toWardrobeItemDto(current) };
    }

    let updated: WardrobeItemRecord | null;
    try {
      updated = await this.wardrobeImageRepository.clearImage(
        userId,
        itemId,
        current.image.objectKey,
      );
    } catch {
      this.logger.error('wardrobe_image_remove_persistence_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!updated) {
      return this.resolveCasFailure(userId, itemId);
    }

    await this.deletePrivateFileBestEffort(
      current.image.objectKey,
      'wardrobe_image_removed_object_cleanup_failed',
      itemId,
    );

    return { ok: true, item: toWardrobeItemDto(updated) };
  }
}
