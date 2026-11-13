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
  start_locked: string;
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
  blurb_family_log: string;
  blurb_album: string;
  blurb_location: string;
  blurb_games: string;
  howto_tasks_1: string;
  howto_tasks_2: string;
  howto_tasks_3: string;
  howto_tasks_4: string;
  howto_tasks_5: string;
  howto_tasks_6: string;
  howto_tasks_7: string;
  howto_calendar_1: string;
  howto_calendar_2: string;
  howto_calendar_3: string;
  howto_calendar_4: string;
  howto_calendar_5: string;
  howto_calendar_6: string;
  demo_calendar_event: string;
  demo_calendar_desc: string;
  howto_chat_1: string;
  howto_chat_2: string;
  howto_chat_3: string;
  howto_chat_4: string;
  howto_chat_5: string;
  howto_chat_6: string;
  demo_chat_welcome_1: string;
  demo_chat_welcome_2: string;
  demo_chat_request: string;
  demo_chat_reply: string;
  howto_piggy_1: string;
  howto_piggy_2: string;
  howto_piggy_3: string;
  howto_piggy_4: string;
  howto_piggy_5: string;
  howto_piggy_6: string;
  howto_piggy_7: string;
  howto_piggy_8: string;
  demo_piggy_child: string;
  demo_piggy_admin_sub: string;
  demo_piggy_currency_title: string;
  demo_piggy_currency_hint: string;
  demo_piggy_currency_save: string;
  demo_piggy_select_child: string;
  demo_piggy_pay_title: string;
  demo_piggy_pay_btn: string;
  demo_piggy_month_allowance: string;
  demo_piggy_deposit_title: string;
  demo_piggy_deposit_btn: string;
  demo_piggy_deposit_memo: string;
  demo_piggy_expense_title: string;
  demo_piggy_expense_btn: string;
  demo_piggy_expense_category: string;
  demo_piggy_expense_memo: string;
  demo_piggy_history_title: string;
  demo_piggy_pay_history: string;
  demo_piggy_expense_history: string;
  demo_piggy_deposit_history: string;
  howto_travel_1: string;
  howto_travel_2: string;
  howto_travel_3: string;
  howto_travel_diary_1: string;
  howto_travel_diary_2: string;
  howto_travel_diary_3: string;
  howto_travel_quick_record_1: string;
  howto_travel_quick_record_2: string;
  howto_travel_quick_record_3: string;
  howto_family_log_1: string;
  howto_family_log_2: string;
  howto_family_log_3: string;
  howto_family_log_4: string;
  howto_family_log_5: string;
  howto_family_log_6: string;
  howto_family_log_7: string;
  howto_family_log_8: string;
  howto_family_log_9: string;
  demo_family_log_title_label: string;
  demo_family_log_title: string;
  demo_family_log_note: string;
  demo_family_log_revisit: string;
  demo_family_log_map_hint: string;
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
  start_locked: '마지막 위젯까지 넘긴 뒤에 시작할 수 있어요.',
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
  blurb_family_log: '하루의 장소와 길을 카드로 남겨요.',
  blurb_album: '가족 사진을 모아 추억을 나눠요.',
  blurb_location: '서로의 위치를 안전하게 확인해요.',
  blurb_games: '가족과 가벼운 게임으로 즐겨요.',
  howto_tasks_1: '칠판에서 가족 할 일을 확인해요.',
  howto_tasks_2: '추가를 눌러 할 일 내용을 적어요.',
  howto_tasks_3: '누가 할지 정하고 등록해요.',
  howto_tasks_4: '새 할 일이 칠판 맨 위에 올라와요.',
  howto_tasks_5: '내가 할게요를 누르면 담당이 정해져요.',
  howto_tasks_6: '끝나면 체크하고 취소선이 그어져요.',
  howto_tasks_7: '삭제할지 물어본 뒤, 취소하면 할 일은 남아요.',
  howto_calendar_1: '12월 달력에서 25일을 눌러요.',
  howto_calendar_2: '그 날 일정이 없으면 빈 목록이 열려요.',
  howto_calendar_3: '제목에 생일을 적어요.',
  howto_calendar_4: '설명도 함께 적어요.',
  howto_calendar_5: '매년 반복을 고르고 추가해요.',
  howto_calendar_6: '생일 스티커와 일정 카드가 올라와요.',
  demo_calendar_event: '엄마 생일',
  demo_calendar_desc: '축하 드려요 ~',
  howto_chat_1: '채팅창에서 가족 메시지를 확인해요.',
  howto_chat_2: '입력창에 부탁 메시지를 적어요.',
  howto_chat_3: '전송하면 새 메시지가 올라와요.',
  howto_chat_4: '메시지에서 할 일·일정을 바로 추가할 수 있어요.',
  howto_chat_5: '답장을 입력해요.',
  howto_chat_6: '답장이 오고 대화가 이어져요.',
  demo_chat_welcome_1: '안녕하세요 ~ 하쓰 패밀리 입니다.',
  demo_chat_welcome_2: '행복한 시간 기록 하세요 ~',
  demo_chat_request: '연아야 이따가 올때 음료수좀 사올래 ?',
  demo_chat_reply: '네 집 근처에서 사갈께요 ~',
  howto_piggy_1: '저금통이 없으면 위젯에서 추가를 눌러요.',
  howto_piggy_2: '전체 관리에서 통화를 확인해요.',
  howto_piggy_3: '아이를 골라 저금통 화면으로 가요.',
  howto_piggy_4: '용돈을 주고 저금통에 입금해요.',
  howto_piggy_5: '위젯에 용돈·저금통 잔액이 보여요.',
  howto_piggy_6: '지출을 기록해요.',
  howto_piggy_7: '내역에 입금·지출이 쌓여요.',
  howto_piggy_8: '최종 잔액이 위젯에 반영돼요.',
  demo_piggy_child: '똘비',
  demo_piggy_admin_sub: '아이별 저금통',
  demo_piggy_currency_title: 'Piggy Bank 통화 (그룹)',
  demo_piggy_currency_hint: 'ISO 4217 코드 · 모든 저금통에 동일하게 적용됩니다.',
  demo_piggy_currency_save: '통화 저장',
  demo_piggy_select_child: '아이 선택',
  demo_piggy_pay_title: '용돈 지급',
  demo_piggy_pay_btn: '용돈 지급',
  demo_piggy_month_allowance: '이번달 용돈',
  demo_piggy_deposit_title: '저금통 입금',
  demo_piggy_deposit_btn: '저축 입금',
  demo_piggy_deposit_memo: '저금통에 모으기',
  demo_piggy_expense_title: '지출 기록',
  demo_piggy_expense_btn: '지출 기록',
  demo_piggy_expense_category: '동네슈퍼',
  demo_piggy_expense_memo: '간식과 음료',
  demo_piggy_history_title: '용돈·저금통 내역',
  demo_piggy_pay_history: '용돈 지급',
  demo_piggy_expense_history: '지출',
  demo_piggy_deposit_history: '저금통 입금',
  howto_travel_1: '여행을 만들고 날짜를 정해요.',
  howto_travel_2: '숙소·관광·식사를 Day별로 짜요.',
  howto_travel_3: '경비까지 한곳에서 정리해요.',
  howto_travel_diary_1: '여행 중 순간을 일기로 남겨요.',
  howto_travel_diary_2: '사진·별점·경로를 붙일 수 있어요.',
  howto_travel_diary_3: '끝난 여행도 추억으로 다시 봐요.',
  howto_travel_quick_record_1: '지금 위치를 한 번에 기록해요.',
  howto_travel_quick_record_2: '이동 루트를 녹음하듯 남겨요.',
  howto_travel_quick_record_3: '길 위에서 빠르게 남기고 나중에 정리해요.',
  howto_family_log_1: '기록이 없으면 여기 기록으로 새 카드를 만들어요.',
  howto_family_log_2: '제목을 입력해요.',
  howto_family_log_3: '사진을 고르거나 앨범에서 넣어요.',
  howto_family_log_4: '메모와 기분을 남겨요.',
  howto_family_log_5: '별점·사진 스타일·지도를 골라요.',
  howto_family_log_6: '영수증을 첨부할 수 있어요.',
  howto_family_log_7: '경비와 다시 가고 싶어요를 채워요.',
  howto_family_log_8: '저장을 누르면 카드가 완성돼요.',
  howto_family_log_9: '저장된 카드에서 사진·지도·경비를 다시 봐요.',
  demo_family_log_title_label: '제목',
  demo_family_log_title: '집 근처 카페',
  demo_family_log_note: '가족모임 저녁식사. 분위기가 참 좋았어요.',
  demo_family_log_revisit: '다시 가고 싶어요',
  demo_family_log_map_hint: '지도 미리보기',
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
  start_locked: 'Go to the last widget to start.',
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
  blurb_family_log: 'Keep places and routes as daily cards.',
  blurb_album: 'Collect and share family photos.',
  blurb_location: 'Check each other’s location safely.',
  blurb_games: 'Play light games together.',
  howto_tasks_1: 'Review family tasks on the board.',
  howto_tasks_2: 'Tap Add and write the task.',
  howto_tasks_3: 'Choose who will do it, then save.',
  howto_tasks_4: 'The new task appears at the top of the board.',
  howto_tasks_5: 'Tap I’ll do it to claim the task.',
  howto_tasks_6: 'Check it off and a line goes through the words.',
  howto_tasks_7: 'Delete asks first. Cancel keeps the task.',
  howto_calendar_1: 'Tap the 25th on the December calendar.',
  howto_calendar_2: 'An empty list opens when that day has no events.',
  howto_calendar_3: 'Type the birthday title.',
  howto_calendar_4: 'Add a short note too.',
  howto_calendar_5: 'Choose yearly, then tap Add.',
  howto_calendar_6: 'A birthday sticker and the event card appear.',
  demo_calendar_event: "Mom's birthday",
  demo_calendar_desc: 'Congratulations ~',
  howto_chat_1: 'Open family chat and read the messages.',
  howto_chat_2: 'Type a request in the message box.',
  howto_chat_3: 'Send it and the new bubble appears.',
  howto_chat_4: 'Add a task or event right from the message.',
  howto_chat_5: 'Type a reply.',
  howto_chat_6: 'The reply arrives and the chat continues.',
  demo_chat_welcome_1: 'Hello ~ Welcome to Hearth Family.',
  demo_chat_welcome_2: 'Record your happy moments ~',
  demo_chat_request: 'Yeona, can you grab drinks on the way?',
  demo_chat_reply: 'Sure, I’ll buy them near home ~',
  howto_piggy_1: 'If there is no piggy bank, tap Add on the widget.',
  howto_piggy_2: 'Check the group currency in Manage all.',
  howto_piggy_3: 'Pick a child to open their piggy bank.',
  howto_piggy_4: 'Pay allowance and deposit into the piggy bank.',
  howto_piggy_5: 'Wallet and piggy balances show on the widget.',
  howto_piggy_6: 'Record spending.',
  howto_piggy_7: 'Deposits and expenses appear in the history.',
  howto_piggy_8: 'The widget shows the updated balances.',
  demo_piggy_child: 'Tolbi',
  demo_piggy_admin_sub: 'Piggy bank by child',
  demo_piggy_currency_title: 'Piggy Bank currency (group)',
  demo_piggy_currency_hint: 'ISO 4217 code · Applied to every piggy bank.',
  demo_piggy_currency_save: 'Save currency',
  demo_piggy_select_child: 'Select child',
  demo_piggy_pay_title: 'Pay allowance',
  demo_piggy_pay_btn: 'Pay allowance',
  demo_piggy_month_allowance: 'This month’s allowance',
  demo_piggy_deposit_title: 'Piggy bank deposit',
  demo_piggy_deposit_btn: 'Deposit savings',
  demo_piggy_deposit_memo: 'Save in the piggy bank',
  demo_piggy_expense_title: 'Record expense',
  demo_piggy_expense_btn: 'Record expense',
  demo_piggy_expense_category: 'Local market',
  demo_piggy_expense_memo: 'Snacks and drinks',
  demo_piggy_history_title: 'Allowance & piggy history',
  demo_piggy_pay_history: 'Allowance paid',
  demo_piggy_expense_history: 'Spending',
  demo_piggy_deposit_history: 'Piggy deposit',
  howto_travel_1: 'Create a trip and set dates.',
  howto_travel_2: 'Plan stays, sights, and meals by day.',
  howto_travel_3: 'Keep expenses in one place.',
  howto_travel_diary_1: 'Save trip moments as a diary.',
  howto_travel_diary_2: 'Add photos, ratings, and routes.',
  howto_travel_diary_3: 'Revisit finished trips anytime.',
  howto_travel_quick_record_1: 'Log your location in one tap.',
  howto_travel_quick_record_2: 'Record the route as you go.',
  howto_travel_quick_record_3: 'Capture on the road, tidy later.',
  howto_family_log_1: 'If empty, tap Log here to start a card.',
  howto_family_log_2: 'Type a title for the place.',
  howto_family_log_3: 'Add photos from the camera or album.',
  howto_family_log_4: 'Write a note and pick moods.',
  howto_family_log_5: 'Set rating, photo style, and the map.',
  howto_family_log_6: 'You can attach a receipt.',
  howto_family_log_7: 'Fill expense and “want to revisit”.',
  howto_family_log_8: 'Tap Save to finish the card.',
  howto_family_log_9: 'Open the card to see photos, map, and expense.',
  demo_family_log_title_label: 'Title',
  demo_family_log_title: 'Cafe near home',
  demo_family_log_note: 'Family dinner. The vibe was wonderful.',
  demo_family_log_revisit: 'Want to go again',
  demo_family_log_map_hint: 'Map preview',
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

