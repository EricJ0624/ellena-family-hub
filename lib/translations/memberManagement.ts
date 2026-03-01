import type { LangCode } from '@/lib/language-fonts';

export type MemberManagementTranslations = {
  select_group_first: string;
  search_placeholder: string;
  group_settings_btn: string;
  loading_members: string;
  email: string;
  nickname: string;
  role: string;
  joined_at: string;
  manage: string;
  promote_title: string;
  demote_title: string;
  confirm_btn: string;
  remove_confirm: string;
  cannot_remove_self: string;
  cannot_remove_owner: string;
  remove_failed: string;
  cannot_change_self_role: string;
  cannot_change_owner_role: string;
  session_expired: string;
  role_changed_to_admin: string;
  role_changed_to_member: string;
  role_change_failed: string;
  promote_confirm: string;
  demote_confirm: string;
  load_failed: string;
  no_members: string;
  role_owner: string;
  role_admin: string;
  role_member: string;
  family_role_label: string;
  family_role_none: string;
  family_role_mom: string;
  family_role_dad: string;
  family_role_son: string;
  family_role_daughter: string;
  family_role_other: string;
  family_role_saved: string;
  family_role_save_failed: string;
  family_role_modal_description: string; // 가입 후 "가족에서 나를 어떻게 표시할까요? (선택사항)"
};

