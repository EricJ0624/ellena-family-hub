import type { LangCode } from '@/lib/language-fonts';
import { getTravelTranslation } from '@/lib/translations/travel';

export type TravelDiaryTranslations = {
  section_title: string;
  select_group: string;
  loading: string;
  empty_pick_trip: string;
  open_diary: string;
  start_trip_diary: string;
  start_trip_failed: string;
  diary_page_title: string;
  back: string;
  trip_required: string;
  cannot_write: string;
  save: string;
  saved: string;
  save_failed: string;
  note_placeholder: string;
  mood_label: string;
  photos_label: string;
  rating_label: string;
  revisit_label: string;
  expense_label: string;
  no_slots: string;
  upload_failed: string;
};

const td: Record<LangCode, TravelDiaryTranslations> = {
  ko: {
    section_title: '여행 다이어리',
    select_group: '그룹을 선택해 주세요.',
    loading: '불러오는 중…',
    empty_pick_trip: '다이어리를 쓸 여행을 선택하세요.',
    open_diary: '다이어리 열기',
    start_trip_diary: '이 여행 다이어리 시작',
    start_trip_failed: '다이어리 시작에 실패했습니다.',
    diary_page_title: '여행 다이어리',
    back: '돌아가기',
    trip_required: '여행을 선택해 주세요.',
    cannot_write: '이 여행은 다이어리 작성이 시작되지 않았습니다.',
    save: '저장',
    saved: '저장됨',
    save_failed: '저장에 실패했습니다.',
    note_placeholder: '한 줄 평을 남겨 보세요',
    mood_label: '무드',
    photos_label: '사진',
    rating_label: '별점',
    revisit_label: '다시 가고 싶어요',
    expense_label: '실제 지출',
    no_slots: '표시할 일정이 없습니다. 플래너에서 일정을 추가해 보세요.',
    upload_failed: '사진 업로드에 실패했습니다.',
  },
  en: {
    section_title: 'Trip diary',
    select_group: 'Select a group first.',
    loading: 'Loading…',
    empty_pick_trip: 'Choose a trip for your diary.',
    open_diary: 'Open diary',
    start_trip_diary: 'Start diary for this trip',
    start_trip_failed: 'Failed to start diary.',
    diary_page_title: 'Trip diary',
    back: 'Back',
    trip_required: 'Select a trip.',
    cannot_write: 'Diary writing has not been started for this trip.',
    save: 'Save',
    saved: 'Saved',
    save_failed: 'Save failed.',
    note_placeholder: 'Add a short note',
    mood_label: 'Mood',
    photos_label: 'Photos',
    rating_label: 'Rating',
    revisit_label: 'Want to revisit',
    expense_label: 'Actual spend',
    no_slots: 'No itinerary items. Add plans in the travel planner.',
    upload_failed: 'Photo upload failed.',
  },
  ja: {
    section_title: '旅行ダイアリー',
    select_group: 'グループを選択してください。',
    loading: '読み込み中…',
    empty_pick_trip: 'ダイアリーを書く旅行を選んでください。',
    open_diary: 'ダイアリーを開く',
    start_trip_diary: 'この旅行のダイアリーを開始',
    start_trip_failed: '開始に失敗しました。',
    diary_page_title: '旅行ダイアリー',
    back: '戻る',
    trip_required: '旅行を選択してください。',
    cannot_write: 'この旅行はダイアリーが開始されていません。',
    save: '保存',
    saved: '保存しました',
    save_failed: '保存に失敗しました。',
    note_placeholder: 'ひとことを書く',
    mood_label: 'ムード',
    photos_label: '写真',
    rating_label: '評価',
    revisit_label: 'また行きたい',
    expense_label: '実際の支出',
    no_slots: '表示する予定がありません。',
    upload_failed: 'アップロードに失敗しました。',
  },
  'zh-CN': {
    section_title: '旅行日记',
    select_group: '请先选择群组。',
    loading: '加载中…',
    empty_pick_trip: '选择要写日记的旅行。',
    open_diary: '打开日记',
    start_trip_diary: '开始此旅行的日记',
    start_trip_failed: '无法开始日记。',
    diary_page_title: '旅行日记',
    back: '返回',
    trip_required: '请选择旅行。',
    cannot_write: '此旅行尚未开始写日记。',
    save: '保存',
    saved: '已保存',
    save_failed: '保存失败。',
    note_placeholder: '写一句感想',
    mood_label: '心情',
    photos_label: '照片',
    rating_label: '评分',
    revisit_label: '想再去',
    expense_label: '实际支出',
    no_slots: '没有行程可显示。',
    upload_failed: '上传失败。',
  },
  'zh-TW': {
    section_title: '旅行日記',
    select_group: '請先選擇群組。',
    loading: '載入中…',
    empty_pick_trip: '選擇要寫日記的旅行。',
    open_diary: '開啟日記',
    start_trip_diary: '開始此旅行的日記',
    start_trip_failed: '無法開始日記。',
    diary_page_title: '旅行日記',
    back: '返回',
    trip_required: '請選擇旅行。',
    cannot_write: '此旅行尚未開始撰寫日記。',
    save: '儲存',
    saved: '已儲存',
    save_failed: '儲存失敗。',
    note_placeholder: '寫一句感想',
    mood_label: '心情',
    photos_label: '照片',
    rating_label: '評分',
    revisit_label: '想再去',
    expense_label: '實際支出',
    no_slots: '沒有行程可顯示。',
    upload_failed: '上傳失敗。',
  },
};

export function getTravelDiaryTranslation(lang: LangCode, key: keyof TravelDiaryTranslations): string {
  return td[lang]?.[key] ?? td.en[key] ?? td.ko[key] ?? key;
}

export function getDiaryModalText(lang: LangCode) {
  return {
    title: getTravelTranslation(lang, 'diary_modal_title'),
    body: getTravelTranslation(lang, 'diary_modal_body'),
    yes: getTravelTranslation(lang, 'diary_modal_yes'),
    later: getTravelTranslation(lang, 'diary_modal_later'),
  };
}
