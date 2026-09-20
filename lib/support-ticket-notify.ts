import { getSupabaseServerClient } from '@/lib/api-helpers';
import { CURRENT_APP_ID, isAppId, type AppId } from '@/lib/apps';
import { getGroupAdminUserIds, notifyFamily } from '@/lib/notifications/notify';
import { sendWebPushToUser } from '@/lib/notifications/send-web-push';
import { isValidLang, type LangCode } from '@/lib/language-fonts';

const PUSH_COPY: Record<
  LangCode,
  { newTicket: string; followUp: string; reply: string; accessRequest: string }
> = {
  ko: {
    newTicket: '새 문의가 도착했습니다',
    followUp: '문의에 답장이 있습니다',
    reply: '시스템 관리자 답장이 있습니다',
    accessRequest: '대시보드 접근 요청이 있습니다',
  },
  en: {
    newTicket: 'New support inquiry',
    followUp: 'New reply on a support inquiry',
    reply: 'System admin replied to your inquiry',
    accessRequest: 'New dashboard access request',
  },
  ja: {
    newTicket: '新しい問い合わせがあります',
    followUp: '問い合わせに返信があります',
    reply: 'システム管理者から返信があります',
    accessRequest: 'ダッシュボードアクセス申請があります',
  },
  'zh-CN': {
    newTicket: '收到新的咨询',
    followUp: '咨询有新回复',
    reply: '系统管理员已回复您的咨询',
    accessRequest: '收到仪表盘访问申请',
  },
  'zh-TW': {
    newTicket: '收到新的諮詢',
    followUp: '諮詢有新回覆',
    reply: '系統管理員已回覆您的諮詢',
    accessRequest: '收到儀表板存取申請',
  },
  es: {
    newTicket: 'Nueva consulta de soporte',
    followUp: 'Nueva respuesta en una consulta',
    reply: 'El administrador del sistema respondió',
    accessRequest: 'Nueva solicitud de acceso al panel',
  },
  fr: {
    newTicket: 'Nouvelle demande de support',
    followUp: 'Nouvelle réponse à une demande',
    reply: 'L’administrateur système a répondu',
    accessRequest: 'Nouvelle demande d’accès au tableau de bord',
  },
  de: {
    newTicket: 'Neue Support-Anfrage',
    followUp: 'Neue Antwort auf eine Anfrage',
    reply: 'Systemadministrator hat geantwortet',
    accessRequest: 'Neue Dashboard-Zugriffsanfrage',
  },
  it: {
    newTicket: 'Nuova richiesta di supporto',
    followUp: 'Nuova risposta a una richiesta',
    reply: 'L’amministratore di sistema ha risposto',
    accessRequest: 'Nuova richiesta di accesso alla dashboard',
  },
  pt: {
    newTicket: 'Nova solicitação de suporte',
    followUp: 'Nova resposta em uma solicitação',
    reply: 'O administrador do sistema respondeu',
    accessRequest: 'Nova solicitação de acesso ao painel',
  },
};