/** 쇼룸 문장을 그 언어로 가지고 있는 코드. 나머지는 영어 문장으로 채운다. */
const NATIVE_SHOWROOM_LANGS = new Set<LangCode>(['ko', 'en']);

export function hasNativeShowroomCopy(lang: LangCode): boolean {
  return NATIVE_SHOWROOM_LANGS.has(lang);
}

const BLURB_KEY: Record<DashboardWidgetKey, keyof WidgetShowroomTranslations> = {
  tasks: 'blurb_tasks',
  calendar: 'blurb_calendar',
  chat: 'blurb_chat',
  piggy: 'blurb_piggy',
  travel: 'blurb_travel',
  travel_diary: 'blurb_travel_diary',
  travel_quick_record: 'blurb_travel_quick_record',
  family_log: 'blurb_family_log',
  album: 'blurb_album',
  location: 'blurb_location',
  games: 'blurb_games',
  baby_growth: 'blurb_family_log', // baby_growth 전용 번역키 없을 때 family_log 블러브 임시 사용
};

const TASKS_HOWTO_KEYS = [
  'howto_tasks_1',
  'howto_tasks_2',
  'howto_tasks_3',
  'howto_tasks_4',
  'howto_tasks_5',
  'howto_tasks_6',
  'howto_tasks_7',
] as const satisfies readonly (keyof WidgetShowroomTranslations)[];

