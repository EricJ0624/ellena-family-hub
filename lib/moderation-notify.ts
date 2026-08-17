import { getSupabaseServerClient } from '@/lib/api-helpers';
import { getGroupMemberUserIds } from '@/lib/notifications/notify';
import { sendWebPushToUser } from '@/lib/notifications/send-web-push';
import { isValidLang, type LangCode } from '@/lib/language-fonts';
import type { ModerationAuthorKind, SuspendAction, SuspendScope } from '@/lib/admin-suspend';

const PUSH_COPY: Record<LangCode, { suspend: string; unsuspend: string; reply: string }> = {
  ko: { suspend: '이용이 정지되었습니다', unsuspend: '이용 정지가 해제되었습니다', reply: '정지 문의에 답장이 있습니다' },
  en: { suspend: 'Access is suspended', unsuspend: 'Access has been restored', reply: 'There is a new reply on your suspension inquiry' },
  ja: { suspend: '利用が停止されています', unsuspend: '利用停止が解除されました', reply: '停止の問い合わせに返信があります' },
  'zh-CN': { suspend: '使用已被停用', unsuspend: '使用停用已解除', reply: '停用咨询有新回复' },
  'zh-TW': { suspend: '使用已被停用', unsuspend: '使用停用已解除', reply: '停用諮詢有新回覆' },
  es: { suspend: 'El acceso está suspendido', unsuspend: 'El acceso ha sido restablecido', reply: 'Hay una nueva respuesta en su consulta' },
  fr: { suspend: 'Accès suspendu', unsuspend: 'L’accès a été rétabli', reply: 'Nouvelle réponse à votre demande' },
  de: { suspend: 'Zugang gesperrt', unsuspend: 'Zugang wiederhergestellt', reply: 'Neue Antwort auf Ihre Anfrage' },
  it: { suspend: 'Accesso sospeso', unsuspend: 'Accesso ripristinato', reply: 'C’è una nuova risposta alla richiesta' },
  pt: { suspend: 'O acesso está suspenso', unsuspend: 'O acesso foi restabelecido', reply: 'Há uma nova resposta no pedido' },
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

async function pushToUsers(params: {
  userIds: string[];
  actorUserId: string | null;
  tag: string;
  url: string;
  titleOf: (lang: LangCode) => string;
  body: string;
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
        await sendWebPushToUser(userId, {
          title: params.titleOf(lang),
          body: params.body,
          tag: params.tag,
          data: { url: params.url },
        });
      } catch (error) {
        console.error('[moderation-notify] 푸시 실패:', userId, error);
      }
    }),
  );
}

export async function notifySuspendAction(params: {
  action: SuspendAction;
  scope: SuspendScope;
  adminId: string;
  groupId: string;
  userId: string | null;
  message: string;
}): Promise<void> {
  try {
    const recipients =
      params.scope === 'user_in_group' && params.userId
        ? [params.userId]
        : await getGroupMemberUserIds(params.groupId);
    const url =
      params.action === 'unsuspend' ? '/dashboard' : `/suspended?group=${encodeURIComponent(params.groupId)}`;
    await pushToUsers({
      userIds: recipients,
      actorUserId: params.adminId,
      tag: `moderation-${params.action}-${params.groupId}`,
      url,
      titleOf: (lang) =>
        params.action === 'unsuspend' ? PUSH_COPY[lang].unsuspend : PUSH_COPY[lang].suspend,
      body: clipBody(params.message),
    });
  } catch (error) {
    console.error('[notifySuspendAction] 오류:', error);
  }
}

export async function notifyModerationReply(params: {
  threadId: string;
  authorId: string;
  authorKind: ModerationAuthorKind;
  body: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: thread, error } = await supabase
      .from('moderation_threads' as never)
      .select('id, group_id, user_id')
      .eq('id', params.threadId)
      .maybeSingle();
    if (error || !thread) return;

    const row = thread as { group_id: string; user_id: string | null };
    let recipients: string[];
    let url: string;
    if (params.authorKind === 'member') {
      const { data: admins } = await supabase.from('system_admins').select('user_id');
      recipients = (admins || []).map((admin) => String((admin as { user_id: string }).user_id));
      url = '/admin';
    } else if (row.user_id) {
      recipients = [String(row.user_id)];
      url = `/suspended?group=${encodeURIComponent(row.group_id)}`;
    } else {
      recipients = await getGroupMemberUserIds(String(row.group_id));
      url = `/suspended?group=${encodeURIComponent(row.group_id)}`;
    }

    await pushToUsers({
      userIds: recipients,
      actorUserId: params.authorId,
      tag: `moderation-reply-${params.threadId}`,
      url,
      titleOf: (lang) => PUSH_COPY[lang].reply,
      body: clipBody(params.body),
    });
  } catch (error) {
    console.error('[notifyModerationReply] 오류:', error);
  }
}
