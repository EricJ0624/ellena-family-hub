import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * 같은 topic Realtime 채널을 컴포넌트 마운트/언마운트 사이에 재사용한다.
 *
 * 돋보기(S 위젯)는 그리드에서 언마운트 후 모달에 바로 다시 마운트한다.
 * 그때 removeChannel + 동일 이름 재구독이 겹치면 CLOSED 레이스와 메인 스레드 정지가 난다.
 * refCount + 지연 해제로 그 전환에서는 채널을 끊지 않는다.
 */
type Lease = {
  channel: RealtimeChannel;
  refCount: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

const leases = new Map<string, Lease>();
const RELEASE_DELAY_MS = 400;

export function acquireRealtimeChannel(
  topic: string,
  bind: (channel: RealtimeChannel) => RealtimeChannel,
): () => void {
  let lease = leases.get(topic);

  if (lease?.releaseTimer) {
    clearTimeout(lease.releaseTimer);
    lease.releaseTimer = null;
  }

  const state = lease?.channel.state;
  if (!lease || state === 'closed' || state === 'errored') {
    const channel = bind(supabase.channel(topic));
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (process.env.NODE_ENV === 'development') {
          console.log('[realtime] subscribed', topic);
        }
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[realtime] error', topic, status);
      }
    });
    lease = { channel, refCount: 0, releaseTimer: null };
    leases.set(topic, lease);
  }

  lease.refCount += 1;

  return () => {
    const current = leases.get(topic);
    if (!current) return;
    current.refCount -= 1;
    if (current.refCount > 0) return;
    current.releaseTimer = setTimeout(() => {
      const latest = leases.get(topic);
      if (!latest || latest.refCount > 0) return;
      leases.delete(topic);
      void supabase.removeChannel(latest.channel);
    }, RELEASE_DELAY_MS);
  };
}
