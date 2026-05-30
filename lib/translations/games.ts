import type { LangCode } from '@/lib/language-fonts';

export type GamesTranslations = {
  section_title: string;
  select_group: string;
  tab_ladder: string;
  tab_rps: string;
  tab_roulette: string;
  ladder_participants: string;
  ladder_destinations: string;
  ladder_participant_ph: string;
  ladder_destination_ph: string;
  ladder_add_pair: string;
  ladder_remove_pair: string;
  ladder_min_players: string;
  ladder_to_draw: string;
  ladder_draw_hint: string;
  ladder_drawn_by: string;
  ladder_you: string;
  ladder_start: string;
  ladder_reset: string;
  ladder_result_title: string;
  ladder_path_result: string;
  rps_player1: string;
  rps_player2: string;
  rps_rock: string;
  rps_paper: string;
  rps_scissors: string;
  rps_reveal: string;
  rps_reset: string;
  rps_pick_both: string;
  rps_animating: string;
  rps_result_win: string;
  rps_result_draw: string;
  roulette_slots: string;
  roulette_slot_ph: string;
  roulette_add_slot: string;
  roulette_remove_slot: string;
  roulette_fill_members: string;
  roulette_min_slots: string;
  roulette_spin: string;
  roulette_spinning: string;
  roulette_reset: string;
  roulette_result: string;
};

