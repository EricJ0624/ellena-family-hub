/**
 * 붙여넣기 일정 가져오기 (B안 위저드) 전용 타입 — 기존 DB/API 타입과 분리.
 */

export type ImportItemKind = 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';

export interface ParsedImportItem {
  /** 미리보기·편집용 임시 id */
  id: string;
  kind: ImportItemKind;
  /** Day N (1-based) when explicit calendar date unknown at parse time */
  day_index?: number | null;
  day_date?: string | null;
  end_day_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
  departure?: string | null;
  arrival?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  /** true when classified as other due to low confidence */
  low_confidence?: boolean;
}

export interface ParsedTripMeta {
  title?: string | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
}

export interface ParseItineraryImportResult {
  meta: ParsedTripMeta;
  items: ParsedImportItem[];
}

export type ImportWizardStep = 'paste' | 'trip' | 'preview';
