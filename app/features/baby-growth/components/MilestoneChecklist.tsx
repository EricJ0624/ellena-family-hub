'use client';

/**
 * 발달 마일스톤 정의 데이터 — GrowthChartView와 공유
 */
import type { MilestoneCategory } from '../types';

export interface MilestoneDefinition {
  key: string;
  label: string;
  category: MilestoneCategory;
  /** [최소 월령, 일반적 월령] */
  typicalMonths: [number, number];
}

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  // 운동 발달
  { key: 'tummy_time', label: '엎드려 고개 들기', category: 'motor', typicalMonths: [1, 2] },
  { key: 'head_control', label: '고개 가누기', category: 'motor', typicalMonths: [2, 4] },
  { key: 'rolls_over', label: '뒤집기', category: 'motor', typicalMonths: [3, 5] },
  { key: 'sits_with_support', label: '지지하고 앉기', category: 'motor', typicalMonths: [4, 6] },
  { key: 'sits_alone', label: '혼자 앉기', category: 'motor', typicalMonths: [6, 8] },
  { key: 'crawling', label: '기기', category: 'motor', typicalMonths: [7, 9] },
  { key: 'pulls_to_stand', label: '잡고 서기', category: 'motor', typicalMonths: [8, 10] },
  { key: 'first_steps', label: '첫 걸음', category: 'motor', typicalMonths: [10, 13] },
  { key: 'walks_alone', label: '혼자 걷기', category: 'motor', typicalMonths: [11, 14] },
  // 언어 발달
  { key: 'coo', label: '옹알이 시작', category: 'language', typicalMonths: [2, 4] },
  { key: 'babble', label: '다양한 음절 옹알이', category: 'language', typicalMonths: [5, 8] },
  { key: 'mama_dada', label: '"맘마/다다" 첫 발화', category: 'language', typicalMonths: [8, 11] },
  { key: 'first_word', label: '첫 단어', category: 'language', typicalMonths: [9, 14] },
  { key: 'two_words', label: '두 단어 연결', category: 'language', typicalMonths: [18, 24] },
  // 사회성
  { key: 'first_smile', label: '첫 미소', category: 'social', typicalMonths: [1, 3] },
  { key: 'laughs', label: '웃음소리', category: 'social', typicalMonths: [3, 5] },
  { key: 'stranger_anxiety', label: '낯가림', category: 'social', typicalMonths: [6, 9] },
  { key: 'wave_bye', label: '손 흔들기', category: 'social', typicalMonths: [9, 12] },
  { key: 'parallel_play', label: '나란히 놀기', category: 'social', typicalMonths: [18, 24] },
  // 인지
  { key: 'object_permanence', label: '물건 영속성 이해', category: 'cognitive', typicalMonths: [6, 9] },
  { key: 'points', label: '손가락 가리키기', category: 'cognitive', typicalMonths: [9, 12] },
  { key: 'stacks_blocks', label: '블록 쌓기', category: 'cognitive', typicalMonths: [12, 18] },
  // 감각
  { key: 'tracks_visually', label: '시선 추적', category: 'sensory', typicalMonths: [0, 2] },
  { key: 'responds_to_sound', label: '소리 반응', category: 'sensory', typicalMonths: [0, 2] },
  // 추가 항목
  { key: 'first_solid_food', label: '이유식 시작', category: 'motor', typicalMonths: [4, 6] },
  { key: 'pincer_grasp', label: '손가락으로 집기 (집게잡기)', category: 'motor', typicalMonths: [8, 10] },
  { key: 'first_tooth', label: '첫 이가 나옴', category: 'sensory', typicalMonths: [5, 10] },
  { key: 'sleeps_through_night', label: '통잠 성공', category: 'cognitive', typicalMonths: [3, 6] },
  { key: 'self_feeds', label: '혼자 먹기', category: 'motor', typicalMonths: [10, 14] },
];
