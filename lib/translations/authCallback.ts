import type { LangCode } from '@/lib/language-fonts';

export type AuthCallbackTranslations = {
  processing: string;
  redirect_message: string;
  error_message: string;
};

const authCallback: Record<LangCode, AuthCallbackTranslations> = {
  ko: {
    processing: '인증 처리 중...',
    redirect_message: '잠시 후 로그인 페이지로 이동합니다...',
    error_message: '인증 처리 중 오류가 발생했습니다.',
  },
  en: {
    processing: 'Signing you in...',
    redirect_message: 'Redirecting to login shortly...',
    error_message: 'An error occurred during sign-in.',
  },
  ja: {
    processing: '認証処理中...',
    redirect_message: 'まもなくログインページに移動します...',
    error_message: '認証処理中にエラーが発生しました。',
  },
  'zh-CN': {
    processing: '正在登录...',
    redirect_message: '即将跳转到登录页...',
    error_message: '登录过程中发生错误。',
  },
  'zh-TW': {
    processing: '正在登入...',
    redirect_message: '即將跳轉至登入頁...',
    error_message: '登入過程中發生錯誤。',
  },
  es: {
    processing: 'Iniciando sesión...',
    redirect_message: 'Redirigiendo al inicio de sesión...',
    error_message: 'Se produjo un error al iniciar sesión.',
  },
  fr: {
    processing: 'Connexion en cours...',
    redirect_message: 'Redirection vers la connexion...',
    error_message: 'Une erreur s\'est produite lors de la connexion.',
  },
  de: {
    processing: 'Anmeldung läuft...',
    redirect_message: 'Weiterleitung zur Anmeldung...',
    error_message: 'Bei der Anmeldung ist ein Fehler aufgetreten.',
  },
  it: {
    processing: 'Accesso in corso...',
    redirect_message: 'Reindirizzamento al login...',
    error_message: 'Si è verificato un errore durante l\'accesso.',
  },
  pt: {
    processing: 'Autenticando...',
    redirect_message: 'Redirecionando para o login em instantes...',
    error_message: 'Ocorreu um erro durante a autenticação.',
  },
};

export function getAuthCallbackTranslation(lang: LangCode, key: keyof AuthCallbackTranslations): string {
  return authCallback[lang]?.[key] ?? authCallback.en[key] ?? (authCallback.ko[key] as string) ?? key;
}
