import { isValidLang, type LangCode } from '@/lib/language-fonts';

export type AppErrorCopy = {
  title: string;
  networkHint: string;
  genericHint: string;
  retry: string;
  reload: string;
};

const APP_ERROR_COPY: Record<LangCode, AppErrorCopy> = {
  ko: {
    title: '일시적인 오류',
    networkHint:
      '인터넷 연결이 불안정하거나 앱이 방금 업데이트되어 화면을 불러오지 못했을 수 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
    genericHint: '예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.',
    retry: '다시 시도',
    reload: '새로고침',
  },
  en: {
    title: 'Temporary error',
    networkHint:
      'The connection may be unstable or the app was just updated. Check your network and try again.',
    genericHint: 'Something went wrong. Please try again.',
    retry: 'Try again',
    reload: 'Reload',
  },
  ja: {
    title: '一時的なエラー',
    networkHint:
      '接続が不安定か、アプリが更新された直後の可能性があります。接続を確認して再度お試しください。',
    genericHint: '予期しないエラーが発生しました。もう一度お試しください。',
    retry: '再試行',
    reload: '再読み込み',
  },
  'zh-CN': {
    title: '临时错误',
    networkHint: '网络可能不稳定，或应用刚更新导致页面加载失败。请检查网络后重试。',
    genericHint: '发生意外错误，请重试。',
    retry: '重试',
    reload: '刷新',
  },
  'zh-TW': {
    title: '暫時錯誤',
    networkHint: '網路可能不穩定，或應用程式剛更新導致頁面載入失敗。請檢查網路後重試。',
    genericHint: '發生意外錯誤，請重試。',
    retry: '重試',
    reload: '重新整理',
  },
  es: {
    title: 'Error temporal',
    networkHint:
      'La conexión puede ser inestable o la app se acaba de actualizar. Comprueba la red e inténtalo de nuevo.',
    genericHint: 'Algo salió mal. Inténtalo de nuevo.',
    retry: 'Reintentar',
    reload: 'Recargar',
  },
  fr: {
    title: 'Erreur temporaire',
    networkHint:
      'La connexion est peut-être instable ou l’application vient d’être mise à jour. Vérifiez le réseau et réessayez.',
    genericHint: 'Une erreur inattendue s’est produite. Veuillez réessayer.',
    retry: 'Réessayer',
    reload: 'Actualiser',
  },
  de: {
    title: 'Vorübergehender Fehler',
    networkHint:
      'Die Verbindung ist möglicherweise instabil oder die App wurde gerade aktualisiert. Bitte Netzwerk prüfen und erneut versuchen.',
    genericHint: 'Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen.',
    retry: 'Erneut versuchen',
    reload: 'Neu laden',
  },
  it: {
    title: 'Errore temporaneo',
    networkHint:
      'La connessione potrebbe essere instabile o l’app è stata appena aggiornata. Controlla la rete e riprova.',
    genericHint: 'Si è verificato un errore imprevisto. Riprova.',
    retry: 'Riprova',
    reload: 'Ricarica',
  },
  pt: {
    title: 'Erro temporário',
    networkHint:
      'A conexão pode estar instável ou o app acabou de ser atualizado. Verifique a rede e tente novamente.',
    genericHint: 'Ocorreu um erro inesperado. Tente novamente.',
    retry: 'Tentar novamente',
    reload: 'Recarregar',
  },
};

const STORAGE_KEY = 'app_preferred_language';

export function getAppErrorCopy(): AppErrorCopy {
  if (typeof window === 'undefined') {
    return APP_ERROR_COPY.en;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isValidLang(raw)) {
      return APP_ERROR_COPY[raw];
    }
  } catch {
    // ignore
  }
  return APP_ERROR_COPY.ko;
}
