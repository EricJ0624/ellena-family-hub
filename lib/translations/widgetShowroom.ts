import type { LangCode } from '@/lib/language-fonts';
import { LANG_CODES } from '@/lib/language-fonts';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

export type WidgetShowroomTranslations = {
  welcome_title: string;
  welcome_body: string;
  select_prompt: string;
  add: string;
  added: string;
  skip: string;
  selected_count: string;
  start_dashboard: string;
  min_one: string;
  saving: string;
  tip_title: string;
  tip_body: string;
  tip_path: string;
  tip_continue: string;
  tip_open_admin: string;
  save_error: string;
  blurb_tasks: string;
  blurb_calendar: string;
  blurb_chat: string;
  blurb_piggy: string;
  blurb_travel: string;
  blurb_travel_diary: string;
  blurb_travel_quick_record: string;
  blurb_album: string;
  blurb_location: string;
  blurb_games: string;
};

const ko: WidgetShowroomTranslations = {
  welcome_title: '그룹에 오신 걸 환영해요!',
  welcome_body: '가족 대시보드에 넣을 기능을 골라 보세요.',
  select_prompt: '필요한 기능을 선택해서 추가하세요',
  add: '추가',
  added: '추가됨',
  skip: '지나감',
  selected_count: '선택 {n}개',
  start_dashboard: '대시보드 시작',
  min_one: '위젯을 하나 이상 선택해 주세요.',
  saving: '저장 중…',
  tip_title: '나중에 바꾸고 싶다면',
  tip_body: '위젯을 다시 켜거나 끄고, 크기·위치를 바꾸려면 그룹 관리에서 설정할 수 있어요.',
  tip_path: '설정(⚙️) → 그룹 관리 → 대시보드 위젯',
  tip_continue: '확인했어요',
  tip_open_admin: '그룹 관리 열기',
  save_error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  blurb_tasks: '가족 할 일을 체크하고 역할을 나눠요.',
  blurb_calendar: '일정을 한눈에 보고 함께 맞춰요.',
  blurb_chat: '가족끼리 바로 대화해요.',
  blurb_piggy: '용돈·저금을 가족과 함께 관리해요.',
  blurb_travel: '여행 일정·숙소·경비를 한곳에서 짜요.',
  blurb_travel_diary: '여행의 순간을 일기처럼 남겨요.',
  blurb_travel_quick_record: '길에서 체크인·동선을 빠르게 남겨요.',
  blurb_album: '가족 사진을 모아 추억을 나눠요.',
  blurb_location: '서로의 위치를 안전하게 확인해요.',
  blurb_games: '가족과 가벼운 게임으로 즐겨요.',
};

const en: WidgetShowroomTranslations = {
  welcome_title: 'Welcome to your group!',
  welcome_body: 'Pick the features you want on your family dashboard.',
  select_prompt: 'Select the features you need and add them',
  add: 'Add',
  added: 'Added',
  skip: 'Skip',
  selected_count: '{n} selected',
  start_dashboard: 'Start dashboard',
  min_one: 'Please select at least one widget.',
  saving: 'Saving…',
  tip_title: 'Want to change later?',
  tip_body: 'You can turn widgets on or off and adjust size and layout in group admin.',
  tip_path: 'Settings (⚙️) → Group admin → Dashboard widgets',
  tip_continue: 'Got it',
  tip_open_admin: 'Open group admin',
  save_error: 'Could not save. Please try again.',
  blurb_tasks: 'Share and check off family to-dos.',
  blurb_calendar: 'See and sync your family schedule.',
  blurb_chat: 'Chat with your family in one place.',
  blurb_piggy: 'Manage allowance and savings together.',
  blurb_travel: 'Plan trips, stays, and expenses.',
  blurb_travel_diary: 'Keep a diary of trip moments.',
  blurb_travel_quick_record: 'Quick check-ins and routes on the go.',
  blurb_album: 'Collect and share family photos.',
  blurb_location: 'Check each other’s location safely.',
  blurb_games: 'Play light games together.',
};

const widgetShowroom = Object.fromEntries(
  LANG_CODES.map((code) => [code, code === 'ko' ? ko : en]),
) as Record<LangCode, WidgetShowroomTranslations>;

const BLURB_KEY: Record<DashboardWidgetKey, keyof WidgetShowroomTranslations> = {
  tasks: 'blurb_tasks',
  calendar: 'blurb_calendar',
  chat: 'blurb_chat',
  piggy: 'blurb_piggy',
  travel: 'blurb_travel',
  travel_diary: 'blurb_travel_diary',
  travel_quick_record: 'blurb_travel_quick_record',
  album: 'blurb_album',
  location: 'blurb_location',
  games: 'blurb_games',
};

export function getWidgetShowroomTranslation(
  lang: LangCode,
  key: keyof WidgetShowroomTranslations,
): string {
  return widgetShowroom[lang]?.[key] ?? widgetShowroom.en[key] ?? widgetShowroom.ko[key] ?? key;
}

export function getWidgetShowroomBlurb(lang: LangCode, key: DashboardWidgetKey): string {
  return getWidgetShowroomTranslation(lang, BLURB_KEY[key]);
}
