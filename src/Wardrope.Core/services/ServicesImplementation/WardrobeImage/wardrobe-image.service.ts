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

function storageFolderForCategory(category: WardrobeItemRecord['category']): string {
  switch (category) {
    case 'footwear':
      return 'Footware';
    case 'bag':
    case 'accessory':
    case 'jewelry':
      return 'accessories';
    case 'top':
    case 'bottom':
    case 'one-piece':
    case 'outerwear':
      return 'clothings';
  }
}

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
    return this.replaceMany(userId, itemId, [input]);
  }

  async replaceMany(
    userId: string,
    itemId: string,
    inputs: ReplaceWardrobeImageInput[],
  ): Promise<WardrobeImageMutationResult> {
    if (inputs.length === 0 || inputs.length > 8) {
      return { ok: false, reason: 'INVALID_IMAGE', validationReason: 'INVALID_IMAGE_COUNT' };
    }
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

    const processedImages: Array<Awaited<ReturnType<IImageProcessingService['processWardrobeImage']>>> = [];
    try {
      for (const input of inputs) {
        processedImages.push(await this.imageProcessing.processWardrobeImage(input));
      }
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

    const storedFiles = [];
    try {
      for (const processed of processedImages) {
        storedFiles.push(await this.fileStorage.storePrivateFile({
          body: processed.bytes,
          contentType: processed.contentType,
          fileExtension: 'webp',
          pathSegments: [storageFolderForCategory(current.category)],
        }));
      }
    } catch {
      await Promise.all(storedFiles.map((stored) => this.deletePrivateFileBestEffort(
        stored.objectKey,
        'wardrobe_image_compensation_after_store_failure_failed',
        itemId,
      )));
      this.logger.error('wardrobe_image_store_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    const images: WardrobeStoredImageRecord[] = storedFiles.map((stored, index) => {
      const processed = processedImages[index]!;
      return {
        objectKey: stored.objectKey,
        etag: stored.etag,
        contentType: processed.contentType,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        updatedAt: new Date(),
      };
    });
    const previousImages = current.images;

    let updated: WardrobeItemRecord | null;
    try {
      if (!this.wardrobeImageRepository.replaceImages) {
        if (images.length !== 1) throw new Error('Multiple image persistence is unavailable.');
        updated = await this.wardrobeImageRepository.replaceImage(
          userId, itemId, previousImages[0]?.objectKey ?? null, images[0]!,
        );
      } else updated = await this.wardrobeImageRepository.replaceImages(
        userId,
        itemId,
        previousImages.map((image) => image.objectKey),
        images,
      );
    } catch {
      await Promise.all(storedFiles.map((stored) => this.deletePrivateFileBestEffort(
        stored.objectKey,
        'wardrobe_image_compensation_after_persistence_failure_failed',
        itemId,
      )));
      this.logger.error('wardrobe_image_persistence_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!updated) {
      await Promise.all(storedFiles.map((stored) => this.deletePrivateFileBestEffort(
        stored.objectKey,
        'wardrobe_image_compensation_after_conflict_failed',
        itemId,
      )));
      return this.resolveCasFailure(userId, itemId);
    }

    await Promise.all(previousImages.map((image) => this.deletePrivateFileBestEffort(
        image.objectKey,
        'wardrobe_image_previous_object_cleanup_failed',
        itemId,
      )));

    return { ok: true, item: toWardrobeItemDto(updated) };
  }

  async read(userId: string, itemId: string, imageIndex = 0): Promise<WardrobeImageReadResult> {
    let item: WardrobeItemRecord | null;

    try {
      item = await this.wardrobeRepository.findById(userId, itemId);
    } catch {
      this.logger.error('wardrobe_image_read_item_lookup_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    const images = item?.images ?? [];
    const selectedImage = images[imageIndex];
    if (!selectedImage) {
      return { ok: false, reason: 'NOT_FOUND' };
    }

    try {
      const image = await this.fileStorage.getPrivateFile(selectedImage.objectKey);

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

    const currentImages = current.images;
    if (currentImages.length === 0) {
      return { ok: true, item: toWardrobeItemDto(current) };
    }

    let updated: WardrobeItemRecord | null;
    try {
      updated = await this.wardrobeImageRepository.clearImage(
        userId,
        itemId,
        currentImages[0]!.objectKey,
      );
    } catch {
      this.logger.error('wardrobe_image_remove_persistence_failed', { itemId });
      return { ok: false, reason: 'STORAGE_UNAVAILABLE' };
    }

    if (!updated) {
      return this.resolveCasFailure(userId, itemId);
    }

    await Promise.all(currentImages.map((image) => this.deletePrivateFileBestEffort(
      image.objectKey,
      'wardrobe_image_removed_object_cleanup_failed',
      itemId,
    )));

    return { ok: true, item: toWardrobeItemDto(updated) };
  }
}
