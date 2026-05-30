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
  select_member: string;
  no_members: string;
  rps_select_members: string;
  rps_pick_choices: string;
  duplicate_member: string;
  ladder_add_pair: string;
  ladder_remove_pair: string;
  ladder_min_players: string;
  ladder_to_draw: string;
  ladder_draw_hint: string;
  ladder_start_hint: string;
  ladder_drawn_by: string;
  ladder_draw_progress: string;
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
  roulette_participants: string;
  roulette_slots_per_member: string;
  roulette_slots_per_member_option: string;
  roulette_total_slots: string;
  roulette_select_participants: string;
  roulette_min_participants: string;
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
    ladder_participant_ph: '멤버 선택',
    ladder_destination_ph: '결과',
    select_member: '멤버 선택',
    no_members: '불러올 그룹 멤버가 없습니다.',
    rps_select_members: '두 명의 멤버를 선택해 주세요.',
    rps_pick_choices: '두 사람 모두 가위·바위·보를 선택해 주세요.',
    duplicate_member: '서로 다른 멤버를 선택해 주세요.',
    ladder_add_pair: '줄 추가',
    ladder_remove_pair: '줄 삭제',
    ladder_min_players: '최소 2명의 멤버를 선택해 주세요.',
    ladder_to_draw: '가로줄 그리기',
    ladder_draw_hint: '원하면 참가자별로 한 번씩 가로줄을 추가한 뒤, 시작을 눌러 주세요.',
    ladder_start_hint: '시작을 누르면 사다리가 자동으로 그려집니다.',
    ladder_drawn_by: '{name} 완료',
    ladder_draw_progress: '{done}/{total}명 가로줄 완료',
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
    roulette_participants: '참가 멤버',
    roulette_slots_per_member: '멤버당 칸 수',
    roulette_slots_per_member_option: '멤버당 {each}칸 (총 {total}칸)',
    roulette_total_slots: '총 {total}칸 · 멤버 {count}명',
    roulette_select_participants: '참가할 멤버를 선택해 주세요.',
    roulette_min_participants: '최소 2명 이상 선택해 주세요.',
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
    ladder_participant_ph: 'Select member',
    ladder_destination_ph: 'Result',
    select_member: 'Select member',
    no_members: 'No group members available.',
    rps_select_members: 'Select two members.',
    rps_pick_choices: 'Both players must choose rock, paper, or scissors.',
    duplicate_member: 'Please select two different members.',
    ladder_add_pair: 'Add lane',
    ladder_remove_pair: 'Remove lane',
    ladder_min_players: 'Select at least 2 members.',
    ladder_to_draw: 'Draw rungs',
    ladder_draw_hint: 'Optionally add one rung per participant, then press Start.',
    ladder_start_hint: 'Press Start to draw the ladder automatically.',
    ladder_drawn_by: '{name} done',
    ladder_draw_progress: '{done}/{total} rungs placed',
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
    roulette_participants: 'Participants',
    roulette_slots_per_member: 'Slots per member',
    roulette_slots_per_member_option: '{each} each ({total} total)',
    roulette_total_slots: '{total} slots · {count} members',
    roulette_select_participants: 'Select participants.',
    roulette_min_participants: 'Select at least 2 members.',
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
    ladder_participant_ph: 'メンバー選択',
    ladder_destination_ph: '結果',
    select_member: 'メンバー選択',
    no_members: '読み込めるグループメンバーがいません。',
    rps_select_members: '2人のメンバーを選択してください。',
    rps_pick_choices: '両方がグー・パー・チョキを選んでください。',
    duplicate_member: '別のメンバーを選んでください。',
    ladder_add_pair: '列を追加',
    ladder_remove_pair: '列を削除',
    ladder_min_players: '2名以上のメンバーを選択してください。',
    ladder_to_draw: '横線を引く',
    ladder_draw_hint: '必要なら参加者ごとに1本追加してから開始してください。',
    ladder_start_hint: '開始を押すと自動ではしごを描きます。',
    ladder_drawn_by: '{name} 完了',
    ladder_draw_progress: '{done}/{total}人完了',
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
    roulette_participants: '参加メンバー',
    roulette_slots_per_member: 'メンバーあたりの枠',
    roulette_slots_per_member_option: '各{each}枠 (合計{total}枠)',
    roulette_total_slots: '合計{total}枠 · {count}人',
    roulette_select_participants: '参加メンバーを選んでください。',
    roulette_min_participants: '2人以上選んでください。',
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
    ladder_participant_ph: '选择成员',
    ladder_destination_ph: '结果',
    select_member: '选择成员',
    no_members: '没有可加载的群组成员。',
    rps_select_members: '请选择两名成员。',
    rps_pick_choices: '请双方都选择石头、布或剪刀。',
    duplicate_member: '请选择不同的成员。',
    ladder_add_pair: '添加列',
    ladder_remove_pair: '删除列',
    ladder_min_players: '请至少选择2名成员。',
    ladder_to_draw: '画横线',
    ladder_draw_hint: '可选：每位参与者添加一条横线后，再按开始。',
    ladder_start_hint: '按开始后将自动绘制梯子。',
    ladder_drawn_by: '{name} 已完成',
    ladder_draw_progress: '{done}/{total} 人已完成',
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
    roulette_participants: '参与成员',
    roulette_slots_per_member: '每人格数',
    roulette_slots_per_member_option: '每人{each}格 (共{total}格)',
    roulette_total_slots: '共{total}格 · {count}人',
    roulette_select_participants: '请选择参与成员。',
    roulette_min_participants: '请至少选择2人。',
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
    ladder_participant_ph: '選擇成員',
    ladder_destination_ph: '結果',
    select_member: '選擇成員',
    no_members: '沒有可載入的群組成員。',
    rps_select_members: '請選擇兩名成員。',
    rps_pick_choices: '請雙方都選擇石頭、布或剪刀。',
    duplicate_member: '請選擇不同的成員。',
    ladder_add_pair: '新增列',
    ladder_remove_pair: '刪除列',
    ladder_min_players: '請至少選擇2名成員。',
    ladder_to_draw: '畫橫線',
    ladder_draw_hint: '可選：每位參與者新增一條橫線後，再按開始。',
    ladder_start_hint: '按開始後將自動繪製梯子。',
    ladder_drawn_by: '{name} 已完成',
    ladder_draw_progress: '{done}/{total} 人已完成',
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
    roulette_participants: '參與成員',
    roulette_slots_per_member: '每人格數',
    roulette_slots_per_member_option: '每人{each}格 (共{total}格)',
    roulette_total_slots: '共{total}格 · {count}人',
    roulette_select_participants: '請選擇參與成員。',
    roulette_min_participants: '請至少選擇2人。',
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
