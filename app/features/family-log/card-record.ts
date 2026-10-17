import { isAllowedCurrency, normalizeCurrencyCode } from '@/lib/currencies';
import type { FamilyLogCard, FamilyLogKind } from './types';

export const FAMILY_LOG_CARD_COLUMNS =
  'id,group_id,title,kind,day_date,latitude,longitude,address,note,mood_tags,show_map,amount,currency,collage_style,created_at,updated_at';

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
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    title: String(row.title ?? ''),
    kind: asKind(row.kind) ?? 'note',
    day_date: String(row.day_date ?? '').slice(0, 10),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    address: typeof row.address === 'string' ? row.address : null,
    note: typeof row.note === 'string' ? row.note : null,
    mood_tags: moods,
    show_map: row.show_map !== false,
    amount: amountRaw != null && Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    collage_style: style,
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

  return {
    patch: {
      title,
      note: note || null,
      mood_tags: moodTags,
      show_map: body.show_map !== false,
      amount,
      currency: amount != null ? currencyRaw : null,
      collage_style: collage,
      updated_at: new Date().toISOString(),
    },
  };
}
