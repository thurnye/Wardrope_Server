import { describe, expect, it } from 'vitest';
import { interpretNaturalDressMeRequest } from './dress-me.service';

describe('Dress Me natural request interpretation', () => {
  it('translates occasion, dress code, and fragrance preferences', () => {
    expect(interpretNaturalDressMeRequest({
      occasion: 'everyday',
      includeFragrance: true,
      additionalContext: 'I need a smart casual outfit for a dinner date, with no fragrance.',
    })).toEqual({
      occasion: 'date',
      dressCode: 'smart-casual',
      includeFragrance: false,
    });
  });

  it('keeps explicit controls when natural language does not replace them', () => {
    expect(interpretNaturalDressMeRequest({
      occasion: 'travel',
      dressCode: 'casual',
      includeFragrance: false,
      additionalContext: 'Something comfortable in navy with sneakers.',
    })).toEqual({
      occasion: 'travel',
      dressCode: 'casual',
      includeFragrance: false,
    });
  });
});