const games: Record<LangCode, GamesTranslations> = {
  ko: {
    section_title: '결정 게임',
    select_group: '그룹을 선택해 주세요.',
    tab_ladder: '사다리',
    tab_rps: '가위바위보',
    tab_roulette: '룰렛',
    ladder_participants: '출발 (참가자)',
    ladder_destinations: '도착 (결과)',
    ladder_participant_ph: '이름',
    ladder_destination_ph: '결과',
    ladder_add_pair: '줄 추가',
    ladder_remove_pair: '줄 삭제',
    ladder_min_players: '최소 2명 이상 입력해 주세요.',
    ladder_to_draw: '가로줄 그리기',
    ladder_draw_hint: '원하는 사이에 한 번만 탭해 가로줄을 그어 주세요.',
    ladder_drawn_by: '{name} 완료',
    ladder_you: '나',
    ladder_start: '사다리 시작',
    ladder_reset: '다시 하기',
    ladder_result_title: '결과',
    ladder_path_result: '{from} → {to}',
    rps_player1: '플레이어 1',
    rps_player2: '플레이어 2',
    rps_rock: '바위',
    rps_paper: '보',
    rps_scissors: '가위',
    rps_reveal: '결과 보기',
    rps_reset: '다시 하기',
    rps_pick_both: '두 사람 모두 선택해 주세요.',
    rps_animating: '가위바위보…',
    rps_result_win: '{winner} 승리!',
    rps_result_draw: '무승부!',
    roulette_slots: '룰렛 칸',
    roulette_slot_ph: '항목 이름',
    roulette_add_slot: '칸 추가',
    roulette_remove_slot: '칸 삭제',
    roulette_fill_members: '멤버로 채우기',
    roulette_min_slots: '최소 2칸 이상 필요합니다.',
    roulette_spin: '돌리기',
    roulette_spinning: '돌리는 중…',
    roulette_reset: '다시 하기',
    roulette_result: '당첨: {name}',
  },
  en: {
    section_title: 'Decision Games',
    select_group: 'Please select a group.',
    tab_ladder: 'Ladder',
    tab_rps: 'Rock Paper Scissors',
    tab_roulette: 'Roulette',
    ladder_participants: 'Start (participants)',
    ladder_destinations: 'End (results)',
    ladder_participant_ph: 'Name',
    ladder_destination_ph: 'Result',
    ladder_add_pair: 'Add lane',
    ladder_remove_pair: 'Remove lane',
    ladder_min_players: 'Enter at least 2 participants.',
    ladder_to_draw: 'Draw rungs',
    ladder_draw_hint: 'Tap once between lanes to draw your rung.',
    ladder_drawn_by: '{name} done',
    ladder_you: 'Me',
    ladder_start: 'Start ladder',
    ladder_reset: 'Reset',
    ladder_result_title: 'Results',
    ladder_path_result: '{from} → {to}',
    rps_player1: 'Player 1',
    rps_player2: 'Player 2',
    rps_rock: 'Rock',
    rps_paper: 'Paper',
    rps_scissors: 'Scissors',
    rps_reveal: 'Reveal',
    rps_reset: 'Reset',
    rps_pick_both: 'Both players must choose.',
    rps_animating: 'Rock, paper, scissors…',
    rps_result_win: '{winner} wins!',
    rps_result_draw: 'Draw!',
    roulette_slots: 'Roulette slots',
    roulette_slot_ph: 'Label',
    roulette_add_slot: 'Add slot',
    roulette_remove_slot: 'Remove slot',
    roulette_fill_members: 'Fill from members',
    roulette_min_slots: 'At least 2 slots required.',
    roulette_spin: 'Spin',
    roulette_spinning: 'Spinning…',
    roulette_reset: 'Reset',
    roulette_result: 'Winner: {name}',
  },
  ja: {
    section_title: '決定ゲーム',
    select_group: 'グループを選択してください。',
    tab_ladder: 'はしご',
    tab_rps: 'じゃんけん',
    tab_roulette: 'ルーレット',
    ladder_participants: '出発（参加者）',
    ladder_destinations: '到着（結果）',
    ladder_participant_ph: '名前',
    ladder_destination_ph: '結果',
    ladder_add_pair: '列を追加',
    ladder_remove_pair: '列を削除',
    ladder_min_players: '2名以上入力してください。',
    ladder_to_draw: '横線を引く',
    ladder_draw_hint: '好きな位置を1回だけタップして横線を引いてください。',
    ladder_drawn_by: '{name} 完了',
    ladder_you: '自分',
    ladder_start: 'はしご開始',
    ladder_reset: 'リセット',
    ladder_result_title: '結果',
    ladder_path_result: '{from} → {to}',
    rps_player1: 'プレイヤー1',
    rps_player2: 'プレイヤー2',
    rps_rock: 'グー',
    rps_paper: 'パー',
    rps_scissors: 'チョキ',
    rps_reveal: '結果を見る',
    rps_reset: 'リセット',
    rps_pick_both: '両方選択してください。',
    rps_animating: 'じゃんけん中…',
    rps_result_win: '{winner} の勝ち！',
    rps_result_draw: 'あいこ！',
    roulette_slots: 'ルーレット枠',
    roulette_slot_ph: '項目名',
    roulette_add_slot: '枠を追加',
    roulette_remove_slot: '枠を削除',
    roulette_fill_members: 'メンバーで埋める',
    roulette_min_slots: '2枠以上必要です。',
    roulette_spin: '回す',
    roulette_spinning: '回転中…',
    roulette_reset: 'リセット',
    roulette_result: '当選: {name}',
  },
  'zh-CN': {
    section_title: '决定游戏',
    select_group: '请选择群组。',
    tab_ladder: '梯子',
    tab_rps: '石头剪刀布',
    tab_roulette: '轮盘',
    ladder_participants: '起点（参与者）',
    ladder_destinations: '终点（结果）',
    ladder_participant_ph: '姓名',
    ladder_destination_ph: '结果',
    ladder_add_pair: '添加列',
    ladder_remove_pair: '删除列',
    ladder_min_players: '请至少输入2人。',
    ladder_to_draw: '画横线',
    ladder_draw_hint: '在想要的位置轻触一次画横线。',
    ladder_drawn_by: '{name} 已完成',
    ladder_you: '我',
    ladder_start: '开始梯子',
    ladder_reset: '重新开始',
    ladder_result_title: '结果',
    ladder_path_result: '{from} → {to}',
    rps_player1: '玩家1',
    rps_player2: '玩家2',
    rps_rock: '石头',
    rps_paper: '布',
    rps_scissors: '剪刀',
    rps_reveal: '查看结果',
    rps_reset: '重新开始',
    rps_pick_both: '请双方都选择。',
    rps_animating: '石头剪刀布中…',
    rps_result_win: '{winner} 获胜！',
    rps_result_draw: '平局！',
    roulette_slots: '轮盘格',
    roulette_slot_ph: '名称',
    roulette_add_slot: '添加格',
    roulette_remove_slot: '删除格',
    roulette_fill_members: '用成员填充',
    roulette_min_slots: '至少需要2格。',
    roulette_spin: '旋转',
    roulette_spinning: '旋转中…',
    roulette_reset: '重新开始',
    roulette_result: '中奖: {name}',
  },
  'zh-TW': {
    section_title: '決定遊戲',
    select_group: '請選擇群組。',
    tab_ladder: '梯子',
    tab_rps: '猜拳',
    tab_roulette: '輪盤',
    ladder_participants: '起點（參與者）',
    ladder_destinations: '終點（結果）',
    ladder_participant_ph: '姓名',
    ladder_destination_ph: '結果',
    ladder_add_pair: '新增列',
    ladder_remove_pair: '刪除列',
    ladder_min_players: '請至少輸入2人。',
    ladder_to_draw: '畫橫線',
    ladder_draw_hint: '在想要的位置輕觸一次畫橫線。',
    ladder_drawn_by: '{name} 已完成',
    ladder_you: '我',
    ladder_start: '開始梯子',
    ladder_reset: '重新開始',
    ladder_result_title: '結果',
    ladder_path_result: '{from} → {to}',
    rps_player1: '玩家1',
    rps_player2: '玩家2',
    rps_rock: '石頭',
    rps_paper: '布',
    rps_scissors: '剪刀',
    rps_reveal: '查看結果',
    rps_reset: '重新開始',
    rps_pick_both: '請雙方都選擇。',
    rps_animating: '猜拳中…',
    rps_result_win: '{winner} 獲勝！',
    rps_result_draw: '平手！',
    roulette_slots: '輪盤格',
    roulette_slot_ph: '名稱',
    roulette_add_slot: '新增格',
    roulette_remove_slot: '刪除格',
    roulette_fill_members: '用成員填充',
    roulette_min_slots: '至少需要2格。',
    roulette_spin: '旋轉',
    roulette_spinning: '旋轉中…',
    roulette_reset: '重新開始',
    roulette_result: '中獎: {name}',
  },
};

export function getGamesTranslation(lang: LangCode, key: keyof GamesTranslations): string {
  return games[lang]?.[key] ?? games.en[key] ?? (games.ko[key] as string) ?? key;
}

export function formatGamesText(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    template,
  );
}