/** 영상 기준 할 일 쇼룸: 칠판 → 입력 → 담당 → 등록 → 맡기 → 체크 → 삭제 확인 */
export const TASKS_SHOWROOM_STEP_MS = [2500, 3400, 2500, 2500, 1700, 2500, 2500] as const;

const CALENDAR_HOWTO_KEYS = [
  'howto_calendar_1',
  'howto_calendar_2',
  'howto_calendar_3',
  'howto_calendar_4',
  'howto_calendar_5',
  'howto_calendar_6',
] as const satisfies readonly (keyof WidgetShowroomTranslations)[];

/** 영상 기준 달력 쇼룸: 25일 → 빈 목록 → 제목 → 설명 → 매년 반복 → 스티커 */
export const CALENDAR_SHOWROOM_STEP_MS = [1800, 2000, 3200, 3200, 2200, 3600] as const;

const CHAT_HOWTO_KEYS = [
  'howto_chat_1',
  'howto_chat_2',
  'howto_chat_3',
  'howto_chat_4',
  'howto_chat_5',
  'howto_chat_6',
] as const satisfies readonly (keyof WidgetShowroomTranslations)[];

/** 영상 기준 채팅 쇼룸: 확인 → 입력 → 전송 → 칩 → 답장 입력 → 답장 */
export const CHAT_SHOWROOM_STEP_MS = [2000, 3600, 2200, 2200, 3600, 3000] as const;

