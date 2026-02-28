import type { LangCode } from '@/lib/language-fonts';

export type ResetPasswordTranslations = {
  title: string;
  subtitle: string;
  placeholder_new_password: string;
  placeholder_confirm: string;
  btn_loading: string;
  btn_submit: string;
  success_reset: string;
  error_reset_failed: string;
};

const resetPassword: Record<LangCode, ResetPasswordTranslations> = {
  ko: {
    title: '비밀번호 재설정',
    subtitle: '새로운 비밀번호를\n입력해주세요',
    placeholder_new_password: '새 비밀번호',
    placeholder_confirm: '비밀번호 확인',
    btn_loading: '변경 중',
    btn_submit: '비밀번호 변경',
    success_reset: '비밀번호가 성공적으로 변경되었습니다!',
    error_reset_failed: '비밀번호 변경 실패: 다시 시도해주세요.',
  },
  en: {
    title: 'Reset password',
    subtitle: 'Enter your new password',
    placeholder_new_password: 'New password',
    placeholder_confirm: 'Confirm password',
    btn_loading: 'Updating...',
    btn_submit: 'Update password',
    success_reset: 'Password has been updated successfully!',
    error_reset_failed: 'Password update failed. Please try again.',
  },
  ja: {
    title: 'パスワードのリセット',
    subtitle: '新しいパスワードを\n入力してください',
    placeholder_new_password: '新しいパスワード',
    placeholder_confirm: 'パスワード（確認）',
    btn_loading: '変更中...',
    btn_submit: 'パスワードを変更',
    success_reset: 'パスワードが正常に変更されました。',
    error_reset_failed: 'パスワードの変更に失敗しました。もう一度お試しください。',
  },
  'zh-CN': {
    title: '重设密码',
    subtitle: '请输入新密码',
    placeholder_new_password: '新密码',
    placeholder_confirm: '确认密码',
    btn_loading: '更新中...',
    btn_submit: '更新密码',
    success_reset: '密码已成功更新！',
    error_reset_failed: '密码更新失败，请重试。',
  },
  'zh-TW': {
    title: '重設密碼',
    subtitle: '請輸入新密碼',
    placeholder_new_password: '新密碼',
    placeholder_confirm: '確認密碼',
    btn_loading: '更新中...',
    btn_submit: '更新密碼',
    success_reset: '密碼已成功更新！',
    error_reset_failed: '密碼更新失敗，請重試。',
  },
};

export function getResetPasswordTranslation(lang: LangCode, key: keyof ResetPasswordTranslations): string {
  return resetPassword[lang]?.[key] ?? resetPassword.en[key] ?? (resetPassword.ko[key] as string) ?? key;
}
