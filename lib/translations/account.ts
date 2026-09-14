import type { LangCode } from '@/lib/language-fonts';

export type AccountTranslations = {
  page_title: string;
  page_subtitle: string;
  back_dashboard: string;
  back_onboarding: string;
  delete_section_title: string;
  delete_section_hint: string;
  delete_account_btn: string;
  delete_account_aria: string;
  delete_confirm_1: string;
  delete_confirm_2: string;
  delete_success: string;
  delete_failed: string;
  delete_error: string;
  auth_fetch_failed: string;
  delete_transfer_auth_failed: string;
  delete_warning_owner_title: string;
  delete_warning_owner_groups: string;
  delete_warning_owner_deleted: string;
  delete_warning_owner_final: string;
  leave_group_btn: string;
  leave_group_aria: string;
  leave_confirm: string;
  leave_success: string;
  leave_failed: string;
  leave_owner_blocked: string;
  account_link: string;
  account_link_aria: string;
};

const en: AccountTranslations = {
  page_title: 'Account',
  page_subtitle: 'Manage your account. Leaving a group is done from that group’s dashboard.',
  back_dashboard: 'Back to dashboard',
  back_onboarding: 'Back to group selection',
  delete_section_title: 'Delete account',
  delete_section_hint:
    'Deleting your account permanently removes your data. To leave only one group, use Leave group on that group’s dashboard.',
  delete_account_btn: 'Delete account',
  delete_account_aria: 'Delete account',
  delete_confirm_1:
    'Really delete your account?\n\nAll data will be permanently deleted and cannot be recovered.',
  delete_confirm_2: 'Final confirmation\n\nProceed with account deletion?',
  delete_success: 'Your account has been deleted.',
  delete_failed: 'Could not delete the account.',
  delete_error: 'An error occurred while deleting the account.',
  auth_fetch_failed: 'Could not get your session. Please sign in again.',
  delete_transfer_auth_failed: 'Session expired. Please sign in again.',
  delete_warning_owner_title: 'You own groups. Deleting your account will:',
  delete_warning_owner_groups: 'Owned groups:',
  delete_warning_owner_deleted:
    'Those groups and their data may be deleted, and all members removed. This cannot be undone.',
  delete_warning_owner_final: 'Delete account anyway?',
  leave_group_btn: 'Leave group',
  leave_group_aria: 'Leave this group',
  leave_confirm: 'Leave this group?\n\nYour account will remain. You can join again with an invite.',
  leave_success: 'You left the group.',
  leave_failed: 'Could not leave the group.',
  leave_owner_blocked:
    'Group owners cannot leave. Transfer ownership or delete the account from Account settings.',
  account_link: 'Account',
  account_link_aria: 'Account settings',
};

const ko: AccountTranslations = {
  page_title: '계정',
  page_subtitle: '계정 설정을 관리합니다. 특정 그룹만 나가려면 해당 그룹 대시보드에서 그룹 탈퇴를 사용하세요.',
  back_dashboard: '대시보드로',
  back_onboarding: '그룹 선택으로',
  delete_section_title: '회원 탈퇴',
  delete_section_hint:
    '회원 탈퇴 시 계정과 데이터가 영구 삭제됩니다. 한 그룹만 나가려면 그 그룹 대시보드의 「그룹 탈퇴」를 이용하세요.',
  delete_account_btn: '회원 탈퇴',
  delete_account_aria: '회원 탈퇴',
  delete_confirm_1:
    '⚠️ 정말로 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
  delete_confirm_2: '⚠️ 최종 확인\n\n회원탈퇴를 진행하시겠습니까?',
  delete_success: '회원탈퇴가 완료되었습니다.',
  delete_failed: '회원탈퇴에 실패했습니다.',
  delete_error: '회원탈퇴 처리 중 오류가 발생했습니다.',
  auth_fetch_failed: '인증 정보를 가져올 수 없습니다. 다시 로그인해 주세요.',
  delete_transfer_auth_failed: '세션이 만료되었습니다. 다시 로그인해 주세요.',
  delete_warning_owner_title: '⚠️ 그룹 소유자 탈퇴 경고\n\n회원탈퇴 시 다음 사항이 발생합니다:',
  delete_warning_owner_groups: '소유 그룹:',
  delete_warning_owner_deleted:
    '⚠️ 삭제되는 내용:\n• 소유한 그룹이 영구적으로 삭제됩니다\n• 그룹의 모든 데이터가 삭제됩니다\n• 그룹의 모든 멤버가 자동으로 탈퇴됩니다\n• 이 작업은 되돌릴 수 없습니다',
  delete_warning_owner_final: '정말로 탈퇴하시겠습니까?',
  leave_group_btn: '그룹 탈퇴',
  leave_group_aria: '이 그룹에서 나가기',
  leave_confirm:
    '이 그룹에서 나가시겠습니까?\n\n계정은 유지되며, 초대 코드로 다시 가입할 수 있습니다.',
  leave_success: '그룹에서 탈퇴했습니다.',
  leave_failed: '그룹 탈퇴에 실패했습니다.',
  leave_owner_blocked:
    '그룹 소유자는 탈퇴할 수 없습니다. 소유권을 이전하거나 계정 페이지에서 회원 탈퇴를 진행해 주세요.',
  account_link: '계정',
  account_link_aria: '계정 설정',
};

const translations: Record<LangCode, AccountTranslations> = {
  ko,
  en,
  ja: { ...en, page_title: 'アカウント', delete_account_btn: '退会', leave_group_btn: 'グループ退会', account_link: 'アカウント' },
  'zh-CN': { ...en, page_title: '账户', delete_account_btn: '注销账户', leave_group_btn: '退出群组', account_link: '账户' },
  'zh-TW': { ...en, page_title: '帳戶', delete_account_btn: '刪除帳戶', leave_group_btn: '退出群組', account_link: '帳戶' },
  es: { ...en, page_title: 'Cuenta', delete_account_btn: 'Eliminar cuenta', leave_group_btn: 'Salir del grupo', account_link: 'Cuenta' },
  fr: { ...en, page_title: 'Compte', delete_account_btn: 'Supprimer le compte', leave_group_btn: 'Quitter le groupe', account_link: 'Compte' },
  de: { ...en, page_title: 'Konto', delete_account_btn: 'Konto löschen', leave_group_btn: 'Gruppe verlassen', account_link: 'Konto' },
  it: { ...en, page_title: 'Account', delete_account_btn: 'Elimina account', leave_group_btn: 'Lascia gruppo', account_link: 'Account' },
  pt: { ...en, page_title: 'Conta', delete_account_btn: 'Excluir conta', leave_group_btn: 'Sair do grupo', account_link: 'Conta' },
};

export function getAccountTranslation(lang: LangCode, key: keyof AccountTranslations): string {
  return translations[lang]?.[key] ?? translations.en[key];
}
