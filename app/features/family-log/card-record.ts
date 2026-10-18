import { isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';
import type { FamilyLogCard, FamilyLogKind, FamilyLogRoutePoint } from './types';

export const FAMILY_LOG_CARD_COLUMNS =
  'id,group_id,title,kind,day_date,latitude,longitude,place_latitude,place_longitude,route_points,address,note,mood_tags,show_map,amount,currency,collage_style,rating,is_revisit,created_at,updated_at';

function finiteCoord(value: unknown, limit: number): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

function parseFamilyLogRoutePoints(raw: unknown): FamilyLogRoutePoint[] {
  if (!Array.isArray(raw)) return [];
  const points: FamilyLogRoutePoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const latitude = finiteCoord(row.latitude, 90);
    const longitude = finiteCoord(row.longitude, 180);
    if (latitude == null || longitude == null) continue;
    points.push({ latitude, longitude });
  }
  return points;
}

/** Route line for a route card. Falls back to the saved start pin when no track was stored. */
export function routePointsForCard(
  card: Pick<FamilyLogCard, 'route_points' | 'latitude' | 'longitude'>,
): FamilyLogRoutePoint[] {
  if (card.route_points.length > 0) return card.route_points;
  if (card.latitude != null && card.longitude != null) {
    return [{ latitude: card.latitude, longitude: card.longitude }];
  }
  return [];
}

export const FAMILY_LOG_MOODS = ['😊', '🍜', '📸', '🌧️', '❤️', '🚶', '☀️'] as const;

const MOODS = new Set<string>(FAMILY_LOG_MOODS);

function asKind(value: unknown): FamilyLogKind | null {
  if (value === 'checkin' || value === 'route' || value === 'note') return value;
  return null;
}

export function normalizeFamilyLogCard(row: Record<string, unknown>): FamilyLogCard {
  const amountRaw = row.amount == null ? null : Number(row.amount);
  const moods = Array.isArray(row.mood_tags)
    ? row.mood_tags.filter((tag): tag is string => typeof tag === 'string' && MOODS.has(tag))
    : [];
  const style = row.collage_style === 'postal' || row.collage_style === 'film' ? row.collage_style : null;
  const ratingRaw = Number(row.rating);
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    title: String(row.title ?? ''),
    kind: asKind(row.kind) ?? 'note',
    day_date: String(row.day_date ?? '').slice(0, 10),
    latitude: finiteCoord(row.latitude, 90),
    longitude: finiteCoord(row.longitude, 180),
    place_latitude: finiteCoord(row.place_latitude, 90),
    place_longitude: finiteCoord(row.place_longitude, 180),
    route_points: parseFamilyLogRoutePoints(row.route_points),
    address: typeof row.address === 'string' ? row.address : null,
    note: typeof row.note === 'string' ? row.note : null,
    mood_tags: moods,
    show_map: row.show_map !== false,
    amount: amountRaw != null && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    collage_style: style,
    rating,
    is_revisit: row.is_revisit === true,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export function parseFamilyLogCardPatch(body: Record<string, unknown>): {
  error?: string;
  patch?: Record<string, unknown>;
} {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: '제목은 필수입니다.' };

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 8000) : '';
  const moodTags = Array.isArray(body.mood_tags)
    ? body.mood_tags.filter((tag): tag is string => typeof tag === 'string' && MOODS.has(tag)).slice(0, 8)
    : [];
  const amountRaw = body.amount == null || body.amount === '' ? null : Number(body.amount);
  const amount = amountRaw != null && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;
  const currencyRaw = typeof body.currency === 'string' ? normalizeCurrencyCode(body.currency) : '';
  if (amount != null && !isAllowedCurrency(currencyRaw)) {
    return { error: '통화를 선택해 주세요.' };
  }
  const collage =
    body.collage_style === 'postal' || body.collage_style === 'film' ? body.collage_style : null;
  let rating: number | null = null;
  if (body.rating != null && body.rating !== '') {
    const n = Number(body.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: '별점은 1부터 5까지입니다.' };
    rating = n;
  }

  return {
    patch: {
      title,
      note: note || null,
      mood_tags: moodTags,
      show_map: body.show_map !== false,
      amount,
      currency: amount != null ? currencyRaw : null,
      collage_style: collage,
      rating,
      is_revisit: body.is_revisit === true,
      updated_at: new Date().toISOString(),
    },
  };
}
