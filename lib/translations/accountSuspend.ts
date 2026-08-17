import type { LangCode } from '@/lib/language-fonts';

export type AccountSuspendNoticeTranslations = {
  title: string;
  intro: string;
  no_message: string;
  other_group: string;
  go_admin: string;
  logout: string;
  reply_label: string;
  reply_placeholder: string;
  send: string;
  reply_failed: string;
  from_admin: string;
  from_member: string;
  from_member_other: string;
};

const t: Record<LangCode, AccountSuspendNoticeTranslations> = {
  ko: {
    title: '이용이 정지되었습니다',
    intro: '시스템 관리자의 안내입니다. 로그인은 유지되며, 아래 내용으로 문의가 전달됩니다.',
    no_message: '아직 안내 메시지가 없습니다.',
    other_group: '다른 그룹으로 이동',
    go_admin: '시스템 관리',
    logout: '로그아웃',
    reply_label: '답장',
    reply_placeholder: '관리자에게 전달할 내용을 적어 주세요.',
    send: '보내기',
    reply_failed: '답장을 보내지 못했습니다.',
    from_admin: '시스템 관리자',
    from_member: '나',
    from_member_other: '회원',
  },
  en: {
    title: 'Access is suspended',
    intro: 'This notice is from the system admin. You stay signed in, and this thread is your inquiry.',
    no_message: 'No notice has been posted yet.',
    other_group: 'Go to another group',
    go_admin: 'System admin',
    logout: 'Log out',
    reply_label: 'Reply',
    reply_placeholder: 'Write a message to the system admin.',
    send: 'Send',
    reply_failed: 'Could not send the reply.',
    from_admin: 'System admin',
    from_member: 'You',
    from_member_other: 'Member',
  },
  ja: {
    title: '利用が停止されています',
    intro: 'システム管理者からの案内です。ログインはそのまま維持され、この内容が問い合わせになります。',
    no_message: 'まだ案内メッセージがありません。',
    other_group: '別のグループへ',
    go_admin: 'システム管理',
    logout: 'ログアウト',
    reply_label: '返信',
    reply_placeholder: '管理者へのメッセージを書いてください。',
    send: '送信',
    reply_failed: '返信を送れませんでした。',
    from_admin: 'システム管理者',
    from_member: '自分',
    from_member_other: '会員',
  },
  'zh-CN': {
    title: '使用已被停用',
    intro: '这是系统管理员的说明。您仍保持登录，此内容将作为咨询记录。',
    no_message: '暂无说明消息。',
    other_group: '前往其他群组',
    go_admin: '系统管理',
    logout: '退出登录',
    reply_label: '回复',
    reply_placeholder: '请填写要发给管理员的内容。',
    send: '发送',
    reply_failed: '回复发送失败。',
    from_admin: '系统管理员',
    from_member: '我',
    from_member_other: '成员',
  },
  'zh-TW': {
    title: '使用已被停用',
    intro: '這是系統管理員的說明。您仍保持登入，此內容會作為諮詢紀錄。',
    no_message: '尚無說明訊息。',
    other_group: '前往其他群組',
    go_admin: '系統管理',
    logout: '登出',
    reply_label: '回覆',
    reply_placeholder: '請填寫要傳給管理員的內容。',
    send: '送出',
    reply_failed: '回覆送出失敗。',
    from_admin: '系統管理員',
    from_member: '我',
    from_member_other: '成員',
  },
  es: {
    title: 'El acceso está suspendido',
    intro: 'Aviso del administrador del sistema. Seguirá conectado y este hilo es su consulta.',
    no_message: 'Aún no hay un aviso.',
    other_group: 'Ir a otro grupo',
    go_admin: 'Administración',
    logout: 'Cerrar sesión',
    reply_label: 'Respuesta',
    reply_placeholder: 'Escriba un mensaje para el administrador.',
    send: 'Enviar',
    reply_failed: 'No se pudo enviar la respuesta.',
    from_admin: 'Administrador',
    from_member: 'Usted',
    from_member_other: 'Miembro',
  },
  fr: {
    title: 'Accès suspendu',
    intro: 'Avis de l’administrateur système. Vous restez connecté ; ce fil est votre demande.',
    no_message: 'Aucun avis pour le moment.',
    other_group: 'Aller à un autre groupe',
    go_admin: 'Administration',
    logout: 'Se déconnecter',
    reply_label: 'Réponse',
    reply_placeholder: 'Écrivez un message à l’administrateur.',
    send: 'Envoyer',
    reply_failed: 'Impossible d’envoyer la réponse.',
    from_admin: 'Administrateur',
    from_member: 'Vous',
    from_member_other: 'Membre',
  },
  de: {
    title: 'Zugang gesperrt',
    intro: 'Hinweis der Systemverwaltung. Sie bleiben angemeldet; dieser Verlauf ist Ihre Anfrage.',
    no_message: 'Noch kein Hinweis vorhanden.',
    other_group: 'Zu einer anderen Gruppe',
    go_admin: 'Systemverwaltung',
    logout: 'Abmelden',
    reply_label: 'Antwort',
    reply_placeholder: 'Nachricht an die Verwaltung schreiben.',
    send: 'Senden',
    reply_failed: 'Antwort konnte nicht gesendet werden.',
    from_admin: 'Systemverwaltung',
    from_member: 'Sie',
    from_member_other: 'Mitglied',
  },
  it: {
    title: 'Accesso sospeso',
    intro: 'Avviso dell’amministratore di sistema. Restate connessi; questo è il vostro ticket.',
    no_message: 'Nessun avviso al momento.',
    other_group: 'Vai a un altro gruppo',
    go_admin: 'Amministrazione',
    logout: 'Esci',
    reply_label: 'Risposta',
    reply_placeholder: 'Scrivete un messaggio all’amministratore.',
    send: 'Invia',
    reply_failed: 'Impossibile inviare la risposta.',
    from_admin: 'Amministratore',
    from_member: 'Voi',
    from_member_other: 'Membro',
  },
  pt: {
    title: 'O acesso está suspenso',
    intro: 'Aviso do administrador do sistema. Continua com sessão iniciada; este tópico é o seu pedido.',
    no_message: 'Ainda não há aviso.',
    other_group: 'Ir para outro grupo',
    go_admin: 'Administração',
    logout: 'Terminar sessão',
    reply_label: 'Resposta',
    reply_placeholder: 'Escreva uma mensagem para o administrador.',
    send: 'Enviar',
    reply_failed: 'Não foi possível enviar a resposta.',
    from_admin: 'Administrador',
    from_member: 'Você',
    from_member_other: 'Membro',
  },
};

export function getAccountSuspendNoticeTranslation(
  lang: LangCode,
  key: keyof AccountSuspendNoticeTranslations,
): string {
  return t[lang]?.[key] ?? t.en[key] ?? t.ko[key] ?? key;
}
