import type { LangCode } from '@/lib/language-fonts';

export type AccountAccessErrorTranslations = {
  title: string;
  intro: string;
  retry: string;
  logout: string;
};

const t: Record<LangCode, AccountAccessErrorTranslations> = {
  ko: {
    title: '잠시 확인할 수 없습니다',
    intro: '이용 상태를 확인하지 못했습니다. 계정이 정지된 것은 아닙니다. 잠시 후 다시 시도해 주세요.',
    retry: '다시 시도',
    logout: '로그아웃',
  },
  en: {
    title: 'Could not check access',
    intro: 'We could not confirm your access status. Your account is not suspended. Please try again in a moment.',
    retry: 'Try again',
    logout: 'Log out',
  },
  ja: {
    title: '一時的に確認できません',
    intro: '利用状態を確認できませんでした。停止されたわけではありません。しばらくして再試行してください。',
    retry: '再試行',
    logout: 'ログアウト',
  },
  'zh-CN': {
    title: '暂时无法确认',
    intro: '未能确认使用状态。账号并未被停用。请稍后再试。',
    retry: '重试',
    logout: '退出登录',
  },
  'zh-TW': {
    title: '暫時無法確認',
    intro: '未能確認使用狀態。帳號並未被停用。請稍後再試。',
    retry: '重試',
    logout: '登出',
  },
  es: {
    title: 'No se pudo comprobar el acceso',
    intro: 'No se pudo confirmar el estado. La cuenta no está suspendida. Inténtelo de nuevo en un momento.',
    retry: 'Reintentar',
    logout: 'Cerrar sesión',
  },
  fr: {
    title: 'Vérification impossible',
    intro: 'Impossible de confirmer l’accès. Le compte n’est pas suspendu. Réessayez dans un instant.',
    retry: 'Réessayer',
    logout: 'Se déconnecter',
  },
  de: {
    title: 'Zugriff konnte nicht geprüft werden',
    intro: 'Der Status konnte nicht bestätigt werden. Das Konto ist nicht gesperrt. Bitte später erneut versuchen.',
    retry: 'Erneut versuchen',
    logout: 'Abmelden',
  },
  it: {
    title: 'Impossibile verificare l’accesso',
    intro: 'Non è stato possibile confermare lo stato. L’account non è sospeso. Riprovare tra poco.',
    retry: 'Riprova',
    logout: 'Esci',
  },
  pt: {
    title: 'Não foi possível verificar o acesso',
    intro: 'Não foi possível confirmar o estado. A conta não está suspensa. Tente novamente dentro de momentos.',
    retry: 'Tentar novamente',
    logout: 'Terminar sessão',
  },
};

export function getAccountAccessErrorTranslation(
  lang: LangCode,
  key: keyof AccountAccessErrorTranslations,
): string {
  return t[lang]?.[key] ?? t.en[key] ?? t.ko[key] ?? key;
}