const memberManagement: Record<LangCode, MemberManagementTranslations> = {
  ko: {
    select_group_first: '그룹을 선택해주세요.',
    search_placeholder: '이메일, 닉네임, ID로 검색...',
    group_settings_btn: '그룹 설정',
    loading_members: '멤버 목록을 불러오는 중...',
    email: '이메일',
    nickname: '닉네임',
    role: '역할',
    joined_at: '가입일',
    manage: '관리',
    promote_title: '관리자로 승격',
    demote_title: '일반 멤버로 변경',
    confirm_btn: '확인',
    remove_confirm: '추방 확인',
    cannot_remove_self: '자신을 추방할 수 없습니다.',
    cannot_remove_owner: '그룹 소유자는 추방할 수 없습니다.',
    remove_failed: '멤버 추방에 실패했습니다.',
    cannot_change_self_role: '자기 자신의 역할은 변경할 수 없습니다.',
    cannot_change_owner_role: '그룹 소유자의 역할은 변경할 수 없습니다.',
    session_expired: '인증 세션이 만료되었습니다. 다시 로그인해주세요.',
    role_changed_to_admin: '멤버 역할이 관리자로 변경되었습니다.',
    role_changed_to_member: '멤버 역할이 멤버로 변경되었습니다.',
    role_change_failed: '역할 변경에 실패했습니다.',
    promote_confirm: '님을 관리자로 승격시키시겠습니까?',
    demote_confirm: '님의 관리자 권한을 일반 멤버로 변경하시겠습니까?',
    load_failed: '멤버 목록을 불러오는데 실패했습니다.',
    no_members: '멤버가 없습니다.',
    role_owner: '소유자 (부모)',
    role_admin: '관리자 (부모)',
    role_member: '멤버 (아이 또는 가족 구성원)',
    family_role_label: '가족 표시',
    family_role_none: '미설정',
    family_role_mom: '엄마',
    family_role_dad: '아빠',
    family_role_son: '아들',
    family_role_daughter: '딸',
    family_role_other: '기타',
    family_role_saved: '가족 표시가 저장되었습니다.',
    family_role_save_failed: '저장에 실패했습니다.',
    family_role_modal_description: '가족에서 나를 어떻게 표시할까요? (선택사항)',
  },
  en: {
    select_group_first: 'Please select a group.',
    search_placeholder: 'Search by email, nickname, ID...',
    group_settings_btn: 'Group settings',
    loading_members: 'Loading members...',
    email: 'Email',
    nickname: 'Nickname',
    role: 'Role',
    joined_at: 'Joined',
    manage: 'Actions',
    promote_title: 'Promote to admin',
    demote_title: 'Change to member',
    confirm_btn: 'Confirm',
    remove_confirm: 'Confirm remove',
    cannot_remove_self: 'You cannot remove yourself.',
    cannot_remove_owner: 'Group owner cannot be removed.',
    remove_failed: 'Failed to remove member.',
    cannot_change_self_role: 'You cannot change your own role.',
    cannot_change_owner_role: 'Group owner role cannot be changed.',
    session_expired: 'Your session has expired. Please log in again.',
    role_changed_to_admin: 'Member role has been updated to admin.',
    role_changed_to_member: 'Member role has been updated to member.',
    role_change_failed: 'Failed to change role.',
    promote_confirm: ' — Promote to admin?',
    demote_confirm: ' — Change to regular member?',
    load_failed: 'Failed to load members.',
    no_members: 'No members.',
    role_owner: 'Owner (parent)',
    role_admin: 'Admin (parent)',
    role_member: 'Member (child or family)',
    family_role_label: 'Family role',
    family_role_none: 'Not set',
    family_role_mom: 'Mom',
    family_role_dad: 'Dad',
    family_role_son: 'Son',
    family_role_daughter: 'Daughter',
    family_role_other: 'Other',
    family_role_saved: 'Family role saved.',
    family_role_save_failed: 'Failed to save.',
    family_role_modal_description: 'How would you like to be shown in the family? (Optional)',
  },
  ja: {
    select_group_first: 'グループを選択してください。',
    search_placeholder: 'メール、ニックネーム、IDで検索...',
    group_settings_btn: 'グループ設定',
    loading_members: 'メンバーを読み込み中...',
    email: 'メール',
    nickname: 'ニックネーム',
    role: '役割',
    joined_at: '参加日',
    manage: '操作',
    promote_title: '管理者に昇格',
    demote_title: '一般メンバーに変更',
    confirm_btn: '確認',
    remove_confirm: '削除確認',
    cannot_remove_self: '自分自身を削除することはできません。',
    cannot_remove_owner: 'グループオーナーは削除できません。',
    remove_failed: 'メンバーの削除に失敗しました。',
    cannot_change_self_role: '自分の役割は変更できません。',
    cannot_change_owner_role: 'グループオーナーの役割は変更できません。',
    session_expired: 'セッションの有効期限が切れました。再度ログインしてください。',
    role_changed_to_admin: 'メンバーの役割を管理者に変更しました。',
    role_changed_to_member: 'メンバーの役割をメンバーに変更しました。',
    role_change_failed: '役割の変更に失敗しました。',
    promote_confirm: 'を管理者に昇格させますか？',
    demote_confirm: 'の管理者権限を一般メンバーに変更しますか？',
    load_failed: 'メンバーリストの読み込みに失敗しました。',
    no_members: 'メンバーがいません。',
    role_owner: 'オーナー（保護者）',
    role_admin: '管理者（保護者）',
    role_member: 'メンバー（子どもまたは家族）',
    family_role_label: '家族の表示',
    family_role_none: '未設定',
    family_role_mom: 'ママ',
    family_role_dad: 'パパ',
    family_role_son: '息子',
    family_role_daughter: '娘',
    family_role_other: 'その他',
    family_role_saved: '家族の表示を保存しました。',
    family_role_save_failed: '保存に失敗しました。',
    family_role_modal_description: '家族でどのように表示しますか？（任意）',
  },
  'zh-CN': {
    select_group_first: '请先选择群组。',
    search_placeholder: '按邮箱、昵称、ID 搜索...',
    group_settings_btn: '群组设置',
    loading_members: '正在加载成员...',
    email: '邮箱',
    nickname: '昵称',
    role: '角色',
    joined_at: '加入日期',
    manage: '操作',
    promote_title: '设为管理员',
    demote_title: '改为普通成员',
    confirm_btn: '确认',
    remove_confirm: '确认移除',
    cannot_remove_self: '不能移除自己。',
    cannot_remove_owner: '不能移除群组所有者。',
    remove_failed: '移除成员失败。',
    cannot_change_self_role: '不能更改自己的角色。',
    cannot_change_owner_role: '不能更改群组所有者的角色。',
    session_expired: '登录已过期，请重新登录。',
    role_changed_to_admin: '成员角色已改为管理员。',
    role_changed_to_member: '成员角色已改为成员。',
    role_change_failed: '角色更改失败。',
    promote_confirm: '设为管理员？',
    demote_confirm: '改为普通成员？',
    load_failed: '加载成员列表失败。',
    no_members: '暂无成员。',
    role_owner: '所有者（家长）',
    role_admin: '管理员（家长）',
    role_member: '成员（孩子或家人）',
    family_role_label: '家庭显示',
    family_role_none: '未设置',
    family_role_mom: '妈妈',
    family_role_dad: '爸爸',
    family_role_son: '儿子',
    family_role_daughter: '女儿',
    family_role_other: '其他',
    family_role_saved: '家庭显示已保存。',
    family_role_save_failed: '保存失败。',
  },
  'zh-TW': {
    select_group_first: '請先選擇群組。',
    search_placeholder: '以電子郵件、暱稱、ID 搜尋...',
    group_settings_btn: '群組設定',
    loading_members: '正在載入成員...',
    email: '電子郵件',
    nickname: '暱稱',
    role: '角色',
    joined_at: '加入日期',
    manage: '操作',
    promote_title: '設為管理員',
    demote_title: '改為一般成員',
    confirm_btn: '確認',
    remove_confirm: '確認移除',
    cannot_remove_self: '無法移除自己。',
    cannot_remove_owner: '無法移除群組擁有者。',
    remove_failed: '移除成員失敗。',
    cannot_change_self_role: '無法變更自己的角色。',
    cannot_change_owner_role: '無法變更群組擁有者的角色。',
    session_expired: '登入已過期，請重新登入。',
    role_changed_to_admin: '成員角色已改為管理員。',
    role_changed_to_member: '成員角色已改為成員。',
    role_change_failed: '角色變更失敗。',
    promote_confirm: '設為管理員？',
    demote_confirm: '改為一般成員？',
    load_failed: '載入成員列表失敗。',
    no_members: '尚無成員。',
    role_owner: '擁有者（家長）',
    role_admin: '管理員（家長）',
    role_member: '成員（孩子或家人）',
    family_role_label: '家庭顯示',
    family_role_none: '未設定',
    family_role_mom: '媽媽',
    family_role_dad: '爸爸',
    family_role_son: '兒子',
    family_role_daughter: '女兒',
    family_role_other: '其他',
    family_role_saved: '家庭顯示已儲存。',
    family_role_save_failed: '儲存失敗。',
    family_role_modal_description: '您希望在家庭中如何顯示？（選填）',
  },
};

export function getMemberManagementTranslation(lang: LangCode, key: keyof MemberManagementTranslations): string {
  return memberManagement[lang]?.[key] ?? memberManagement.en[key] ?? (memberManagement.ko[key] as string) ?? key;
}

/** 가족 표시 역할 값을 다국어 라벨로 변환 (앱 전반 표시용) */
export function getFamilyRoleLabel(
  lang: LangCode,
  role: 'mom' | 'dad' | 'son' | 'daughter' | 'other' | null
): string {
  if (!role) return '';
  const key = `family_role_${role}` as keyof MemberManagementTranslations;
  return getMemberManagementTranslation(lang, key);
}
