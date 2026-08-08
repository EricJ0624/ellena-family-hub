import type { LangCode } from '@/lib/language-fonts';

export type PictureFindTranslations = {
  entry_title: string;
  entry_subtitle: string;
  entry_start: string;
  modal_close: string;
  back: string;
  mode_title: string;
  mode_hidden: string;
  mode_hidden_desc: string;
  mode_spot_diff: string;
  mode_spot_diff_desc: string;
  scenes_title: string;
  scenes_system: string;
  scenes_empty: string;
  loading: string;
  timer_label: string;
  hints_label: string;
  found_label: string;
  hint_button: string;
  hint_none_left: string;
  wrong_tap: string;
  time_up: string;
  result_title: string;
  result_found: string;
  result_time: string;
  result_hints: string;
  play_again: string;
  pick_another: string;
  change_mode: string;
  left_image: string;
  right_image: string;
};

const ko: PictureFindTranslations = {
  entry_title: '그림 찾기',
  entry_subtitle: '숨은그림 · 틀린그림',
  entry_start: '시작하기',
  modal_close: '닫기',
  back: '뒤로',
  mode_title: '어떤 게임을 할까요?',
  mode_hidden: '숨은그림찾기',
  mode_hidden_desc: '그림 속에 숨은 물건을 찾아보세요.',
  mode_spot_diff: '틀린그림찾기',
  mode_spot_diff_desc: '두 그림에서 다른 부분을 찾아보세요.',
  scenes_title: '그림을 선택하세요',
  scenes_system: '기본 그림',
  scenes_empty: '플레이할 그림이 없습니다.',
  loading: '불러오는 중…',
  timer_label: '남은 시간',
  hints_label: '힌트',
  found_label: '찾음',
  hint_button: '힌트',
  hint_none_left: '힌트를 모두 사용했습니다.',
  wrong_tap: '여기엔 없어요. 다시 찾아보세요!',
  time_up: '시간 종료!',
  result_title: '결과',
  result_found: '{found}/{total}개 찾음',
  result_time: '남은 시간 {seconds}초',
  result_hints: '힌트 {used}회 사용',
  play_again: '다시 하기',
  pick_another: '다른 그림',
  change_mode: '모드 변경',
  left_image: '원본',
  right_image: '비교',
};

const en: PictureFindTranslations = {
  entry_title: 'Picture Find',
  entry_subtitle: 'Hidden · Spot the difference',
  entry_start: 'Start',
  modal_close: 'Close',
  back: 'Back',
  mode_title: 'Choose a game',
  mode_hidden: 'Hidden objects',
  mode_hidden_desc: 'Find hidden items in the scene.',
  mode_spot_diff: 'Spot the difference',
  mode_spot_diff_desc: 'Find differences between two pictures.',
  scenes_title: 'Pick a scene',
  scenes_system: 'Default scenes',
  scenes_empty: 'No scenes available.',
  loading: 'Loading…',
  timer_label: 'Time left',
  hints_label: 'Hints',
  found_label: 'Found',
  hint_button: 'Hint',
  hint_none_left: 'No hints left.',
  wrong_tap: 'Not here. Try again!',
  time_up: "Time's up!",
  result_title: 'Results',
  result_found: 'Found {found}/{total}',
  result_time: '{seconds}s remaining',
  result_hints: '{used} hints used',
  play_again: 'Play again',
  pick_another: 'Another scene',
  change_mode: 'Change mode',
  left_image: 'Original',
  right_image: 'Compare',
};

const pictureFind: Record<LangCode, PictureFindTranslations> = {
  ko,
  en,
  ja: en,
  'zh-CN': en,
  'zh-TW': en,
  es: en,
  fr: en,
  de: en,
  it: en,
  pt: en,
};

export function getPictureFindTranslation(lang: LangCode, key: keyof PictureFindTranslations): string {
  return pictureFind[lang]?.[key] ?? pictureFind.en[key];
}

export function formatPictureFindText(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    template,
  );
}
