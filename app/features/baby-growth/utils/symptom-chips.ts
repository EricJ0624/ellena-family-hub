/** 병원 리포트·체온(아픈 날) 모달 공통 증상 칩 */
export const BABY_SYMPTOM_CHIPS = [
  '열',
  '구토',
  '설사',
  '발진',
  '기침',
  '콧물',
  '보챔',
] as const;

export type BabySymptomChip = (typeof BABY_SYMPTOM_CHIPS)[number];

export const BABY_SYMPTOM_EMOJI: Record<BabySymptomChip, string> = {
  열: '🌡️',
  구토: '🤢',
  설사: '🧷',
  발진: '🫧',
  기침: '😷',
  콧물: '🤧',
  보챔: '😣',
};