const PIGGY_HOWTO_KEYS = [
  'howto_piggy_1',
  'howto_piggy_2',
  'howto_piggy_3',
  'howto_piggy_4',
  'howto_piggy_5',
  'howto_piggy_6',
  'howto_piggy_7',
  'howto_piggy_8',
] as const satisfies readonly (keyof WidgetShowroomTranslations)[];

/** 영상 기준 저금통 쇼룸: 빈 위젯 → 통화 → 아이 → 입금 → 잔액 → 지출 → 내역 → 최종 */
export const PIGGY_SHOWROOM_STEP_MS = [2000, 2400, 2200, 3800, 2400, 3200, 2800, 3000] as const;

const FAMILY_LOG_HOWTO_KEYS = [
  'howto_family_log_1',
  'howto_family_log_2',
  'howto_family_log_3',
  'howto_family_log_4',
  'howto_family_log_5',
  'howto_family_log_6',
  'howto_family_log_7',
  'howto_family_log_8',
  'howto_family_log_9',
] as const satisfies readonly (keyof WidgetShowroomTranslations)[];

/** 영상 기준 가족 로그: 빈 → 제목 → 사진 → 메모 → 별점 → 영수증 → 경비 → 저장 → 카드 */
export const FAMILY_LOG_SHOWROOM_STEP_MS = [
  2000, 3600, 2400, 3600, 2800, 2200, 2600, 2200, 3200,
] as const;

