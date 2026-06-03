import type { TravelPlaceSourceKind } from '@/lib/modules/travel-planner/types';

export interface TravelDiaryEntry {
  id: string;
  group_id: string;
  trip_id: string;
  source_kind: TravelPlaceSourceKind | null;
  source_id: string | null;
  day_date: string;
  note: string | null;
  mood_tags: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export type TravelDiaryEntryUpsertInput = {
  id?: string;
  source_kind?: TravelPlaceSourceKind | null;
  source_id?: string | null;
  day_date: string;
  note?: string | null;
  mood_tags?: string[];
  sort_order?: number;
  rating?: number | null;
  is_revisit?: boolean | null;
  actual_expense?: number | null;
  place_title?: string;
};
