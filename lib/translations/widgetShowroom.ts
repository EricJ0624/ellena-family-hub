import type { LangCode } from '@/lib/language-fonts';
import { LANG_CODES } from '@/lib/language-fonts';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

export type WidgetShowroomTranslations = {
  welcome_title: string;
  welcome_body: string;
  select_prompt: string;
  swipe_hint: string;
  add: string;
  added: string;
  /** 지나감 대체 — 이용 설명 애니메이션 */
  preview: string;
  demo_close: string;
  demo_playing: string;
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
  howto_tasks_1: string;
  howto_tasks_2: string;
  howto_tasks_3: string;
  howto_calendar_1: string;
  howto_calendar_2: string;
  howto_calendar_3: string;
  howto_chat_1: string;
  howto_chat_2: string;
  howto_chat_3: string;
  howto_piggy_1: string;
  howto_piggy_2: string;
  howto_piggy_3: string;
  howto_travel_1: string;
  howto_travel_2: string;
  howto_travel_3: string;
  howto_travel_diary_1: string;
  howto_travel_diary_2: string;
  howto_travel_diary_3: string;
  howto_travel_quick_record_1: string;
  howto_travel_quick_record_2: string;
  howto_travel_quick_record_3: string;
  howto_album_1: string;
  howto_album_2: string;
  howto_album_3: string;
  howto_location_1: string;
  howto_location_2: string;
  howto_location_3: string;
  howto_games_1: string;
  howto_games_2: string;
  howto_games_3: string;
};

const ko: WidgetShowroomTranslations = {
  welcome_title: '그룹에 오신 걸 환영해요!',
  welcome_body: '가족 대시보드에 넣을 기능을 골라 보세요.',
  select_prompt: '필요한 기능을 선택해서 추가하세요',
  swipe_hint: '좌우로 밀어 넘기기',
  add: '추가',
  added: '추가됨',
  preview: '미리보기',
  demo_close: '닫기',
  demo_playing: '이렇게 사용해요',
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
  howto_tasks_1: '할 일을 적고 담당 가족을 정해요.',
  howto_tasks_2: '끝나면 체크해서 함께 확인해요.',
  howto_tasks_3: '칠판처럼 한눈에 남는 가족 임무판이에요.',
  howto_calendar_1: '날짜를 눌러 일정을 추가해요.',
  howto_calendar_2: '스티커로 특별한 날을 표시해요.',
  howto_calendar_3: '가족과 같은 달력을 공유해요.',
  howto_chat_1: '가족 채팅으로 바로 대화해요.',
  howto_chat_2: '사진·파일을 붙여 보낼 수 있어요.',
  howto_chat_3: '중요한 말은 채팅에 남겨 두세요.',
  howto_piggy_1: '지갑과 은행 잔고를 나눠 관리해요.',
  howto_piggy_2: '관리에서 용돈·저금을 조정해요.',
  howto_piggy_3: '아이 계정도 함께 볼 수 있어요.',
  howto_travel_1: '여행을 만들고 날짜를 정해요.',
  howto_travel_2: '숙소·관광·식사를 Day별로 짜요.',
  howto_travel_3: '경비까지 한곳에서 정리해요.',
  howto_travel_diary_1: '여행 중 순간을 일기로 남겨요.',
  howto_travel_diary_2: '사진·별점·경로를 붙일 수 있어요.',
  howto_travel_diary_3: '끝난 여행도 추억으로 다시 봐요.',
  howto_travel_quick_record_1: '지금 위치를 한 번에 기록해요.',
  howto_travel_quick_record_2: '이동 루트를 녹음하듯 남겨요.',
  howto_travel_quick_record_3: '길 위에서 빠르게 남기고 나중에 정리해요.',
  howto_album_1: '가족 사진을 앨범에 모아요.',
  howto_album_2: '페이지를 넘기며 추억을 봐요.',
  howto_album_3: '전체보기로 더 크게 즐길 수 있어요.',
  howto_location_1: '어디야·일루와·나여기로 위치를 나눠요.',
  howto_location_2: '지도에서 가족 위치를 확인해요.',
  howto_location_3: '필요할 때만 안전하게 공유해요.',
  howto_games_1: '사다리·가위바위보·룰렛을 골라요.',
  howto_games_2: '당번·메뉴 같은 결정을 재미있게 해요.',
  howto_games_3: '가족과 가벼운 게임으로 풀어 보세요.',
};

