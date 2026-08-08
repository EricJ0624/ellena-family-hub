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
  scenes_group: string;
  scenes_empty: string;
  scenes_group_empty: string;
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
  upload_open: string;
  upload_title: string;
  upload_name_label: string;
  upload_name_ph: string;
  upload_diff_auto: string;
  upload_diff_auto_desc: string;
  upload_diff_manual: string;
  upload_diff_manual_desc: string;
  upload_original: string;
  upload_variant: string;
  upload_pick: string;
  upload_camera: string;
  upload_submit: string;
  upload_uploading: string;
  upload_success: string;
  upload_need_group: string;
  upload_need_original: string;
  upload_need_variant: string;
  delete_scene: string;
  delete_confirm: string;
  delete_failed: string;
  manage_hint: string;
  family_puzzles: string;
  family_puzzles_empty: string;
  family_share: string;
  family_share_done: string;
  family_share_failed: string;
  family_share_need_db: string;
  family_play: string;
  family_played: string;
  family_attempts: string;
  leaderboard_title: string;
  leaderboard_empty: string;
  leaderboard_rank: string;
  leaderboard_me: string;
  leaderboard_loading: string;
  delete_puzzle: string;
  delete_puzzle_confirm: string;
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
  scenes_group: '우리 가족 사진',
  scenes_empty: '플레이할 그림이 없습니다.',
  scenes_group_empty: '아직 올린 가족 사진이 없습니다.',
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
  upload_open: '사진 올리기',
  upload_title: '가족 사진으로 만들기',
  upload_name_label: '이름',
  upload_name_ph: '예: 거실, 공원 나들이',
  upload_diff_auto: '자동 틀린그림 (기본)',
  upload_diff_auto_desc: '사진 1장으로 틀린그림을 자동 생성합니다.',
  upload_diff_manual: '직접 만든 쌍',
  upload_diff_manual_desc: '원본과 비교용 사진 2장을 올립니다.',
  upload_original: '원본 사진',
  upload_variant: '비교 사진 (틀린 부분)',
  upload_pick: '갤러리에서 선택',
  upload_camera: '카메라로 촬영',
  upload_submit: '저장하고 플레이',
  upload_uploading: '올리는 중…',
  upload_success: '사진이 추가되었습니다.',
  upload_need_group: '그룹을 선택한 뒤 올려 주세요.',
  upload_need_original: '원본 사진을 선택해 주세요.',
  upload_need_variant: '비교 사진을 선택해 주세요.',
  delete_scene: '삭제',
  delete_confirm: '이 가족 사진을 목록에서 제거할까요?',
  delete_failed: '삭제에 실패했습니다.',
  manage_hint: '올린 사람 또는 그룹 관리자가 삭제할 수 있습니다.',
  family_puzzles: '가족 퍼즐',
  family_puzzles_empty: '아직 공유된 가족 퍼즐이 없습니다. 플레이 후 「가족에게 공유」를 눌러 보세요.',
  family_share: '가족에게 공유',
  family_share_done: '가족 퍼즐로 공유했습니다.',
  family_share_failed: '공유에 실패했습니다.',
  family_share_need_db: '기본 폴백 그림은 공유할 수 없습니다. 목록을 새로고침해 주세요.',
  family_play: '도전하기',
  family_played: '기록 있음',
  family_attempts: '{count}명 도전',
  leaderboard_title: '가족 순위',
  leaderboard_empty: '아직 기록이 없습니다.',
  leaderboard_rank: '{rank}위',
  leaderboard_me: '나',
  leaderboard_loading: '순위 불러오는 중…',
  delete_puzzle: '퍼즐 삭제',
  delete_puzzle_confirm: '이 가족 퍼즐을 목록에서 제거할까요?',
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
  scenes_group: 'Family photos',
  scenes_empty: 'No scenes available.',
  scenes_group_empty: 'No family photos yet.',
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
  upload_open: 'Upload photo',
  upload_title: 'Make a family scene',
  upload_name_label: 'Title',
  upload_name_ph: 'e.g. Living room',
  upload_diff_auto: 'Auto differences (default)',
  upload_diff_auto_desc: 'Generate spot-the-difference from one photo.',
  upload_diff_manual: 'Custom pair',
  upload_diff_manual_desc: 'Upload original and edited photos.',
  upload_original: 'Original photo',
  upload_variant: 'Compare photo',
  upload_pick: 'Choose from gallery',
  upload_camera: 'Take photo',
  upload_submit: 'Save & play',
  upload_uploading: 'Uploading…',
  upload_success: 'Photo added.',
  upload_need_group: 'Select a group first.',
  upload_need_original: 'Please choose an original photo.',
  upload_need_variant: 'Please choose a compare photo.',
  delete_scene: 'Delete',
  delete_confirm: 'Remove this family photo from the list?',
  delete_failed: 'Failed to delete.',
  manage_hint: 'Uploader or group admin can delete.',
  family_puzzles: 'Family puzzles',
  family_puzzles_empty: 'No shared puzzles yet. Play a scene and tap “Share with family”.',
  family_share: 'Share with family',
  family_share_done: 'Shared as a family puzzle.',
  family_share_failed: 'Failed to share.',
  family_share_need_db: 'Fallback scenes cannot be shared. Please refresh the list.',
  family_play: 'Play',
  family_played: 'Played',
  family_attempts: '{count} played',
  leaderboard_title: 'Family ranking',
  leaderboard_empty: 'No scores yet.',
  leaderboard_rank: '#{rank}',
  leaderboard_me: 'You',
  leaderboard_loading: 'Loading ranking…',
  delete_puzzle: 'Remove puzzle',
  delete_puzzle_confirm: 'Remove this family puzzle from the list?',
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

export function getPictureFindTranslations(lang: LangCode): PictureFindTranslations {
  return pictureFind[lang] ?? pictureFind.en;
}

export function formatPictureFindText(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    template,
  );
}
