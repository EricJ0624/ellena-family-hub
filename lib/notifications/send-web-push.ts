import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let webpushModule: typeof import('web-push') | null = null;

async function getWebPush() {
  if (!webpushModule) {
    webpushModule = await import('web-push');
  }
  return webpushModule;
}

function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface SendWebPushResult {
  ok: boolean;
  reason?: 'no_vapid' | 'no_token' | 'send_failed';
  sent?: number;
  failed?: number;
  message?: string;
}

/**
 * 사용자 active push_tokens(최대 5개)로 Web Push 발송.
 * APP_URL self-fetch 없이 서버에서 직접 호출한다.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload,
  supabaseClient?: SupabaseClient,
): Promise<SendWebPushResult> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:your-email@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[sendWebPush] VAPID 키가 설정되지 않았습니다.');
    return { ok: false, reason: 'no_vapid', message: 'VAPID 키가 없습니다.' };
  }

  const supabase = supabaseClient ?? getServiceSupabase();
  const { data: tokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (tokenError || !tokens || tokens.length === 0) {
    console.warn('[sendWebPush] Push 토큰 없음:', userId, tokenError?.message);
    return { ok: true, reason: 'no_token', sent: 0, failed: 0, message: 'Push 토큰이 없습니다.' };
  }

  const webpush = await getWebPush();
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    tag: payload.tag,
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;

  for (const row of tokens) {
    try {
      const subscription = JSON.parse(row.token);
      await webpush.sendNotification(subscription, body);
      sent += 1;
    } catch (pushError: unknown) {
      failed += 1;
      const statusCode =
        pushError && typeof pushError === 'object' && 'statusCode' in pushError
          ? Number((pushError as { statusCode?: number }).statusCode)
          : undefined;
      console.error('[sendWebPush] 전송 실패:', statusCode, pushError);
      if (statusCode === 410 || statusCode === 404) {
        await supabase
          .from('push_tokens')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('token', row.token);
      }
    }
  }

  return {
    ok: failed === 0 || sent > 0,
    reason: sent === 0 && failed > 0 ? 'send_failed' : undefined,
    sent,
    failed,
    message: sent > 0 ? '푸시 알림이 전송되었습니다.' : '푸시 전송에 실패했습니다.',
  };
}
