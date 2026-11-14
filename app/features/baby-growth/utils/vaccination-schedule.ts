/**
 * 국가별 예방접종 일정 정의
 * - KR: 질병관리청 국가예방접종 일정
 * - US: CDC 권고 일정
 * - JP: 일본 정기예방접종 일정
 *
 * 각 항목의 recommendedMonths 는 월령 기준 (0=출생 시)
 */

import type { BabyVaccination, VaccineScheduleItem, VaccineDDayView } from '../types';
import { daysUntil } from './age-calculator';

// ---------------------------------------------------------------------------
// 한국 (KR) — 질병관리청
// ---------------------------------------------------------------------------
const KR_SCHEDULE: VaccineScheduleItem[] = [
  { vaccineKey: 'bcg',       label: 'BCG (결핵)',          disease: '결핵',          recommendedMonths: [0] },
  { vaccineKey: 'hep_b_1',   label: 'B형간염 1차',         disease: 'B형간염',        recommendedMonths: [0] },
  { vaccineKey: 'hep_b_2',   label: 'B형간염 2차',         disease: 'B형간염',        recommendedMonths: [1] },
  { vaccineKey: 'hep_b_3',   label: 'B형간염 3차',         disease: 'B형간염',        recommendedMonths: [6] },
  { vaccineKey: 'dtap_1',    label: 'DTaP 1차',            disease: '디프테리아/파상풍/백일해', recommendedMonths: [2] },
  { vaccineKey: 'dtap_2',    label: 'DTaP 2차',            disease: '디프테리아/파상풍/백일해', recommendedMonths: [4] },
  { vaccineKey: 'dtap_3',    label: 'DTaP 3차',            disease: '디프테리아/파상풍/백일해', recommendedMonths: [6] },
  { vaccineKey: 'dtap_4',    label: 'DTaP 4차 (추가)',      disease: '디프테리아/파상풍/백일해', recommendedMonths: [15] },
  { vaccineKey: 'ipv_1',     label: 'IPV 1차',             disease: '폴리오',         recommendedMonths: [2] },
  { vaccineKey: 'ipv_2',     label: 'IPV 2차',             disease: '폴리오',         recommendedMonths: [4] },
  { vaccineKey: 'ipv_3',     label: 'IPV 3차',             disease: '폴리오',         recommendedMonths: [6] },
  { vaccineKey: 'hib_1',     label: 'Hib 1차',             disease: 'B형헤모필루스인플루엔자', recommendedMonths: [2] },
  { vaccineKey: 'hib_2',     label: 'Hib 2차',             disease: 'B형헤모필루스인플루엔자', recommendedMonths: [4] },
  { vaccineKey: 'hib_3',     label: 'Hib 3차',             disease: 'B형헤모필루스인플루엔자', recommendedMonths: [6] },
  { vaccineKey: 'hib_4',     label: 'Hib 4차 (추가)',       disease: 'B형헤모필루스인플루엔자', recommendedMonths: [12] },
  { vaccineKey: 'pcv_1',     label: 'PCV 1차',             disease: '폐렴구균',        recommendedMonths: [2] },
  { vaccineKey: 'pcv_2',     label: 'PCV 2차',             disease: '폐렴구균',        recommendedMonths: [4] },
  { vaccineKey: 'pcv_3',     label: 'PCV 3차',             disease: '폐렴구균',        recommendedMonths: [6] },
  { vaccineKey: 'pcv_4',     label: 'PCV 4차 (추가)',       disease: '폐렴구균',        recommendedMonths: [12] },
  { vaccineKey: 'rota_1',    label: 'Rota 1차',            disease: '로타바이러스',     recommendedMonths: [2] },
  { vaccineKey: 'rota_2',    label: 'Rota 2차',            disease: '로타바이러스',     recommendedMonths: [4] },
  { vaccineKey: 'mmr_1',     label: 'MMR 1차',             disease: '홍역/유행성이하선염/풍진', recommendedMonths: [12] },
  { vaccineKey: 'var_1',     label: '수두 1차',             disease: '수두',           recommendedMonths: [12] },
  { vaccineKey: 'hepa_1',    label: 'A형간염 1차',          disease: 'A형간염',         recommendedMonths: [12] },
  { vaccineKey: 'hepa_2',    label: 'A형간염 2차',          disease: 'A형간염',         recommendedMonths: [18] },
  { vaccineKey: 'je_1',      label: '일본뇌염 1차',         disease: '일본뇌염',        recommendedMonths: [12] },
  { vaccineKey: 'je_2',      label: '일본뇌염 2차',         disease: '일본뇌염',        recommendedMonths: [13] },
  { vaccineKey: 'je_3',      label: '일본뇌염 3차 (추가)',   disease: '일본뇌염',        recommendedMonths: [24] },
  { vaccineKey: 'flu_1',     label: '독감 1차',             disease: '인플루엔자',       recommendedMonths: [6] },
  { vaccineKey: 'flu_2',     label: '독감 2차',             disease: '인플루엔자',       recommendedMonths: [7] },
];

