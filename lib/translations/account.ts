import type { LangCode } from '@/lib/language-fonts';

export type AccountTranslations = {
  page_title: string;
  page_subtitle: string;
  back_dashboard: string;
  back_onboarding: string;
  delete_section_title: string;
  delete_section_hint: string;
  delete_section_hint_owned: string;
  delete_account_btn: string;
  delete_account_aria: string;
  delete_confirm_1: string;
  delete_confirm_2: string;
  delete_success: string;
  delete_failed: string;
  delete_error: string;
  delete_blocked_owned: string;
  auth_fetch_failed: string;
  delete_transfer_auth_failed: string;
  delete_warning_owner_title: string;
  delete_warning_owner_groups: string;
  delete_warning_owner_deleted: string;
  delete_warning_owner_final: string;
  leave_section_title: string;
  leave_section_hint: string;
  leave_owned_title: string;
  leave_owned_hint: string;
  leave_owned_empty: string;
  leave_delete_group_btn: string;
  leave_delete_group_aria: string;
  leave_delete_confirm: string;
  leave_delete_success: string;
  leave_delete_failed: string;
  leave_transfer_btn: string;
  leave_transfer_aria: string;
  leave_transfer_pick: string;
  leave_transfer_confirm: string;
  leave_transfer_success: string;
  leave_transfer_failed: string;
  leave_transfer_no_members: string;
  leave_transfer_cancel: string;
  leave_current_group: string;
  leave_no_group: string;
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
  page_subtitle:
    'Manage groups you own, leave a group as a member, or delete your account. These are separate actions.',
  back_dashboard: 'Back to dashboard',
  back_onboarding: 'Back to group selection',
  delete_section_title: 'Delete account',
  delete_section_hint:
    'Deleting your account permanently removes your data. To leave only one group as a member, use Leave group above.',
  delete_section_hint_owned:
    'Delete a group you own or transfer ownership above first. You can delete your account only when you own no groups.',
  delete_account_btn: 'Delete account',
  delete_account_aria: 'Delete account',
  delete_confirm_1:
    'Really delete your account?\n\nAll data will be permanently deleted and cannot be recovered.',
  delete_confirm_2: 'Final confirmation\n\nProceed with account deletion?',
  delete_success: 'Your account has been deleted.',
  delete_failed: 'Could not delete the account.',
  delete_error: 'An error occurred while deleting the account.',
  delete_blocked_owned:
    'You still own one or more groups. Delete them or transfer ownership above, then try again.',
  auth_fetch_failed: 'Could not get your session. Please sign in again.',
  delete_transfer_auth_failed: 'Session expired. Please sign in again.',
  delete_warning_owner_title: 'You own groups. Deleting your account will:',
  delete_warning_owner_groups: 'Owned groups:',
  delete_warning_owner_deleted:
    'Those groups and their data may be deleted, and all members removed. This cannot be undone.',
  delete_warning_owner_final: 'Delete account anyway?',
  leave_section_title: 'Groups',
  leave_section_hint:
    'Leave a group you joined as a member, or manage groups you own (delete or transfer ownership).',
  leave_owned_title: 'Groups you own',
  leave_owned_hint:
    'Delete a group permanently, or transfer ownership to another member. Your account stays.',
  leave_owned_empty: 'You do not own any groups.',
  leave_delete_group_btn: 'Delete group',
  leave_delete_group_aria: 'Permanently delete this group',
  leave_delete_confirm:
    'Permanently delete "{name}"?\n\nAll group data will be removed. This cannot be undone. Your account will remain.',
  leave_delete_success: 'The group was deleted.',
  leave_delete_failed: 'Could not delete the group.',
  leave_transfer_btn: 'Transfer ownership',
  leave_transfer_aria: 'Transfer group ownership',
  leave_transfer_pick: 'Choose a member to become the new owner',
  leave_transfer_confirm:
    'Transfer ownership of "{name}" to this member?\n\nYou will remain a member. You can leave the group afterward.',
  leave_transfer_success: 'Ownership transferred.',
  leave_transfer_failed: 'Could not transfer ownership.',
  leave_transfer_no_members: 'No other members to transfer to. Invite someone first, or delete the group.',
  leave_transfer_cancel: 'Cancel',
  leave_current_group: 'Current group',
  leave_no_group: 'No group is selected. Open a group dashboard first to leave as a member.',
  leave_group_btn: 'Leave group',
  leave_group_aria: 'Leave this group',
  leave_confirm: 'Leave this group?\n\nYour account will remain. You can join again with an invite.',
  leave_success: 'You left the group.',
  leave_failed: 'Could not leave the group.',
  leave_owner_blocked:
    'You own this group. Delete it or transfer ownership in the list above — you cannot simply leave.',
  account_link: 'Account',
  account_link_aria: 'Account settings',
};

