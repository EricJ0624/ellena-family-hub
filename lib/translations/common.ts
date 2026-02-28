import type { LangCode } from '@/lib/language-fonts';

export type CommonTranslations = {
  user: string;
  me: string;
  me_suffix: string; // " (나)"
  anyone: string;
  unknown: string;
  member: string;
  delete: string;
  cancel: string;
  confirm: string;
  save: string;
  loading: string;
  admin: string;
  logout: string;
  close: string;
  delete_confirm: string; // "삭제하시겠습니까?"
  error_unknown: string;
};

const common: Record<LangCode, CommonTranslations> = {
  ko: {
    user: '사용자',
    me: '나',
    me_suffix: ' (나)',
    anyone: '누구나',
    unknown: '알 수 없음',
    member: '멤버',
    delete: '삭제',
    cancel: '취소',
    confirm: '확인',
    save: '저장',
    loading: '로딩 중...',
    admin: '관리자',
    logout: '로그아웃',
    close: '닫기',
    delete_confirm: '삭제하시겠습니까?',
    error_unknown: '알 수 없는 오류',
  },
  en: {
    user: 'User',
    me: 'Me',
    me_suffix: ' (me)',
    anyone: 'Anyone',
    unknown: 'Unknown',
    member: 'Member',
    delete: 'Delete',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    loading: 'Loading...',
    admin: 'Admin',
    logout: 'Log out',
    close: 'Close',
    delete_confirm: 'Are you sure you want to delete?',
    error_unknown: 'Unknown error',
  },
  ja: {
    user: 'ユーザー',
    me: '自分',
    me_suffix: ' (自分)',
    anyone: '誰でも',
    unknown: '不明',
    member: 'メンバー',
    delete: '削除',
    cancel: 'キャンセル',
    confirm: '確認',
    save: '保存',
    loading: '読み込み中...',
    admin: '管理者',
    logout: 'ログアウト',
    close: '閉じる',
    delete_confirm: '削除してもよろしいですか？',
    error_unknown: '不明なエラー',
  },
  'zh-CN': {
    user: '用户',
    me: '我',
    me_suffix: ' (我)',
    anyone: '任何人',
    unknown: '未知',
    member: '成员',
    delete: '删除',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    loading: '加载中...',
    admin: '管理',
    logout: '退出登录',
    close: '关闭',
    delete_confirm: '确定要删除吗？',
    error_unknown: '未知错误',
  },
  'zh-TW': {
    user: '使用者',
    me: '我',
    me_suffix: ' (我)',
    anyone: '任何人',
    unknown: '未知',
    member: '成員',
    delete: '刪除',
    cancel: '取消',
    confirm: '確認',
    save: '儲存',
    loading: '載入中...',
    admin: '管理員',
    logout: '登出',
    close: '關閉',
    delete_confirm: '確定要刪除嗎？',
    error_unknown: '未知錯誤',
  },
};

export function getCommonTranslation(lang: LangCode, key: keyof CommonTranslations): string {
  return common[lang]?.[key] ?? common.en[key] ?? (common.ko[key] as string) ?? key;
}
