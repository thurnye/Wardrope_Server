import type { IWardrobeService } from '../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';
import type { IWardrobeImageService } from '../Wardrope.Core/services/ServicesInterface/WardrobeImage/wardrobe-image.service.interface';

export const noopWardrobeService: IWardrobeService = {
  create: async () => {
    throw new Error('noopWardrobeService.create should not be called in this test.');
  },
  list: async (_userId, query) => ({
    items: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 0,
      totalPages: 0,
    },
  }),
  getById: async () => null,
  update: async () => null,
  delete: async () => false,
};

export const noopWardrobeImageService: IWardrobeImageService = {
  replace: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  read: async () => ({ ok: false, reason: 'NOT_FOUND' }),
  remove: async () => ({ ok: false, reason: 'NOT_FOUND' }),
};