const HOWTO_KEYS: Record<
  Exclude<DashboardWidgetKey, 'tasks' | 'calendar' | 'chat' | 'piggy' | 'family_log' | 'baby_growth'>,
  [
    keyof WidgetShowroomTranslations,
    keyof WidgetShowroomTranslations,
    keyof WidgetShowroomTranslations,
  ]
> = {
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

export function getWidgetShowroomHowtoSteps(lang: LangCode, key: DashboardWidgetKey): string[] {
  if (key === 'tasks') {
    return TASKS_HOWTO_KEYS.map((stepKey) => getWidgetShowroomTranslation(lang, stepKey));
  }
  if (key === 'calendar') {
    return CALENDAR_HOWTO_KEYS.map((stepKey) => getWidgetShowroomTranslation(lang, stepKey));
  }
  if (key === 'chat') {
    return CHAT_HOWTO_KEYS.map((stepKey) => getWidgetShowroomTranslation(lang, stepKey));
  }
  if (key === 'piggy') {
    return PIGGY_HOWTO_KEYS.map((stepKey) => getWidgetShowroomTranslation(lang, stepKey));
  }
  if (key === 'family_log' || key === 'baby_growth') {
    return FAMILY_LOG_HOWTO_KEYS.map((stepKey) => getWidgetShowroomTranslation(lang, stepKey));
  }
  const [a, b, c] = HOWTO_KEYS[key as keyof typeof HOWTO_KEYS];
  return [
    getWidgetShowroomTranslation(lang, a),
    getWidgetShowroomTranslation(lang, b),
    getWidgetShowroomTranslation(lang, c),
  ];
}
