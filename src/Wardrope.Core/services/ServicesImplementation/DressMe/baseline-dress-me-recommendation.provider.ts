import type {
  DressMeProviderContext,
  DressMeProviderRecommendation,
  DressMeReasonCode,
} from '../../../Models/DressMe/dress-me.model';
import type { FragranceDto } from '../../../Models/Fragrance/fragrance.model';
import type { WardrobeItemDto } from '../../../Models/Wardrobe/wardrobe.model';
import type { IDressMeRecommendationProvider } from '../../ServicesInterface/DressMe/dress-me.service.interface';

interface ScoredItem {
  item: WardrobeItemDto;
  score: number;
  reasons: DressMeReasonCode[];
}

interface CandidateCombination {
  items: ScoredItem[];
  score: number;
  reasons: Set<DressMeReasonCode>;
}

const FORMAL_KEYWORDS = [
  'blazer', 'suit', 'trouser', 'dress shirt', 'button-down', 'oxford', 'loafer', 'heel', 'dress', 'skirt', 'tuxedo',
];
const CASUAL_KEYWORDS = [
  'jean', 'denim', 'tee', 't-shirt', 'sneaker', 'hoodie', 'sweatshirt', 'jogger', 'chino',
];
const COLD_MATERIALS = ['wool', 'cashmere', 'fleece', 'down', 'leather', 'suede'];
const WARM_MATERIALS = ['linen', 'cotton', 'silk', 'rayon', 'viscose'];

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

function textFor(item: WardrobeItemDto): string {
  return [item.name, item.subcategory, item.brand ?? '', ...item.materials]
    .join(' ')
    .toLocaleLowerCase('en');
}

function intersects(values: string[], reference: Set<string>): boolean {
  return values.some((value) => reference.has(normalized(value)));
}

function recentWearCounts(context: DressMeProviderContext) {
  const counts = new Map<string, number>();
  const reference = new Date(context.request.forAt).getTime();
  const cutoff = reference - 14 * 24 * 60 * 60 * 1_000;

  for (const entry of context.wearHistory) {
    const wornAt = new Date(entry.wornAt).getTime();
    if (wornAt < cutoff || wornAt > reference + 5 * 60 * 1_000) continue;
    for (const itemId of entry.wardrobeItemIds) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }
  return counts;
}

function fragranceWearCounts(context: DressMeProviderContext) {
  const counts = new Map<string, number>();
  const reference = new Date(context.request.forAt).getTime();
  const cutoff = reference - 14 * 24 * 60 * 60 * 1_000;

  for (const entry of context.wearHistory) {
    if (!entry.fragranceId) continue;
    const wornAt = new Date(entry.wornAt).getTime();
    if (wornAt < cutoff || wornAt > reference + 5 * 60 * 1_000) continue;
    counts.set(entry.fragranceId, (counts.get(entry.fragranceId) ?? 0) + 1);
  }
  return counts;
}

function usualSizeForCategory(context: DressMeProviderContext, item: WardrobeItemDto): string | null {
  const profile = context.physicalProfile;
  if (!profile) return null;
  switch (item.category) {
    case 'top': return profile.usualTopSize;
    case 'bottom': return profile.usualBottomSize;
    case 'one-piece': return profile.usualOnePieceSize;
    case 'outerwear': return profile.usualOuterwearSize;
    default: return null;
  }
}

function occasionScore(context: DressMeProviderContext, item: WardrobeItemDto): number {
  const text = textFor(item);
  const dressCode = context.request.dressCode;
  const formalContext =
    ['business', 'wedding', 'formal-event', 'religious'].includes(context.request.occasion)
    || ['business', 'cocktail', 'semi-formal', 'formal', 'black-tie'].includes(dressCode ?? '');
  const casualContext =
    ['everyday', 'travel', 'outdoor'].includes(context.request.occasion)
    || dressCode === 'casual';

  if (formalContext) {
    return FORMAL_KEYWORDS.some((keyword) => text.includes(keyword)) ? 5 : 0;
  }
  if (casualContext) {
    return CASUAL_KEYWORDS.some((keyword) => text.includes(keyword)) ? 3 : 0;
  }
  if (context.request.occasion === 'workout') {
    return item.category === 'footwear' || text.includes('sport') || text.includes('athletic') || text.includes('gym') ? 5 : -2;
  }
  return 0;
}

