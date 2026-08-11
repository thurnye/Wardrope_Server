import { describe, expect, it } from 'vitest';
import { inferNaturalDressMeTimeForTest, interpretNaturalDressMeRequest } from './dress-me.service';

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

  it('translates relative day and spoken clock time on the backend', () => {
    const now = new Date('2026-08-10T23:00:00.000Z');
    const tomorrowEvening = new Date(inferNaturalDressMeTimeForTest('Tomorrow evening at 7 pm', now));
    expect(tomorrowEvening.getHours()).toBe(19);
    expect(tomorrowEvening.getTime() - now.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1_000);
    expect(inferNaturalDressMeTimeForTest('I am leaving in 2 hours', now))
      .toBe('2026-08-11T01:00:00.000Z');
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
