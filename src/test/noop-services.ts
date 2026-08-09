import type { IWardrobeService } from '../Wardrope.Core/services/ServicesInterface/Wardrobe/wardrobe.service.interface';

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