function scoreItem(
  context: DressMeProviderContext,
  item: WardrobeItemDto,
  recentCounts: Map<string, number>,
): ScoredItem {
  let score = 0;
  const reasons = new Set<DressMeReasonCode>();
  const preferences = context.preferences;
  const preferredColors = new Set((preferences?.preferredColors ?? []).map(normalized));
  const avoidedColors = new Set((preferences?.avoidedColors ?? []).map(normalized));

  if (item.favorite) {
    score += 7;
    reasons.add('favorite-piece');
  }

  if (intersects(item.colors, preferredColors)) {
    score += 6;
    reasons.add('preferred-colors');
  }
  if (intersects(item.colors, avoidedColors)) score -= 24;

  const repeatCount = recentCounts.get(item.id) ?? 0;
  if (preferences?.repeatPreference === 'maximize-variety') score -= repeatCount * 10;
  else if (preferences?.repeatPreference === 'balanced') score -= repeatCount * 4;
  else if (preferences?.repeatPreference === 'rewear-friendly') score -= repeatCount;
  if (preferences?.repeatPreference && repeatCount === 0) reasons.add('repeat-aware');

  if (preferences?.patternLevel === 'minimal') {
    if (!item.pattern || item.pattern === 'solid') score += 3;
    else score -= 4;
  } else if (preferences?.patternLevel === 'bold' && item.pattern && item.pattern !== 'solid') {
    score += 3;
  }

  const usualSize = usualSizeForCategory(context, item);
  if (usualSize && item.size && normalized(usualSize) === normalized(item.size)) {
    score += 3;
    reasons.add('usual-size-match');
  }

  const occasion = occasionScore(context, item);
  score += occasion;
  if (occasion > 0) reasons.add('occasion-aligned');

  const requestedTerms = (context.request.additionalContext ?? '')
    .toLocaleLowerCase('en')
    .match(/[\p{L}\p{N}-]+/gu)
    ?.filter((term) => term.length >= 3) ?? [];
  score += Math.min(6, requestedTerms.filter((term) => textFor(item).includes(term)).length * 2);

  if (context.weather) {
    const materialKeys = item.materials.map(normalized);
    if (context.weather.feelsLikeC <= 12 && materialKeys.some((material) => COLD_MATERIALS.some((needle) => material.includes(needle)))) {
      score += 4;
      reasons.add('weather-layer');
    }
    if (context.weather.feelsLikeC >= 24 && materialKeys.some((material) => WARM_MATERIALS.some((needle) => material.includes(needle)))) {
      score += 4;
      reasons.add('weather-lightweight');
    }
  }

  return { item, score, reasons: [...reasons] };
}

function takeCategory(scored: ScoredItem[], category: WardrobeItemDto['category'], limit = 6) {
  return scored.filter(({ item }) => item.category === category).slice(0, limit);
}

function bestOptional(scored: ScoredItem[], categories: WardrobeItemDto['category'][]): ScoredItem | null {
  return scored.find(({ item }) => categories.includes(item.category)) ?? null;
}

function comboKey(items: ScoredItem[]): string {
  return items.map(({ item }) => item.id).sort().join(':');
}

function addOptionalItems(context: DressMeProviderContext, scored: ScoredItem[], base: ScoredItem[]): ScoredItem[] {
  const result = [...base];
  const selected = new Set(result.map(({ item }) => item.id));
  const outerwear = bestOptional(scored.filter(({ item }) => !selected.has(item.id)), ['outerwear']);
  const feelsLike = context.weather?.feelsLikeC ?? null;
  const wantsLayer =
    (feelsLike !== null && feelsLike <= 15)
    || (context.preferences?.layeringLevel === 'layered' && (feelsLike === null || feelsLike <= 22));
  if (outerwear && wantsLayer) {
    result.push(outerwear);
    selected.add(outerwear.item.id);
  }

  const accessoryLevel = context.preferences?.accessoryLevel ?? 'minimal';
  const accessoryCount = accessoryLevel === 'statement' ? 2 : accessoryLevel === 'balanced' ? 1 : 0;
  const accessoryPool = scored.filter(({ item }) =>
    !selected.has(item.id) && ['bag', 'accessory', 'jewelry'].includes(item.category),
  );
  for (const accessory of accessoryPool.slice(0, accessoryCount)) {
    result.push(accessory);
    selected.add(accessory.item.id);
  }

  return result;
}

