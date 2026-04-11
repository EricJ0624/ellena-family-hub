/**
 * 가족 일정(Family Calendar) 훅
 * - 일정 CRUD 작업
 * - Realtime 구독
 * - 암호화/복호화 처리
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { FamilyEvent } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  realtimeSubscriptionId: string;
}

export function useFamilyCalendar({
  currentGroupId,
  userId,
  getCurrentKey,
  CryptoService,
  onEventsChange,
  currentEvents,
  realtimeSubscriptionId,
}: UseFamilyCalendarProps) {
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // ADD EVENT
  const addEvent = async (payload: {
    id: number | string;
    month: string;
    day: string;
    title: string;
    desc: string;
    event_date: string;
    repeat_type?: 'none' | 'monthly' | 'yearly';
  }) => {
    if (!payload || !payload.title) {
      console.error('ADD_EVENT: 잘못된 payload:', payload);
      return;
    }

    if (!currentGroupId) {
      console.error('ADD_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    const encryptedTitle = CryptoService.encrypt(payload.title, getCurrentKey());
    const encryptedDesc = payload.desc ? CryptoService.encrypt(payload.desc, getCurrentKey()) : '';

    const eventData: any = {
      group_id: currentGroupId,
      created_by: userId,
      title: encryptedTitle,
      description: encryptedDesc,
      event_date: payload.event_date,
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

    if (isNumericId) {
      console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', eventIdStr);
      return;
    }

    if (!currentGroupId) {
      console.error('DELETE_EVENT: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
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
      }
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    const loadEvents = async () => {
      const { data: eventsData, error: eventsError } = await supabase
        .from('family_events')
        .select('*')
        .eq('group_id', currentGroupId)
        .order('event_date', { ascending: true });

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
            created_by: event.created_by,
            created_at: event.created_at,
            repeat_type: repeatType,
          };
        });

        if (formattedEvents.length > 0) {
          onEventsChange(formattedEvents);
        }
      }
    };

    loadEvents();
  }, [currentGroupId, userId, getCurrentKey, CryptoService, onEventsChange]);

  // Realtime 구독
  useEffect(() => {
    if (!currentGroupId) return;

    console.log('📅 일정 subscription 설정 중...');

    const eventsSubscription = supabase
      .channel(`family_events_changes:${currentGroupId ?? 'none'}:${realtimeSubscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_events' }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedEvent = payload.old;
          const deletedId = deletedEvent?.id;
          if (!deletedId) return;
          const deletedIdStr = String(deletedId).trim().toLowerCase();

          onEventsChange(
            currentEvents.filter((e) => {
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
          const updateEventKey = getCurrentKey();

          if (updateEventKey && updateEventKey.length > 0) {
            if (eventTitleField && eventTitleField.length > 0 && eventTitleField.startsWith('U2FsdGVkX1')) {
              try {
                const decryptedTitleData = CryptoService.decrypt(eventTitleField, updateEventKey);
                if (decryptedTitleData && typeof decryptedTitleData === 'string' && decryptedTitleData.length > 0)
                  decryptedTitle = decryptedTitleData;
              } catch (_) {}
            }
            if (eventDescField && eventDescField.length > 0 && eventDescField.startsWith('U2FsdGVkX1')) {
              try {
                const decryptedDescData = CryptoService.decrypt(eventDescField, updateEventKey);
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

          onEventsChange(
            currentEvents.map((e) =>
              e.id === updatedEvent.id
                ? {
                    ...e,
                    id: updatedEvent.id,
                    month: month,
                    day: day,
                    title: decryptedTitle,
                    desc: decryptedDesc,
                    event_date: eventDateStr,
                    repeat_type: repeatType,
                  }
                : e
            )
          );
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
        const eventKey = getCurrentKey();

        if (eventKey && eventKey.length > 0) {
          if (eventTitleField && eventTitleField.length > 0) {
            const isEncrypted = eventTitleField.startsWith('U2FsdGVkX1');
            if (isEncrypted) {
              try {
                const decryptedTitleData = CryptoService.decrypt(eventTitleField, eventKey);
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
                const decryptedDescData = CryptoService.decrypt(eventDescField, eventKey);
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

        const existingEventById = currentEvents?.find((e) => String(e.id) === String(newEvent.id));
        if (existingEventById) {
          return;
        }

        if (newEvent.created_by === userId) {
          const recentDuplicate = currentEvents?.find((e) => {
            const isTempId = typeof e.id === 'number';
            const isRecent = isTempId && (e.id as number) > Date.now() - 30000;
            return isRecent && e.title === decryptedTitle && e.month === month && e.day === day;
          });

          if (recentDuplicate) {
            onEventsChange(
              currentEvents.map((e) =>
                e.id === recentDuplicate.id
                  ? {
                      ...e,
                      id: newEvent.id,
                      month: month,
                      day: day,
                      title: decryptedTitle,
                      desc: decryptedDesc,
                      event_date: eventDateStr,
                      created_by: newEvent.created_by,
                      created_at: newEvent.created_at,
                      repeat_type: repeatType,
                    }
                  : e
              )
            );
            return;
          }

          const duplicateByContent = currentEvents?.find(
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
            created_by: newEvent.created_by,
            created_at: newEvent.created_at,
            repeat_type: repeatType,
          },
          ...currentEvents,
        ]);
      })
      .subscribe((status, err) => {
        console.log('📅 Realtime 일정 subscription 상태:', status);
        if (err) {
          console.error('❌ Realtime 일정 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 일정 subscription 연결 성공');
          subscriptionRef.current = eventsSubscription;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Realtime 일정 subscription 연결 실패:', status);
        }
      });

    return () => {
      if (subscriptionRef.current) {
        console.log('🔌 Realtime 일정 subscription 해제');
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [currentGroupId, realtimeSubscriptionId, userId, currentEvents, getCurrentKey, CryptoService, onEventsChange]);

  return {
    addEvent,
    deleteEvent,
  };
}
