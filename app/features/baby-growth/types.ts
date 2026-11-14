/**
 * 우리아이 성장기록 위젯 — 타입 정의
 */

// ---------------------------------------------------------------------------
// Union Types
// ---------------------------------------------------------------------------

export type BabyGender = 'male' | 'female' | 'other';

export type LogType =
  | 'feeding'
  | 'sleep'
  | 'diaper'
  | 'temperature'
  | 'medication'
  | 'activity'
  | 'symptom';

export type ActivityType = 'bath' | 'tummy_time' | 'pumping' | 'other';

export type FeedingType =
  | 'breast_left'
  | 'breast_right'
  | 'bottle'
  | 'solid'
  | 'mixed';

export type DiaperType = 'wet' | 'dirty' | 'mixed' | 'dry';

export type MilestoneCategory =
  | 'motor'
  | 'language'
  | 'social'
  | 'cognitive'
  | 'sensory';

// ---------------------------------------------------------------------------
// BabyProfile — baby_profiles 테이블
// ---------------------------------------------------------------------------

export interface BabyProfile {
  id: string;
  group_id: string;
  created_by: string | null;
  name: string;
  birth_date: string; // ISO date 'YYYY-MM-DD'
  gender: BabyGender | null;
  avatar_url: string | null;
  country_code: string;
  notes: string | null;
  /** 'HH:mm' 또는 'HH:mm:ss'. 없으면 야간 추정 안 함 */
  usual_bedtime: string | null;
  usual_wake_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface BabyProfileDraft {
  group_id: string;
  name: string;
  birth_date: string;
  gender?: BabyGender;
  avatar_url?: string;
  country_code?: string;
  notes?: string;
  usual_bedtime?: string | null;
  usual_wake_time?: string | null;
}

// ---------------------------------------------------------------------------
// BabyDailyLog — baby_daily_logs 테이블
// ---------------------------------------------------------------------------

export interface BabyDailyLog {
  id: string;
  baby_id: string;
  group_id: string;
  log_type: LogType;
  logged_at: string; // ISO datetime
  // feeding
  feeding_type: FeedingType | null;
  feeding_amount_ml: number | null;
  feeding_duration_min: number | null;
  // feeding — 모유 수유 타이머 (왼/오른쪽 독립)
  breast_left_min: number | null;
  breast_right_min: number | null;
  // feeding — 이유식 재료·알레르기
  solid_ingredients: string | null;
  allergy_reaction: string | null;
  // sleep — 실기록 여부. null이면 기존 행(둘 다 실기록으로 간주)
  sleep_start_recorded: boolean | null;
  sleep_end_recorded: boolean | null;
  sleep_end_at: string | null;
  // symptom
  symptom_tags: string | null;
  // diaper
  diaper_type: DiaperType | null;
  diaper_color: string | null;
  diaper_consistency: string | null;
  // temperature
  temperature_celsius: number | null;
  // medication
  medication_name: string | null;
  medication_dose_mg: number | null;
  // activity (목욕/터미타임/유축 등)
  activity_type: ActivityType | null;
  activity_duration_min: number | null;
  pump_amount_ml: number | null;
  // shared
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BabyDailyLogDraft {
  baby_id: string;
  group_id: string;
  log_type: LogType;
  logged_at?: string;
  // feeding
  feeding_type?: FeedingType;
  feeding_amount_ml?: number;
  feeding_duration_min?: number;
  breast_left_min?: number;
  breast_right_min?: number;
  solid_ingredients?: string;
  allergy_reaction?: string;
  // sleep
  sleep_end_at?: string;
  sleep_start_recorded?: boolean;
  sleep_end_recorded?: boolean;
  // symptom
  symptom_tags?: string;
  // diaper
  diaper_type?: DiaperType;
  diaper_color?: string;
  diaper_consistency?: string;
  // temperature
  temperature_celsius?: number;
  // medication
  medication_name?: string;
  medication_dose_mg?: number;
  // activity
  activity_type?: ActivityType;
  activity_duration_min?: number;
  pump_amount_ml?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// BabyGrowthRecord — baby_growth_records 테이블
// ---------------------------------------------------------------------------

export interface BabyGrowthRecord {
  id: string;
  baby_id: string;
  group_id: string;
  measured_at: string; // ISO date
  weight_kg: number | null;
  height_cm: number | null;
  head_cm: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BabyGrowthRecordDraft {
  baby_id: string;
  group_id: string;
  measured_at: string;
  weight_kg?: number;
  height_cm?: number;
  head_cm?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// BabyMilestone — baby_milestones 테이블
// ---------------------------------------------------------------------------

export interface BabyMilestone {
  id: string;
  baby_id: string;
  group_id: string;
  category: MilestoneCategory;
  milestone_key: string;
  achieved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BabyMilestoneDraft {
  baby_id: string;
  group_id: string;
  category: MilestoneCategory;
  milestone_key: string;
  achieved_at?: string | null;
  notes?: string;
}

// ---------------------------------------------------------------------------
// BabyVaccination — baby_vaccinations 테이블
// ---------------------------------------------------------------------------

export interface BabyVaccination {
  id: string;
  baby_id: string;
  group_id: string;
  vaccine_key: string;
  scheduled_at: string | null;
  administered_at: string | null;
  facility_name: string | null;
  product_name: string | null;
  custom_label: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BabyVaccinationDraft {
  baby_id: string;
  group_id: string;
  vaccine_key: string;
  scheduled_at?: string | null;
  administered_at?: string | null;
  facility_name?: string | null;
  product_name?: string | null;
  custom_label?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// 집계/뷰 타입
// ---------------------------------------------------------------------------

/** 대시보드 위젯용 최근 상태 요약 */
export interface BabyRecentStatus {
  lastFeeding: BabyDailyLog | null;
  lastSleep: BabyDailyLog | null;
  lastDiaper: BabyDailyLog | null;
  lastTemperature: BabyDailyLog | null;
}

/** WHO 성장 곡선 백분위 단일 데이터 포인트 */
export interface WhoPercentilePoint {
  monthAge: number; // 월령 (0~24)
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

/** 아기 사진 첨부 (attachments 테이블 feature_type='baby_growth' 로우) */
export interface BabyPhoto {
  id: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  takenAt: string | null; // 촬영일. 없으면 개월을 표시하지 않는다
  monthAge: number | null; // 아기 월령
}

/** 인쇄용 앨범 사진별 편집 (baby_print_albums.photo_edits) */
export type BabyPrintPhotoEdit = {
  included: boolean;
  frame: 'rect' | 'round' | 'diamond' | 'heart' | 'hex';
  /** 0~359 도 */
  rotation: number;
};

/** 그룹에 저장된 인쇄용 앨범 편집본 */
export interface BabyPrintAlbum {
  id: string;
  group_id: string;
  baby_id: string;
  created_by: string | null;
  title: string;
  bg: 'cream' | 'blush' | 'sage' | 'sky';
  layout: 'grid2' | 'grid3' | 'hero';
  show_captions: boolean;
  photo_order: string[];
  photo_edits: Record<string, BabyPrintPhotoEdit>;
  created_at: string;
  updated_at: string;
}

/** 국가별 예방접종 스케줄 항목 */
export interface VaccineScheduleItem {
  vaccineKey: string;
  label: string;
  recommendedMonths: number[]; // 접종 권장 월령 목록
  disease: string;
}

/** 접종 D-Day 뷰 (스케줄 + DB 상태 머지) */
export interface VaccineDDayView {
  vaccineKey: string;
  label: string;
  disease: string;
  scheduledAt: string; // 계산된 접종 예정일
  administeredAt: string | null;
  daysUntil: number; // 양수=남음, 0=오늘, 음수=지남
  isDone: boolean;
  isCustom: boolean;
  facilityName: string | null;
  productName: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// BabyCheckup — baby_checkups 테이블 (영유아 검진 결과)
// ---------------------------------------------------------------------------

export type CheckupType =
  | '1m' | '2m' | '4m' | '6m' | '9m' | '12m'
  | '15m' | '18m' | '24m' | '36m' | '48m' | '54m' | '60m' | '66m' | '72m';

export interface BabyCheckup {
  id: string;
  baby_id: string;
  group_id: string;
  checkup_type: CheckupType;
  checkup_date: string; // ISO date
  weight_kg: number | null;
  height_cm: number | null;
  head_cm: number | null;
  vision_ok: boolean | null;
  hearing_ok: boolean | null;
  dev_notes: string | null;
  doctor_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BabyCheckupDraft {
  baby_id: string;
  group_id: string;
  checkup_type: CheckupType;
  checkup_date: string;
  weight_kg?: number;
  height_cm?: number;
  head_cm?: number;
  vision_ok?: boolean;
  hearing_ok?: boolean;
  dev_notes?: string;
  doctor_notes?: string;
}

// ---------------------------------------------------------------------------
// BabyReminder — baby_reminders 테이블 (입력 알림)
// ---------------------------------------------------------------------------

export type ReminderType = 'growth_record' | 'checkup' | 'vaccination';

export interface BabyReminder {
  id: string;
  baby_id: string;
  group_id: string;
  reminder_type: ReminderType;
  remind_at: string; // ISO datetime
  reference_key: string | null;
  is_dismissed: boolean;
  created_by: string | null;
  created_at: string;
}