function clipBody(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 117)}...`;
}

async function loadLangByUser(userIds: string[]): Promise<Map<string, LangCode>> {
  const map = new Map<string, LangCode>();
  if (userIds.length === 0) return map;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from('profiles').select('id, preferred_language').in('id', userIds);
  for (const row of data || []) {
    const id = String((row as { id: string }).id);
    const lang = String((row as { preferred_language?: string | null }).preferred_language || '');
    map.set(id, isValidLang(lang) ? lang : 'ko');
  }
  return map;
}

async function resolveGroupAppId(groupId: string): Promise<AppId> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase.from('groups').select('app_id').eq('id', groupId).maybeSingle();
    const appId = data?.app_id ? String(data.app_id) : '';
    return isAppId(appId) ? appId : CURRENT_APP_ID;
  } catch {
    return CURRENT_APP_ID;
  }
}

async function pushLocalized(params: {
  userIds: string[];
  actorUserId: string | null;
  tag: string;
  url: string;
  titleOf: (lang: LangCode) => string;
  body: string;
  appId?: string;
}): Promise<void> {
  const unique = [
    ...new Set(params.userIds.map((id) => String(id)).filter((id) => id && id !== params.actorUserId)),
  ];
  if (unique.length === 0) return;

  const langs = await loadLangByUser(unique);
  await Promise.all(
    unique.map(async (userId) => {
      const lang = langs.get(userId) || 'ko';
      try {
        await sendWebPushToUser(
          userId,
          {
            title: params.titleOf(lang),
            body: params.body,
            tag: params.tag,
            data: { url: params.url, type: 'SUPPORT_TICKET' },
          },
          undefined,
          params.appId,
        );
      } catch (error) {
        console.error('[support-ticket-notify] 푸시 실패:', userId, error);
      }
    }),
  );
}

/**
 * 그룹 관리자 → 시스템 관리자: 새 문의 / 답장(추가 문의)
 * 시스템 관리자는 /admin 중심이라 웹푸시만 발송 (정지 문의와 동일 패턴).
 */
export async function notifySystemAdminsOfSupportTicket(params: {
  actorUserId: string;
  ticketId: string;
  groupId: string;
  title: string;
  content: string;
  kind: 'new' | 'follow_up';
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: admins } = await supabase.from('system_admins').select('user_id');
    const recipients = (admins || []).map((row) => String((row as { user_id: string }).user_id));
    if (recipients.length === 0) return;

    const body = clipBody(params.title || params.content);
    await pushLocalized({
      userIds: recipients,
      actorUserId: params.actorUserId,
      tag: `support-ticket-${params.kind}-${params.ticketId}`,
      url: '/admin',
      titleOf: (lang) =>
        params.kind === 'new' ? PUSH_COPY[lang].newTicket : PUSH_COPY[lang].followUp,
      body,
    });
  } catch (error) {
    console.error('[notifySystemAdminsOfSupportTicket] 오류:', error);
  }
}

/**
 * 시스템 관리자 → 그룹 관리자: 답변/재답변
 * 인앱(NotificationCenter) + 웹푸시 (notifyFamily, widget=group).
 */
export async function notifyGroupAdminsOfSupportReply(params: {
  actorUserId: string;
  ticketId: string;
  groupId: string;
  title: string;
  answer: string;
}): Promise<void> {
  try {
    const admins = await getGroupAdminUserIds(params.groupId);
    if (admins.length === 0) return;

    const appId = await resolveGroupAppId(params.groupId);
    const body = clipBody(params.title || params.answer);

    await notifyFamily({
      groupId: params.groupId,
      actorUserId: params.actorUserId,
      recipientUserIds: admins,
      widgetKey: 'group',
      eventType: 'SUPPORT_TICKET_REPLY',
      title: '💬 시스템 관리자 답장',
      body,
      url: '/group-admin',
      entityId: params.ticketId,
      appId,
      tag: `support-reply-${params.ticketId}`,
      payload: { ticketId: params.ticketId },
    });
  } catch (error) {
    console.error('[notifyGroupAdminsOfSupportReply] 오류:', error);
  }
}

/**
 * 그룹 관리자 → 시스템 관리자: 대시보드 접근 요청
 */
export async function notifySystemAdminsOfDashboardAccessRequest(params: {
  actorUserId: string;
  requestId: string;
  groupId: string;
  reason: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: admins } = await supabase.from('system_admins').select('user_id');
    const recipients = (admins || []).map((row) => String((row as { user_id: string }).user_id));
    if (recipients.length === 0) return;

    await pushLocalized({
      userIds: recipients,
      actorUserId: params.actorUserId,
      tag: `dashboard-access-${params.requestId}`,
      url: '/admin',
      titleOf: (lang) => PUSH_COPY[lang].accessRequest,
      body: clipBody(params.reason),
    });
  } catch (error) {
    console.error('[notifySystemAdminsOfDashboardAccessRequest] 오류:', error);
  }
}