// ---------------------------------------------------------------------------
// 미국 (US) — CDC
// ---------------------------------------------------------------------------
const US_SCHEDULE: VaccineScheduleItem[] = [
  { vaccineKey: 'hep_b_1',   label: 'Hep B 1st',      disease: 'Hepatitis B',    recommendedMonths: [0] },
  { vaccineKey: 'hep_b_2',   label: 'Hep B 2nd',      disease: 'Hepatitis B',    recommendedMonths: [1] },
  { vaccineKey: 'hep_b_3',   label: 'Hep B 3rd',      disease: 'Hepatitis B',    recommendedMonths: [6] },
  { vaccineKey: 'dtap_1',    label: 'DTaP 1st',       disease: 'Diphtheria/Tetanus/Pertussis', recommendedMonths: [2] },
  { vaccineKey: 'dtap_2',    label: 'DTaP 2nd',       disease: 'Diphtheria/Tetanus/Pertussis', recommendedMonths: [4] },
  { vaccineKey: 'dtap_3',    label: 'DTaP 3rd',       disease: 'Diphtheria/Tetanus/Pertussis', recommendedMonths: [6] },
  { vaccineKey: 'dtap_4',    label: 'DTaP 4th',       disease: 'Diphtheria/Tetanus/Pertussis', recommendedMonths: [15] },
  { vaccineKey: 'hib_1',     label: 'Hib 1st',        disease: 'Haemophilus influenzae', recommendedMonths: [2] },
  { vaccineKey: 'hib_2',     label: 'Hib 2nd',        disease: 'Haemophilus influenzae', recommendedMonths: [4] },
  { vaccineKey: 'hib_3',     label: 'Hib 3rd',        disease: 'Haemophilus influenzae', recommendedMonths: [6] },
  { vaccineKey: 'hib_4',     label: 'Hib Booster',    disease: 'Haemophilus influenzae', recommendedMonths: [12] },
  { vaccineKey: 'pcv_1',     label: 'PCV 1st',        disease: 'Pneumococcal',   recommendedMonths: [2] },
  { vaccineKey: 'pcv_2',     label: 'PCV 2nd',        disease: 'Pneumococcal',   recommendedMonths: [4] },
  { vaccineKey: 'pcv_3',     label: 'PCV 3rd',        disease: 'Pneumococcal',   recommendedMonths: [6] },
  { vaccineKey: 'pcv_4',     label: 'PCV Booster',    disease: 'Pneumococcal',   recommendedMonths: [12] },
  { vaccineKey: 'ipv_1',     label: 'IPV 1st',        disease: 'Polio',          recommendedMonths: [2] },
  { vaccineKey: 'ipv_2',     label: 'IPV 2nd',        disease: 'Polio',          recommendedMonths: [4] },
  { vaccineKey: 'ipv_3',     label: 'IPV 3rd',        disease: 'Polio',          recommendedMonths: [6] },
  { vaccineKey: 'rota_1',    label: 'Rotavirus 1st',  disease: 'Rotavirus',      recommendedMonths: [2] },
  { vaccineKey: 'rota_2',    label: 'Rotavirus 2nd',  disease: 'Rotavirus',      recommendedMonths: [4] },
  { vaccineKey: 'mmr_1',     label: 'MMR 1st',        disease: 'Measles/Mumps/Rubella', recommendedMonths: [12] },
  { vaccineKey: 'var_1',     label: 'Varicella 1st',  disease: 'Varicella',      recommendedMonths: [12] },
  { vaccineKey: 'hepa_1',    label: 'HepA 1st',       disease: 'Hepatitis A',    recommendedMonths: [12] },
  { vaccineKey: 'hepa_2',    label: 'HepA 2nd',       disease: 'Hepatitis A',    recommendedMonths: [18] },
  { vaccineKey: 'flu_1',     label: 'Flu 1st',        disease: 'Influenza',      recommendedMonths: [6] },
];

