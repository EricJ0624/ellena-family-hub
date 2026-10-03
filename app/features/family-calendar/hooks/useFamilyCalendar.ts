/**
 * 가족 일정(Family Calendar) 훅
 * - 일정 CRUD 작업
 * - Realtime 구독
 * - 암호화/복호화 처리
 *
 * [변경 이력]
 * 1. addEvent 검증 실패 경로 return → throw
 *    이유: 호출부가 `.catch()` 로 오류를 처리하는데, return 시 catch가 실행되지 않아
 *          낙관적 UI 업데이트가 롤백되지 않는 버그 수정.
 *
 * 2. deleteEvent !currentGroupId 분기 return → throw
 *    이유: 호출부가 try/catch 로 롤백을 처리하는데, return 시 catch가 실행되지 않아
 *          UI에서 삭제된 것처럼 보이지만 DB는 변경되지 않는 버그 수정.
 *          isNumericId 분기는 "Supabase에 아직 저장되지 않은 임시 로컬 데이터" 삭제로 의도된 동작이므로 유지.
 *
 * 3. loadEvents cancelled 플래그 추가
 *    이유: 컴포넌트 언마운트 또는 currentGroupId 변경 시 이전 비동기 로드가 완료되어
 *          onEventsChange 를 호출하면 구 그룹 데이터가 새 그룹 상태를 덮어쓰는 레이스 컨디션 방지.
 *
 * 4. `if (formattedEvents.length > 0)` 가드 제거
 *    이유: DB 조회 결과가 0건일 때 onEventsChange([]) 가 호출되지 않아
 *          전체 일정 삭제 후 재접속해도 stale 데이터가 남는 버그 수정.
 *          시그니처 비교(nextSig !== prevSig)가 빈 배열 간 중복 호출을 이미 방지한다.
 *
 * 5. loadEvents effect deps 에서 onEventsChange 제거
 *    이유: onEventsChange 가 호출 측에서 memoize 되지 않으면 매 렌더마다 effect 가 재실행되어
 *          DB 쿼리가 불필요하게 반복됨. calendarRt.onEventsChange.current 는 항상 최신값을
 *          가리키는 모듈 레벨 ref 이므로 deps 에서 제거해도 최신 콜백이 보장됨.
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import { emitNotificationClient } from '@/lib/notifications/client';
import type { FamilyEvent } from '../types';

interface UseFamilyCalendarProps {
  currentGroupId: string | null;
  userId: string;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  onEventsChange: (events: FamilyEvent[]) => void;
  currentEvents: FamilyEvent[];
}

function eventsContentSignature(events: ReadonlyArray<FamilyEvent>): string {
  if (!events.length) return '';
  return events
    .map(
      (e) =>
        `${e.id}:${e.event_date}:${e.end_date ?? ''}:${e.title}:${e.desc}:${e.repeat_type ?? 'none'}`,
    )
    .join('|');
}

/** 돋보기 리마운트 시 싱글톤 채널 핸들러가 언마운트된 인스턴스 ref를 보지 않도록 모듈에 둔다 */
const calendarRt = {
  events: { current: [] as FamilyEvent[] },
  onEventsChange: { current: ((_events: FamilyEvent[]) => {}) as (events: FamilyEvent[]) => void },
  getCurrentKey: { current: () => '' },
  crypto: { current: null as UseFamilyCalendarProps['CryptoService'] | null },
};