const en: WidgetShowroomTranslations = {
  welcome_title: 'Welcome to your group!',
  welcome_body: 'Pick the features you want on your family dashboard.',
  select_prompt: 'Select the features you need and add them',
  swipe_hint: 'Swipe left or right',
  add: 'Add',
  added: 'Added',
  preview: 'Preview',
  demo_close: 'Close',
  demo_playing: 'How it works',
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
  howto_tasks_1: 'Add a task and assign a family member.',
  howto_tasks_2: 'Check it off when it’s done.',
  howto_tasks_3: 'A shared chalkboard for family chores.',
  howto_calendar_1: 'Tap a date to add an event.',
  howto_calendar_2: 'Mark special days with stickers.',
  howto_calendar_3: 'Share one calendar with the family.',
  howto_chat_1: 'Chat with your family instantly.',
  howto_chat_2: 'Send photos and files too.',
  howto_chat_3: 'Keep important notes in the chat.',
  howto_piggy_1: 'Track wallet and bank balances.',
  howto_piggy_2: 'Manage allowance in Admin.',
  howto_piggy_3: 'Kids’ accounts stay visible together.',
  howto_travel_1: 'Create a trip and set dates.',
  howto_travel_2: 'Plan stays, sights, and meals by day.',
  howto_travel_3: 'Keep expenses in one place.',
  howto_travel_diary_1: 'Save trip moments as a diary.',
  howto_travel_diary_2: 'Add photos, ratings, and routes.',
  howto_travel_diary_3: 'Revisit finished trips anytime.',
  howto_travel_quick_record_1: 'Log your location in one tap.',
  howto_travel_quick_record_2: 'Record the route as you go.',
  howto_travel_quick_record_3: 'Capture on the road, tidy later.',
  howto_album_1: 'Collect family photos in an album.',
  howto_album_2: 'Flip pages to browse memories.',
  howto_album_3: 'Open View all for a bigger look.',
  howto_location_1: 'Share with Where / Come / I’m here.',
  howto_location_2: 'See family pins on the map.',
  howto_location_3: 'Share only when you need to.',
  howto_games_1: 'Pick ladder, RPS, or roulette.',
  howto_games_2: 'Decide chores or menus playfully.',
  howto_games_3: 'Light games for the whole family.',
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

const HOWTO_KEYS: Record<
  DashboardWidgetKey,
  [
    keyof WidgetShowroomTranslations,
    keyof WidgetShowroomTranslations,
    keyof WidgetShowroomTranslations,
  ]
> = {
  tasks: ['howto_tasks_1', 'howto_tasks_2', 'howto_tasks_3'],
  calendar: ['howto_calendar_1', 'howto_calendar_2', 'howto_calendar_3'],
  chat: ['howto_chat_1', 'howto_chat_2', 'howto_chat_3'],
  piggy: ['howto_piggy_1', 'howto_piggy_2', 'howto_piggy_3'],
  travel: ['howto_travel_1', 'howto_travel_2', 'howto_travel_3'],
  travel_diary: ['howto_travel_diary_1', 'howto_travel_diary_2', 'howto_travel_diary_3'],
  travel_quick_record: [
    'howto_travel_quick_record_1',
    'howto_travel_quick_record_2',
    'howto_travel_quick_record_3',
  ],
  album: ['howto_album_1', 'howto_album_2', 'howto_album_3'],
  location: ['howto_location_1', 'howto_location_2', 'howto_location_3'],
  games: ['howto_games_1', 'howto_games_2', 'howto_games_3'],
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

export function getWidgetShowroomHowtoSteps(
  lang: LangCode,
  key: DashboardWidgetKey,
): [string, string, string] {
  const [a, b, c] = HOWTO_KEYS[key];
  return [
    getWidgetShowroomTranslation(lang, a),
    getWidgetShowroomTranslation(lang, b),
    getWidgetShowroomTranslation(lang, c),
  ];
}