const ko: AccountTranslations = {
  page_title: '계정',
  page_subtitle:
    '소유 그룹을 정리하거나, 멤버로 가입한 그룹에서 나가거나, 회원 탈퇴를 할 수 있습니다. 동작은 서로 다릅니다.',
  back_dashboard: '대시보드로',
  back_onboarding: '그룹 선택으로',
  delete_section_title: '회원 탈퇴',
  delete_section_hint:
    '회원 탈퇴 시 계정과 데이터가 영구 삭제됩니다. 멤버로만 속한 그룹에서 나가려면 위의 「그룹 탈퇴」를 이용하세요.',
  delete_section_hint_owned:
    '위에서 소유 그룹을 삭제하거나 소유권을 이양한 뒤에만 회원 탈퇴할 수 있습니다.',
  delete_account_btn: '회원 탈퇴',
  delete_account_aria: '회원 탈퇴',
  delete_confirm_1:
    '⚠️ 정말로 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.',
  delete_confirm_2: '⚠️ 최종 확인\n\n회원탈퇴를 진행하시겠습니까?',
  delete_success: '회원탈퇴가 완료되었습니다.',
  delete_failed: '회원탈퇴에 실패했습니다.',
  delete_error: '회원탈퇴 처리 중 오류가 발생했습니다.',
  delete_blocked_owned:
    '아직 소유 중인 그룹이 있습니다. 위에서 그룹을 삭제하거나 소유권을 이양한 뒤 다시 시도해 주세요.',
  auth_fetch_failed: '인증 정보를 가져올 수 없습니다. 다시 로그인해 주세요.',
  delete_transfer_auth_failed: '세션이 만료되었습니다. 다시 로그인해 주세요.',
  delete_warning_owner_title: '⚠️ 그룹 소유자 탈퇴 경고\n\n회원탈퇴 시 다음 사항이 발생합니다:',
  delete_warning_owner_groups: '소유 그룹:',
  delete_warning_owner_deleted:
    '⚠️ 삭제되는 내용:\n• 소유한 그룹이 영구적으로 삭제됩니다\n• 그룹의 모든 데이터가 삭제됩니다\n• 그룹의 모든 멤버가 자동으로 탈퇴됩니다\n• 이 작업은 되돌릴 수 없습니다',
  delete_warning_owner_final: '정말로 탈퇴하시겠습니까?',
  leave_section_title: '그룹',
  leave_section_hint:
    '멤버로 가입한 그룹에서 나가거나, 소유한 그룹을 삭제·소유권 이양할 수 있습니다.',
  leave_owned_title: '내가 소유한 그룹',
  leave_owned_hint:
    '그룹을 영구 삭제하거나, 다른 멤버에게 소유권을 넘길 수 있습니다. 계정은 유지됩니다.',
  leave_owned_empty: '소유 중인 그룹이 없습니다.',
  leave_delete_group_btn: '그룹 삭제',
  leave_delete_group_aria: '이 그룹을 영구 삭제',
  leave_delete_confirm:
    '「{name}」 그룹을 영구 삭제할까요?\n\n그룹의 모든 데이터가 삭제되며 되돌릴 수 없습니다. 계정은 유지됩니다.',
  leave_delete_success: '그룹을 삭제했습니다.',
  leave_delete_failed: '그룹 삭제에 실패했습니다.',
  leave_transfer_btn: '소유권 이양',
  leave_transfer_aria: '그룹 소유권 이양',
  leave_transfer_pick: '새 소유자로 지정할 멤버를 선택하세요',
  leave_transfer_confirm:
    '「{name}」 소유권을 이 멤버에게 넘길까요?\n\n본인은 멤버로 남습니다. 이후 그룹 탈퇴가 가능합니다.',
  leave_transfer_success: '소유권을 이양했습니다.',
  leave_transfer_failed: '소유권 이양에 실패했습니다.',
  leave_transfer_no_members:
    '이양할 다른 멤버가 없습니다. 먼저 초대하거나, 그룹을 삭제하세요.',
  leave_transfer_cancel: '취소',
  leave_current_group: '현재 그룹',
  leave_no_group: '선택된 그룹이 없습니다. 멤버로 나가려면 그룹 대시보드에 들어간 뒤 이용하세요.',
  leave_group_btn: '그룹 탈퇴',
  leave_group_aria: '이 그룹에서 나가기',
  leave_confirm:
    '이 그룹에서 나가시겠습니까?\n\n계정은 유지되며, 초대 코드로 다시 가입할 수 있습니다.',
  leave_success: '그룹에서 탈퇴했습니다.',
  leave_failed: '그룹 탈퇴에 실패했습니다.',
  leave_owner_blocked:
    '이 그룹의 소유자입니다. 위 목록에서 삭제하거나 소유권을 이양하세요. 단순 탈퇴는 할 수 없습니다.',
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
