import type { LangCode } from '@/lib/language-fonts';

export type GroupSettingsTranslations = {
  select_group_first: string;
  admin_only: string;
  group_settings_title: string;
  group_name: string;
  group_name_placeholder: string;
  dashboard_title_label: string;
  dashboard_title_placeholder: string;
  dashboard_title_hint: string;
  display_language: string;
  language_hint: string;
  invite_code: string;
  invite_copy_aria: string;
  invite_link_copy_btn: string;
  invite_link_copy_aria: string;
  invite_refresh_aria: string;
  copied: string;
  copy_btn: string;
  refresh_btn: string;
  save_btn: string;
  save_success: string;
  save_failed: string;
  copy_failed: string;
  refresh_failed: string;
  refresh_success: string;
  invite_refresh_hint: string;
  saving: string;
  session_error: string;
};

const groupSettings: Record<LangCode, GroupSettingsTranslations> = {
  ko: {
    select_group_first: '그룹을 선택해주세요.',
    admin_only: '그룹 설정은 관리자만 변경할 수 있습니다.',
    group_settings_title: '그룹 설정',
    group_name: '그룹 이름',
    group_name_placeholder: '그룹 이름을 입력하세요',
    dashboard_title_label: '대시보드 타이틀',
    dashboard_title_placeholder: '예: Hearth (허쓰): 패밀리 헤이븐',
    dashboard_title_hint: '대시보드 상단에 표시되는 문구입니다. 글자 크기는 화면에 맞게 자동 조정됩니다.',
    display_language: '표시 언어',
    language_hint: '그룹 대시보드의 타이틀·본문 폰트에 적용됩니다.',
    invite_code: '초대 코드',
    invite_copy_aria: '초대 코드 복사',
    invite_link_copy_btn: '초대 링크 복사',
    invite_link_copy_aria: '초대 링크 복사',
    invite_refresh_aria: '초대 코드 갱신',
    copied: '복사됨',
    copy_btn: '복사',
    refresh_btn: '갱신',
    save_btn: '저장',
    save_success: '그룹 설정이 저장되었습니다.',
    save_failed: '그룹 설정 저장에 실패했습니다.',
    copy_failed: '초대 코드 복사에 실패했습니다.',
    refresh_failed: '초대 코드 갱신에 실패했습니다.',
    refresh_success: '초대 코드가 갱신되었습니다.',
    invite_refresh_hint: "가입이 끝난 후 '초대코드 갱신'을 눌러 이전 코드를 무효화하세요. 새 코드를 모르는 사람은 가입할 수 없습니다.",
    saving: '저장 중...',
    session_error: '세션이 없습니다. 다시 로그인해 주세요.',
  },
  en: {
    select_group_first: 'Please select a group.',
    admin_only: 'Only group admins can change group settings.',
    group_settings_title: 'Group settings',
    group_name: 'Group name',
    group_name_placeholder: 'Enter group name',
    dashboard_title_label: 'Dashboard title',
    dashboard_title_placeholder: 'e.g. Hearth: Family Haven',
    dashboard_title_hint: 'This text is shown at the top of the dashboard. Font size adjusts automatically.',
    display_language: 'Display language',
    language_hint: 'Applied to title and body fonts on the group dashboard.',
    invite_code: 'Invite code',
    invite_copy_aria: 'Copy invite code',
    invite_link_copy_btn: 'Copy invite link',
    invite_link_copy_aria: 'Copy invite link',
    invite_refresh_aria: 'Refresh invite code',
    copied: 'Copied',
    copy_btn: 'Copy',
    refresh_btn: 'Refresh',
    save_btn: 'Save',
    save_success: 'Group settings saved.',
    save_failed: 'Failed to save group settings.',
    copy_failed: 'Failed to copy invite code.',
    refresh_failed: 'Failed to refresh invite code.',
    refresh_success: 'Invite code has been refreshed.',
    invite_refresh_hint: "After everyone has joined, click 'Refresh' to invalidate the old code. Only people with the new code can join.",
    saving: 'Saving...',
    session_error: 'No session. Please log in again.',
  },
  ja: {
    select_group_first: 'グループを選択してください。',
    admin_only: 'グループ設定は管理者のみ変更できます。',
    group_settings_title: 'グループ設定',
    group_name: 'グループ名',
    group_name_placeholder: 'グループ名を入力',
    dashboard_title_label: 'ダッシュボードタイトル',
    dashboard_title_placeholder: '例: Hearth (ハース): ファミリーヘイブン',
    dashboard_title_hint: 'ダッシュボード上部に表示されます。文字サイズは自動調整されます。',
    display_language: '表示言語',
    language_hint: 'グループのダッシュボードのタイトル・本文フォントに適用されます。',
    invite_code: '招待コード',
    invite_copy_aria: '招待コードをコピー',
    invite_link_copy_btn: '招待リンクをコピー',
    invite_link_copy_aria: '招待リンクをコピー',
    invite_refresh_aria: '招待コードを再発行',
    copied: 'コピーしました',
    copy_btn: 'コピー',
    refresh_btn: '再発行',
    save_btn: '保存',
    save_success: 'グループ設定を保存しました。',
    save_failed: 'グループ設定の保存に失敗しました。',
    copy_failed: '招待コードのコピーに失敗しました。',
    refresh_failed: '招待コードの再発行に失敗しました。',
    refresh_success: '招待コードを再発行しました。',
    invite_refresh_hint: '参加者が揃ったら「再発行」を押して古いコードを無効にしてください。新しいコードを知らない人は参加できません。',
    saving: '保存中...',
    session_error: 'セッションがありません。再度ログインしてください。',
  },
  'zh-CN': {
    select_group_first: '请先选择群组。',
    admin_only: '仅群组管理员可修改群组设置。',
    group_settings_title: '群组设置',
    group_name: '群组名称',
    group_name_placeholder: '请输入群组名称',
    dashboard_title_label: '仪表盘标题',
    dashboard_title_placeholder: '例如：Hearth (赫斯): 法米利·黑文',
    dashboard_title_hint: '显示在仪表盘顶部。字号将自动调整。',
    display_language: '显示语言',
    language_hint: '应用于群组仪表盘的标题与正文字体。',
    invite_code: '邀请码',
    invite_copy_aria: '复制邀请码',
    invite_link_copy_btn: '复制邀请链接',
    invite_link_copy_aria: '复制邀请链接',
    invite_refresh_aria: '重新生成邀请码',
    copied: '已复制',
    copy_btn: '复制',
    refresh_btn: '重新生成',
    save_btn: '保存',
    save_success: '群组设置已保存。',
    save_failed: '保存群组设置失败。',
    copy_failed: '复制邀请码失败。',
    refresh_failed: '重新生成邀请码失败。',
    refresh_success: '邀请码已重新生成。',
    invite_refresh_hint: '所有人加入后，点击「重新生成」使旧邀请码失效。只有持有新码的人可以加入。',
    saving: '保存中...',
    session_error: '无会话，请重新登录。',
  },
  'zh-TW': {
    select_group_first: '請先選擇群組。',
    admin_only: '僅群組管理員可修改群組設定。',
    group_settings_title: '群組設定',
    group_name: '群組名稱',
    group_name_placeholder: '請輸入群組名稱',
    dashboard_title_label: '儀表板標題',
    dashboard_title_placeholder: '例如：Hearth (赫斯): 法米利·黑文',
    dashboard_title_hint: '顯示在儀表板頂部。字型大小會自動調整。',
    display_language: '顯示語言',
    language_hint: '套用於群組儀表板的標題與內文字型。',
    invite_code: '邀請碼',
    invite_copy_aria: '複製邀請碼',
    invite_link_copy_btn: '複製邀請連結',
    invite_link_copy_aria: '複製邀請連結',
    invite_refresh_aria: '重新產生邀請碼',
    copied: '已複製',
    copy_btn: '複製',
    refresh_btn: '重新產生',
    save_btn: '儲存',
    save_success: '群組設定已儲存。',
    save_failed: '儲存群組設定失敗。',
    copy_failed: '複製邀請碼失敗。',
    refresh_failed: '重新產生邀請碼失敗。',
    refresh_success: '邀請碼已重新產生。',
    invite_refresh_hint: '所有人加入後，點擊「重新產生」使舊邀請碼失效。僅持有新碼的人可加入。',
    saving: '儲存中...',
    session_error: '無工作階段，請重新登入。',
  },
};

export function getGroupSettingsTranslation(lang: LangCode, key: keyof GroupSettingsTranslations): string {
  return groupSettings[lang]?.[key] ?? groupSettings.en[key] ?? (groupSettings.ko[key] as string) ?? key;
}