export function useFamilyCalendar({
  currentGroupId,
  userId,
  getCurrentKey,
  CryptoService,
  onEventsChange,
  currentEvents,
}: UseFamilyCalendarProps) {
  calendarRt.events.current = currentEvents;
  calendarRt.onEventsChange.current = onEventsChange;
  calendarRt.getCurrentKey.current = getCurrentKey;
  calendarRt.crypto.current = CryptoService;

  // ADD EVENT
  const addEvent = async (payload: {
    id: number | string;
    month: string;
    day: string;
    title: string;
    desc: string;
    event_date: string;
    end_date?: string;
    repeat_type?: 'none' | 'monthly' | 'yearly';
  }) => {
    // [수정 1] return → throw: 호출부 .catch()가 낙관적 UI를 롤백할 수 있도록
    if (!payload || !payload.title) {
      throw new Error('ADD_EVENT: 잘못된 payload');
    }

    if (!currentGroupId) {
      throw new Error('ADD_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
    }

    const encryptedTitle = CryptoService.encrypt(payload.title, getCurrentKey());
    const encryptedDesc = payload.desc ? CryptoService.encrypt(payload.desc, getCurrentKey()) : '';

    const eventData: any = {
      group_id: currentGroupId,
      created_by: userId,
      title: encryptedTitle,
      description: encryptedDesc,
      event_date: payload.event_date,
      end_date: (payload.end_date && payload.end_date > payload.event_date) ? payload.end_date : null,
      repeat_type: payload.repeat_type || 'none',
    };

    console.log('ADD_EVENT: family_events 테이블에 저장:', {
      title: payload.title.substring(0, 20),
      month: payload.month,
      day: payload.day,
      groupId: currentGroupId,
    });

    const { error, data } = await supabase.from('family_events').insert(eventData).select();

    if (error) {
      console.error('일정 저장 오류:', error);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
      throw error;
    } else {
      console.log('ADD_EVENT: family_events 테이블 저장 성공:', data);
      const insertedId = data?.[0]?.id;
      void emitNotificationClient({
        groupId: currentGroupId,
        widgetKey: 'calendar',
        eventType: 'CALENDAR_EVENT_CREATED',
        title: '📅 새 가족 일정',
        body: '새 일정이 등록되었습니다.',
        url: '/dashboard?focus=calendar',
        entityId: insertedId ? String(insertedId) : null,
      });
    }
  };

  // DELETE EVENT
  const deleteEvent = async (eventId: number | string) => {
    const eventIdStr = String(eventId);
    const isNumericId = typeof eventId === 'number' || /^\d+$/.test(eventIdStr);

    console.log('saveToSupabase DELETE_EVENT:', {
      eventId: eventIdStr,
      isNumericId,
      payloadType: typeof eventId,
    });

    // [의도된 동작] 숫자 ID = Supabase에 아직 저장되지 않은 임시 로컬 데이터.
    // DB 삭제 없이 UI에서만 제거하는 것이 올바른 동작이므로 return 유지.
    if (isNumericId) {
      console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', eventIdStr);
      return;
    }

    // [수정 2] return → throw: 호출부 catch 블록이 낙관적 UI를 롤백할 수 있도록
    if (!currentGroupId) {
      throw new Error('DELETE_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
    }

    console.log('Supabase 삭제 시도:', { eventId: eventIdStr, userId });

    const { data: existingEvent } = await supabase
      .from('family_events')
      .select('id, created_by, title, group_id')
      .eq('id', eventIdStr)
      .eq('group_id', currentGroupId)
      .single();

    if (existingEvent) {
      console.log('삭제할 일정 확인:', {
        id: existingEvent.id,
        created_by: existingEvent.created_by,
        title: existingEvent.title?.substring(0, 30),
        group_id: existingEvent.group_id,
      });
    }

    const { error, data } = await supabase
      .from('family_events')
      .delete()
      .eq('id', eventIdStr)
      .eq('group_id', currentGroupId)
      .select();

    if (error) {
      console.error('일정 삭제 오류:', error);
      console.error('삭제 시도한 ID:', eventIdStr, '타입:', typeof eventIdStr, 'userId:', userId);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
      throw error;
    } else {
      const deletedCount = data?.length || 0;
      console.log('일정 삭제 결과:', { eventId: eventIdStr, deletedCount, deletedData: data, userId });

      if (deletedCount === 0 && existingEvent) {
        console.error('⚠️ 일정 삭제 실패: 일정은 존재하지만 삭제 권한이 없습니다.', {
          eventId: eventIdStr,
          existingEventCreatedBy: existingEvent.created_by,
          currentUserId: userId,
          isOwner: existingEvent.created_by === userId,
        });
        throw new Error('삭제 권한이 없습니다. 이 일정을 삭제할 수 없습니다.');
      } else if (deletedCount === 0) {
        console.warn(
          '⚠️ 일정 삭제: 삭제된 행이 없음. ID가 존재하지 않거나 이미 삭제되었을 수 있습니다:',
          eventIdStr
        );
      } else {
        void emitNotificationClient({
          groupId: currentGroupId,
          widgetKey: 'calendar',
          eventType: 'CALENDAR_EVENT_DELETED',
          title: '📅 일정 삭제',
          body: '가족 일정이 삭제되었습니다.',
          url: '/dashboard?focus=calendar',
          entityId: eventIdStr,
        });
      }
    }
  };

  // UPDATE EVENT
  const updateEvent = async (payload: {
    id: string;
    month: string;
    day: string;
    title: string;
    desc: string;
    event_date: string;
    end_date?: string;
    repeat_type?: 'none' | 'monthly' | 'yearly';
  }) => {
    if (!payload?.id || !payload.title) {
      throw new Error('UPDATE_EVENT: invalid payload');
    }
    if (!currentGroupId) {
      throw new Error('UPDATE_EVENT: currentGroupId가 없습니다.');
    }

    const eventIdStr = String(payload.id);
    if (/^\d+$/.test(eventIdStr)) {
      throw new Error('아직 저장되지 않은 일정입니다.');
    }

    const { data: existing } = await supabase
      .from('family_events')
      .select('id, created_by')
      .eq('id', eventIdStr)
      .eq('group_id', currentGroupId)
      .maybeSingle();

    if (!existing) throw new Error('일정을 찾을 수 없습니다.');
    if (existing.created_by && String(existing.created_by) !== String(userId)) {
      throw new Error('작성자만 수정할 수 있습니다.');
    }

    const encryptedTitle = CryptoService.encrypt(payload.title, getCurrentKey());
    const encryptedDesc = payload.desc ? CryptoService.encrypt(payload.desc, getCurrentKey()) : '';

    const { error } = await supabase
      .from('family_events')
      .update({
        title: encryptedTitle,
        description: encryptedDesc,
        event_date: payload.event_date,
        end_date: (payload.end_date && payload.end_date > payload.event_date) ? payload.end_date : null,
        repeat_type: payload.repeat_type || 'none',
      })
      .eq('id', eventIdStr)
      .eq('group_id', currentGroupId);

    if (error) throw error;

    void emitNotificationClient({
      groupId: currentGroupId,
      widgetKey: 'calendar',
      eventType: 'CALENDAR_EVENT_UPDATED',
      title: '📅 일정 수정',
      body: '가족 일정이 수정되었습니다.',
      url: '/dashboard?focus=calendar',
      entityId: eventIdStr,
    });
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    // [수정 3] cancelled 플래그: 컴포넌트 언마운트 또는 currentGroupId 변경 시
    //          진행 중인 비동기 로드가 완료되어도 stale 콜백 호출을 방지
    let cancelled = false;

    const loadEvents = async () => {
      const session = await waitForSupabaseSession(supabase);
      if (cancelled || !session?.access_token) return;

      const { data: eventsData, error: eventsError } = await supabase
        .from('family_events')
        .select('id, title, description, event_date, end_date, location, created_by, created_at, group_id, repeat_type') // app_id 미사용 — 불필요 컬럼 제거
        .eq('group_id', currentGroupId)
        .order('event_date', { ascending: true });

      if (cancelled) return;

      if (!eventsError && eventsData) {
        const formattedEvents: FamilyEvent[] = eventsData.map((event: any) => {
          const eventDateValue = event.event_date || event.date || event.event_date_time || new Date().toISOString();
          const eventDate = new Date(eventDateValue);
          const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
          const day = eventDate.getDate().toString();

          const eventTitleField = event.title || event.event_title || '';
          const eventDescField = event.description || '';
          let decryptedTitle = eventTitleField;
          let decryptedDesc = eventDescField;
          const currentKey = getCurrentKey();

          if (currentKey && currentKey.length > 0) {
            if (eventTitleField && eventTitleField.length > 0) {
              const isEncrypted = eventTitleField.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decryptedTitleData = CryptoService.decrypt(eventTitleField, currentKey);
                  if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                    decryptedTitle = decryptedTitleData;
                  } else {
                    decryptedTitle = eventTitleField;
                  }
                } catch (e: any) {
                  decryptedTitle = eventTitleField;
                }
              } else {
                decryptedTitle = eventTitleField;
              }
            }

            if (eventDescField && eventDescField.length > 0) {
              const isEncrypted = eventDescField.startsWith('U2FsdGVkX1');
              if (isEncrypted) {
                try {
                  const decryptedDescData = CryptoService.decrypt(eventDescField, currentKey);
                  if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                    decryptedDesc = decryptedDescData;
                  } else {
                    decryptedDesc = eventDescField;
                  }
                } catch (e: any) {
                  decryptedDesc = eventDescField;
                }
              } else {
                decryptedDesc = eventDescField;
              }
            }
          } else {
            decryptedTitle = eventTitleField;
            decryptedDesc = eventDescField;
          }

          const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(
            eventDate.getDate()
          ).padStart(2, '0')}`;
          const repeatType = event.repeat_type === 'monthly' || event.repeat_type === 'yearly' ? event.repeat_type : 'none';

          return {
            id: event.id,
            month: month,
            day: day,
            title: decryptedTitle,
            desc: decryptedDesc,
            event_date: eventDateStr,
            end_date: event.end_date || undefined,
            created_by: event.created_by,
            created_at: event.created_at,
            repeat_type: repeatType,
          };
        });

        // [수정 4] `length > 0` 가드 제거: DB가 0건을 반환할 때도 onEventsChange([]) 호출 필요
        //          (전체 삭제 후 재접속 시 stale 데이터 잔류 버그 수정)
        //          시그니처 비교가 빈 배열 간 중복 호출을 이미 차단한다.
        // [수정 5] onEventsChange → calendarRt.onEventsChange.current 사용
        //          (deps 배열에서 onEventsChange 제거하기 위한 ref 경유)
        const nextSig = eventsContentSignature(formattedEvents);
        const prevSig = eventsContentSignature(calendarRt.events.current);
        if (nextSig !== prevSig) {
          calendarRt.onEventsChange.current(formattedEvents);
        }
      }
    };

    loadEvents();
    // [수정 3] cancelled 플래그 설정으로 언마운트/그룹 전환 시 비동기 완료 후 콜백 차단
    return () => { cancelled = true; };
  // [수정 5] onEventsChange deps 제거: calendarRt.onEventsChange.current 이 항상 최신값을 가리키므로
  //          deps 불필요. onEventsChange 가 memo 안 된 경우 매 렌더마다 재실행되던 문제 해결.
  }, [currentGroupId, userId]);

  // Realtime 구독 — 그룹당 채널 1개 재사용 (돋보기 리마운트의 CLOSED 레이스 방지)
  useEffect(() => {
    if (!currentGroupId) return;

    const gid = currentGroupId;
    const release = acquireRealtimeChannel(`family_events_changes:${gid}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_events', filter: `group_id=eq.${gid}` },
        (payload: any) => {
        const latestEvents = calendarRt.events.current;
        const onEventsChange = calendarRt.onEventsChange.current;
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedEvent = payload.old;
          const deletedId = deletedEvent?.id;
          if (!deletedId) return;
          const deletedIdStr = String(deletedId).trim().toLowerCase();

          onEventsChange(
            latestEvents.filter((e) => {
              const eIdStr = String(e.id).trim().toLowerCase();
              const eSupabaseId = e.supabaseId ? String(e.supabaseId).trim().toLowerCase() : null;
              const isMatch =
                eIdStr === deletedIdStr ||
                eSupabaseId === deletedIdStr ||
                eIdStr.replace(/-/g, '') === deletedIdStr.replace(/-/g, '');
              return !isMatch;
            })
          );
          return;
        }

        if (ev === 'UPDATE') {
          const updatedEvent = payload.new;
          const eventDateValue =
            updatedEvent.event_date || updatedEvent.date || updatedEvent.event_date_time || new Date().toISOString();
          const eventDate = new Date(eventDateValue);
          const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
          const day = eventDate.getDate().toString();

          const eventTitleField = updatedEvent.title || updatedEvent.event_title || '';
          const eventDescField = updatedEvent.description || '';
          let decryptedTitle = eventTitleField;
          let decryptedDesc = eventDescField;
          const updateEventKey = calendarRt.getCurrentKey.current();

            if (updateEventKey && updateEventKey.length > 0) {
              if (eventTitleField && eventTitleField.length > 0 && eventTitleField.startsWith('U2FsdGVkX1')) {
                try {
                  const decryptedTitleData = calendarRt.crypto.current!.decrypt(eventTitleField, updateEventKey);
                if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0)
                  decryptedTitle = decryptedTitleData;
              } catch (_) {}
            }
            if (eventDescField && eventDescField.length > 0 && eventDescField.startsWith('U2FsdGVkX1')) {
              try {
                const decryptedDescData = calendarRt.crypto.current!.decrypt(eventDescField, updateEventKey);
                if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0)
                  decryptedDesc = decryptedDescData;
              } catch (_) {}
            }
          }

          const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(
            eventDate.getDate()
          ).padStart(2, '0')}`;
          const repeatType =
            updatedEvent.repeat_type === 'monthly' || updatedEvent.repeat_type === 'yearly'
              ? updatedEvent.repeat_type
              : 'none';

          const nextEvents = latestEvents.map((e) =>
            String(e.id) === String(updatedEvent.id)
              ? {
                  ...e,
                  id: updatedEvent.id,
                  month: month,
                  day: day,
                  title: decryptedTitle,
                  desc: decryptedDesc,
                  event_date: eventDateStr,
                  end_date: updatedEvent.end_date || undefined,
                  repeat_type: repeatType,
                }
              : e,
          );
          if (eventsContentSignature(nextEvents) !== eventsContentSignature(latestEvents)) {
            onEventsChange(nextEvents);
          }
          return;
        }

        // INSERT
        const newEvent = payload.new;
        console.log('Realtime 일정 INSERT 이벤트 수신 (family_events 테이블):', payload);

        if (!newEvent || !newEvent.id) {
          console.error('Realtime 일정: 잘못된 payload:', payload);
          return;
        }

        if (newEvent.group_id !== currentGroupId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Realtime 일정: 다른 그룹의 데이터는 무시합니다.', {
              eventGroupId: newEvent.group_id,
              currentGroupId,
            });
          }
          return;
        }

        const eventDateValue =
          newEvent.event_date || newEvent.date || newEvent.event_date_time || new Date().toISOString();
        const eventDate = new Date(eventDateValue);
        const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const day = eventDate.getDate().toString();

        const eventTitleField = newEvent.title || newEvent.event_title || '';
        const eventDescField = newEvent.description || '';
        let decryptedTitle = eventTitleField;
        let decryptedDesc = eventDescField;
        const eventKey = calendarRt.getCurrentKey.current();

        if (eventKey && eventKey.length > 0) {
          if (eventTitleField && eventTitleField.length > 0) {
            const isEncrypted = eventTitleField.startsWith('U2FsdGVkX1');
            if (isEncrypted) {
              try {
                const decryptedTitleData = calendarRt.crypto.current!.decrypt(eventTitleField, eventKey);
                if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0) {
                  decryptedTitle = decryptedTitleData;
                } else {
                  decryptedTitle = eventTitleField;
                }
              } catch (e: any) {
                decryptedTitle = eventTitleField;
              }
            } else {
              decryptedTitle = eventTitleField;
            }
          }

          if (eventDescField && eventDescField.length > 0) {
            const isEncrypted = eventDescField.startsWith('U2FsdGVkX1');
            if (isEncrypted) {
              try {
                const decryptedDescData = calendarRt.crypto.current!.decrypt(eventDescField, eventKey);
                if (decryptedDescData && typeof decryptedDescData === 'string' && decryptedDescData.length > 0) {
                  decryptedDesc = decryptedDescData;
                } else {
                  decryptedDesc = eventDescField;
                }
              } catch (e: any) {
                decryptedDesc = eventDescField;
              }
            } else {
              decryptedDesc = eventDescField;
            }
          }
        } else {
          decryptedTitle = eventTitleField;
          decryptedDesc = eventDescField;
        }

        const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(
          eventDate.getDate()
        ).padStart(2, '0')}`;
        const repeatType = newEvent.repeat_type === 'monthly' || newEvent.repeat_type === 'yearly' ? newEvent.repeat_type : 'none';

        const existingEventById = latestEvents?.find((e) => String(e.id) === String(newEvent.id));
        if (existingEventById) {
          return;
        }

        if (newEvent.created_by === userId) {
          const recentDuplicate = latestEvents?.find((e) => {
            const isTempId = typeof e.id === 'number';
            const isRecent = isTempId && (e.id as number) > Date.now() - 30000;
            return isRecent && e.title === decryptedTitle && e.month === month && e.day === day;
          });

          if (recentDuplicate) {
            onEventsChange(
              latestEvents.map((e) =>
                e.id === recentDuplicate.id
                  ? {
                      ...e,
                      id: newEvent.id,
                      month: month,
                      day: day,
                      title: decryptedTitle,
                      desc: decryptedDesc,
                      event_date: eventDateStr,
                      end_date: newEvent.end_date || undefined,
                      created_by: newEvent.created_by,
                      created_at: newEvent.created_at,
                      repeat_type: repeatType,
                    }
                  : e
              )
            );
            return;
          }

          const duplicateByContent = latestEvents?.find(
            (e) => e.title === decryptedTitle && e.month === month && e.day === day && String(e.id) !== String(newEvent.id)
          );
          if (duplicateByContent) {
            return;
          }
        }

        onEventsChange([
          {
            id: newEvent.id,
            month: month,
            day: day,
            title: decryptedTitle,
            desc: decryptedDesc,
            event_date: eventDateStr,
            end_date: newEvent.end_date || undefined,
            created_by: newEvent.created_by,
            created_at: newEvent.created_at,
            repeat_type: repeatType,
          },
          ...latestEvents,
        ]);
      })
    );

    return release;
  }, [currentGroupId]);

  return {
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