function knownOutfitBonus(context: DressMeProviderContext, ids: Set<string>): number {
  return context.savedOutfits.some((outfit) =>
    outfit.favorite
    && outfit.wardrobeItemIds.length >= 2
    && outfit.wardrobeItemIds.every((id) => ids.has(id)),
  ) ? 8 : 0;
}

function buildCombinations(context: DressMeProviderContext, scored: ScoredItem[]): CandidateCombination[] {
  const tops = takeCategory(scored, 'top');
  const bottoms = takeCategory(scored, 'bottom');
  const onePieces = takeCategory(scored, 'one-piece');
  const footwear = takeCategory(scored, 'footwear', 4);
  const shoes: Array<ScoredItem | null> = footwear.length > 0 ? footwear : [null];
  const candidates: CandidateCombination[] = [];
  const seen = new Set<string>();

  const add = (base: ScoredItem[]) => {
    const items = addOptionalItems(context, scored, base);
    const key = comboKey(items);
    if (seen.has(key)) return;
    seen.add(key);
    const reasons = new Set(items.flatMap((item) => item.reasons));
    const ids = new Set(items.map(({ item }) => item.id));
    const favoriteBonus = knownOutfitBonus(context, ids);
    if (favoriteBonus > 0) reasons.add('favorite-outfit-pattern');
    if (context.weather?.feelsLikeC !== undefined) {
      if (items.some(({ item }) => item.category === 'outerwear') && context.weather.feelsLikeC <= 18) reasons.add('weather-layer');
      if (!items.some(({ item }) => item.category === 'outerwear') && context.weather.feelsLikeC >= 24) reasons.add('weather-lightweight');
    }
    candidates.push({
      items,
      score: items.reduce((sum, item) => sum + item.score, 0) + favoriteBonus,
      reasons,
    });
  };

  for (const onePiece of onePieces) {
    for (const shoe of shoes) add(shoe ? [onePiece, shoe] : [onePiece]);
  }
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) add(shoe ? [top, bottom, shoe] : [top, bottom]);
    }
  }

  if (candidates.length === 0 && scored.length > 0) {
    add(scored.slice(0, Math.min(3, scored.length)));
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreFragrance(
  context: DressMeProviderContext,
  fragrance: FragranceDto,
  recentCounts: Map<string, number>,
): number {
  let score = 0;
  const count = recentCounts.get(fragrance.id) ?? 0;
  const repeatPreference = context.preferences?.repeatPreference;
  if (repeatPreference === 'maximize-variety') score -= count * 8;
  else if (repeatPreference === 'balanced') score -= count * 3;

  const feelsLike = context.weather?.feelsLikeC;
  if (feelsLike !== undefined && fragrance.concentration) {
    if (feelsLike >= 24 && ['eau-de-cologne', 'eau-de-toilette'].includes(fragrance.concentration)) score += 4;
    if (feelsLike <= 10 && ['eau-de-parfum', 'parfum', 'extrait-de-parfum'].includes(fragrance.concentration)) score += 4;
  }
  if (fragrance.amountRemainingPercent !== null && fragrance.amountRemainingPercent <= 0) score -= 100;
  return score;
}

export class BaselineDressMeRecommendationProvider implements IDressMeRecommendationProvider {
  readonly engine = 'baseline' as const;

  async recommend(context: DressMeProviderContext): Promise<DressMeProviderRecommendation[]> {
    const recentItems = recentWearCounts(context);
    const scored = context.wardrobeItems
      .map((item) => scoreItem(context, item, recentItems))
      .sort((a, b) => b.score - a.score);
    const combinations = buildCombinations(context, scored);

    const fragranceCounts = fragranceWearCounts(context);
    const fragrances = context.request.includeFragrance
      ? context.fragrances
          .filter((fragrance) => fragrance.available)
          .map((fragrance) => ({ fragrance, score: scoreFragrance(context, fragrance, fragranceCounts) }))
          .sort((a, b) => b.score - a.score)
      : [];

    return combinations
      .slice(0, context.request.recommendationCount)
      .map((candidate, index) => {
        const paired = fragrances.length > 0 ? fragrances[index % fragrances.length]?.fragrance ?? null : null;
        const reasons = new Set(candidate.reasons);
        if (paired) reasons.add('fragrance-paired');
        return {
          wardrobeItemIds: candidate.items.map(({ item }) => item.id),
          fragranceId: paired?.id ?? null,
          score: Math.max(0, Math.min(100, Math.round(55 + candidate.score))),
          reasons: [...reasons],
        };
      });
  }
}