// ---------------------------------------------------------------------------
// 일본 (JP)
// ---------------------------------------------------------------------------
const JP_SCHEDULE: VaccineScheduleItem[] = [
  { vaccineKey: 'bcg',       label: 'BCG',             disease: '結核',           recommendedMonths: [5] },
  { vaccineKey: 'hep_b_1',   label: 'B型肝炎 1回目',   disease: 'B型肝炎',         recommendedMonths: [2] },
  { vaccineKey: 'hep_b_2',   label: 'B型肝炎 2回目',   disease: 'B型肝炎',         recommendedMonths: [3] },
  { vaccineKey: 'hep_b_3',   label: 'B型肝炎 3回目',   disease: 'B型肝炎',         recommendedMonths: [7] },
  { vaccineKey: 'dtap_1',    label: 'DPT-IPV 1回目',  disease: 'ジフテリア/百日咳/破傷風/ポリオ', recommendedMonths: [2] },
  { vaccineKey: 'dtap_2',    label: 'DPT-IPV 2回目',  disease: 'ジフテリア/百日咳/破傷風/ポリオ', recommendedMonths: [3] },
  { vaccineKey: 'dtap_3',    label: 'DPT-IPV 3回目',  disease: 'ジフテリア/百日咳/破傷風/ポリオ', recommendedMonths: [4] },
  { vaccineKey: 'hib_1',     label: 'Hib 1回目',       disease: 'ヒブ',           recommendedMonths: [2] },
  { vaccineKey: 'hib_2',     label: 'Hib 2回目',       disease: 'ヒブ',           recommendedMonths: [3] },
  { vaccineKey: 'hib_3',     label: 'Hib 3回目',       disease: 'ヒブ',           recommendedMonths: [4] },
  { vaccineKey: 'hib_4',     label: 'Hib 4回目',       disease: 'ヒブ',           recommendedMonths: [12] },
  { vaccineKey: 'pcv_1',     label: '肺炎球菌 1回目',   disease: '肺炎球菌',        recommendedMonths: [2] },
  { vaccineKey: 'pcv_2',     label: '肺炎球菌 2回目',   disease: '肺炎球菌',        recommendedMonths: [3] },
  { vaccineKey: 'pcv_3',     label: '肺炎球菌 3回目',   disease: '肺炎球菌',        recommendedMonths: [4] },
  { vaccineKey: 'pcv_4',     label: '肺炎球菌 4回目',   disease: '肺炎球菌',        recommendedMonths: [12] },
  { vaccineKey: 'rota_1',    label: 'ロタ 1回目',       disease: 'ロタウイルス',     recommendedMonths: [2] },
  { vaccineKey: 'rota_2',    label: 'ロタ 2回目',       disease: 'ロタウイルス',     recommendedMonths: [3] },
  { vaccineKey: 'mmr_1',     label: 'MR 1回目',        disease: '麻疹/風疹',        recommendedMonths: [12] },
  { vaccineKey: 'var_1',     label: '水痘 1回目',       disease: '水痘',            recommendedMonths: [12] },
  { vaccineKey: 'var_2',     label: '水痘 2回目',       disease: '水痘',            recommendedMonths: [18] },
];

const SCHEDULES: Record<string, VaccineScheduleItem[]> = {
  KR: KR_SCHEDULE,
  US: US_SCHEDULE,
  JP: JP_SCHEDULE,
};

/** 생년월일 문자열에 월령을 더한다. 시간대와 무관하게 달력 날짜를 유지한다. */
function addMonths(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, Number(match[3])));
  return utc.toISOString().slice(0, 10);
}

/**
 * 국가 코드에 맞는 접종 일정을 반환 (없으면 KR fallback)
 */
function getVaccineSchedule(countryCode: string): VaccineScheduleItem[] {
  return SCHEDULES[countryCode.toUpperCase()] ?? SCHEDULES.KR;
}

/**
 * 접종 일정 + DB 접종 완료 여부를 머지하여 D-Day 뷰를 생성
 *
 * @param countryCode - 국가 코드
 * @param birthDate   - 아기 생년월일 'YYYY-MM-DD'
 * @param records     - baby_vaccinations 행
 */
export function buildVaccineDDayViews(
  countryCode: string,
  birthDate: string,
  records: BabyVaccination[],
): VaccineDDayView[] {
  const schedule = getVaccineSchedule(countryCode);
  const byKey = new Map(records.map((record) => [record.vaccine_key, record]));

  const scheduledViews = schedule.map((item) => {
    const months = item.recommendedMonths[0] ?? 0;
    const record = byKey.get(item.vaccineKey);
    const scheduledIso = record?.scheduled_at ?? addMonths(birthDate, months);
    const administeredAt = record?.administered_at ?? null;

    return {
      vaccineKey: item.vaccineKey,
      label: item.label,
      disease: item.disease,
      scheduledAt: scheduledIso,
      administeredAt,
      daysUntil: daysUntil(scheduledIso),
      isDone: Boolean(administeredAt),
      isCustom: false,
      facilityName: record?.facility_name ?? null,
      productName: record?.product_name ?? null,
      notes: record?.notes ?? null,
    };
  });

  const scheduleKeys = new Set(schedule.map((item) => item.vaccineKey));
  const customViews = records
    .filter((record) => !scheduleKeys.has(record.vaccine_key))
    .map((record) => ({
      vaccineKey: record.vaccine_key,
      label: record.custom_label?.trim() || record.vaccine_key,
      disease: '',
      scheduledAt: record.scheduled_at ?? '',
      administeredAt: record.administered_at,
      daysUntil: 0,
      isDone: Boolean(record.administered_at),
      isCustom: true,
      facilityName: record.facility_name,
      productName: record.product_name,
      notes: record.notes,
    }));

  return [...scheduledViews, ...customViews];
}
