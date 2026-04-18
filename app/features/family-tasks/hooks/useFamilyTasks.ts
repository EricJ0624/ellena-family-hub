/**
 * 가족 임무(Family Tasks) 훅
 * - 임무 CRUD 작업
 * - Realtime 구독
 * - 암호화/복호화 처리
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { supabase } from '@/lib/supabase';
import type { FamilyTask } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ASSIGNED_TO_USER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAssignedToUserUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && ASSIGNED_TO_USER_UUID_RE.test(value);
}

interface UseFamilyTasksProps {
  currentGroupId: string | null;
  userId: string;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  onTasksChange: (tasks: FamilyTask[]) => void;
  currentTasks: FamilyTask[];
  realtimeSubscriptionId: string;
  /** assigned_to 가 사용자 UUID일 때 표시 문자열(닉네임·가족표시·이모지) */
  assigneeDisplayFromUserIdRef: MutableRefObject<(userId: string) => string>;
}

export function useFamilyTasks({
  currentGroupId,
  userId,
  getCurrentKey,
  CryptoService,
  onTasksChange,
  currentTasks,
  realtimeSubscriptionId,
  assigneeDisplayFromUserIdRef,
}: UseFamilyTasksProps) {
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  /** Realtime 콜백 전용 — effect에 currentTasks 넣으면 목록 갱신마다 구독이 재생성됨 */
  const currentTasksRef = useRef(currentTasks);
  currentTasksRef.current = currentTasks;

  // ADD TODO
  const addTask = async (payload: {
    id: number;
    text: string;
    assignee: string;
    done: boolean;
    assignedToUserId?: string | null;
  }) => {
    if (!payload || !payload.text) {
      console.error('ADD_TODO: 잘못된 payload:', payload);
      return;
    }

    const encryptedText = CryptoService.encrypt(payload.text, getCurrentKey());

    if (!currentGroupId) {
      console.error('ADD_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    const taskData: any = {
      group_id: currentGroupId,
      created_by: userId,
      title: encryptedText,
      assigned_to: payload.assignedToUserId && isAssignedToUserUuid(payload.assignedToUserId) ? payload.assignedToUserId : null,
      is_completed: payload.done || false,
    };

    console.log('ADD_TODO: family_tasks 테이블에 저장:', {
      text: payload.text.substring(0, 20),
      assignee: payload.assignee,
      assignedToUserId: payload.assignedToUserId,
      groupId: currentGroupId,
    });

    const { error, data } = await supabase.from('family_tasks').insert(taskData).select();

    if (error) {
      console.error('할일 저장 오류:', error);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
    } else {
      console.log('ADD_TODO: family_tasks 테이블 저장 성공:', data);
    }
  };

  // TOGGLE TODO
  const toggleTask = async (taskId: number | string, done: boolean) => {
    const taskIdStr = String(taskId);
    const isNumericId = typeof taskId === 'number' || /^\d+$/.test(taskIdStr);

    if (isNumericId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('로컬 데이터 업데이트 (Supabase 업데이트 건너뜀):', taskIdStr);
      }
      return;
    }

    if (!currentGroupId) {
      console.error('TOGGLE_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    const updateData: any = {};
    updateData.is_completed = done;

    const { error } = await supabase
      .from('family_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('group_id', currentGroupId);

    if (error) {
      console.error('할일 업데이트 오류:', error);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
    }
  };

  // DELETE TODO
  const deleteTask = async (taskId: number | string) => {
    const taskIdStr = String(taskId);
    const isNumericId = typeof taskId === 'number' || /^\d+$/.test(taskIdStr);

    console.log('saveToSupabase DELETE_TODO:', {
      taskId: taskIdStr,
      isNumericId,
      payloadType: typeof taskId,
    });

    if (isNumericId) {
      console.log('로컬 데이터 삭제 (Supabase 삭제 건너뜀):', taskIdStr);
      return;
    }

    if (!currentGroupId) {
      console.error('DELETE_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    console.log('Supabase 삭제 시도:', { taskId: taskIdStr, userId });

    const { data: existingTask } = await supabase
      .from('family_tasks')
      .select('id, created_by, title, group_id')
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId)
      .single();

    if (existingTask) {
      console.log('삭제할 할일 확인:', {
        id: existingTask.id,
        created_by: existingTask.created_by,
        title: existingTask.title?.substring(0, 30),
        group_id: existingTask.group_id,
      });
    }

    const { error, data } = await supabase
      .from('family_tasks')
      .delete()
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId)
      .select();

    if (error) {
      console.error('할일 삭제 오류:', error);
      console.error('삭제 시도한 ID:', taskIdStr, '타입:', typeof taskIdStr, 'userId:', userId);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
      throw error;
    } else {
      const deletedCount = data?.length || 0;
      console.log('할일 삭제 결과:', { taskId: taskIdStr, deletedCount, deletedData: data, userId });

      if (deletedCount === 0 && existingTask) {
        console.error('⚠️ 할일 삭제 실패: 할일은 존재하지만 삭제 권한이 없습니다.', {
          taskId: taskIdStr,
          existingTaskCreatedBy: existingTask.created_by,
          currentUserId: userId,
          isOwner: existingTask.created_by === userId,
        });
        throw new Error('삭제 권한이 없습니다. 이 할일을 삭제할 수 없습니다.');
      } else if (deletedCount === 0) {
        console.warn(
          '⚠️ 할일 삭제: 삭제된 행이 없음. ID가 존재하지 않거나 이미 삭제되었을 수 있습니다:',
          taskIdStr
        );
      }
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    const loadTasks = async () => {
      const { data: tasksData, error: tasksError } = await supabase
        .from('family_tasks')
        .select('*')
        .eq('group_id', currentGroupId)
        .order('created_at', { ascending: false });

      if (!tasksError && tasksData) {
        const formattedTasks: FamilyTask[] = tasksData.map((task: any) => {
          const taskText = task.title || task.task_text || '';
          let decryptedText = taskText;
          const currentKey = getCurrentKey();

          if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
            const isEncrypted = taskText.startsWith('U2FsdGVkX1');
            if (isEncrypted) {
              try {
                const decrypted = CryptoService.decrypt(taskText, currentKey);
                if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                  decryptedText = decrypted;
                } else {
                  decryptedText = taskText;
                }
              } catch (e: any) {
                decryptedText = taskText;
              }
            } else {
              decryptedText = taskText;
            }
          } else {
            decryptedText = taskText;
          }

          const assignedToUserId = isAssignedToUserUuid(task.assigned_to) ? task.assigned_to : undefined;

          let decryptedAssignee = '누구나';
          if (assignedToUserId) {
            decryptedAssignee = assigneeDisplayFromUserIdRef.current(assignedToUserId);
          } else if (
            task.assigned_to &&
            typeof task.assigned_to === 'string' &&
            task.assigned_to !== '누구나' &&
            !isAssignedToUserUuid(task.assigned_to)
          ) {
            try {
              const decrypted = CryptoService.decrypt(task.assigned_to, currentKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                decryptedAssignee = decrypted;
              }
            } catch (e) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('담당자 복호화 실패:', e);
              }
            }
          }

          return {
            id: task.id,
            text: decryptedText,
            assignee: decryptedAssignee,
            done: task.is_completed || false,
            created_by: task.created_by || undefined,
            assigned_to_user_id: assignedToUserId,
          };
        });

        if (formattedTasks.length > 0) {
          onTasksChange(formattedTasks);
        }
      }
    };

    loadTasks();
  }, [currentGroupId, userId, getCurrentKey, CryptoService, onTasksChange, assigneeDisplayFromUserIdRef]);

  // Realtime 구독
  useEffect(() => {
    if (!currentGroupId) return;
    // 부모 effect보다 자식이 먼저 돌면 epoch가 아직 0 → `:0` 채널이 joining에 걸리고 바인딩 mismatch가 날 수 있음
    if (!realtimeSubscriptionId || realtimeSubscriptionId === '0') return;

    console.log('📋 Realtime 할일 subscription 시작:', { groupId: currentGroupId, subscriptionId: realtimeSubscriptionId });

    const gid = currentGroupId;
    const tasksSubscription = supabase
      .channel(`family_tasks_changes:${gid}:${realtimeSubscriptionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_tasks', filter: `group_id=eq.${gid}` },
        (payload: any) => {
        const latestTasks = currentTasksRef.current;
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedTask = payload.old;
          const deletedId = deletedTask?.id;
          if (!deletedId) return;
          const deletedIdStr = String(deletedId).trim();

          onTasksChange(
            latestTasks.filter((t) => {
              const tIdStr = String(t.id).trim();
              const tSupabaseId = t.supabaseId ? String(t.supabaseId).trim() : null;
              return tIdStr !== deletedIdStr && (!tSupabaseId || tSupabaseId !== deletedIdStr);
            })
          );
          return;
        }

        if (ev === 'UPDATE') {
          const updatedTask = payload.new;
          const taskText = updatedTask.title || updatedTask.task_text || '';
          let decryptedText = taskText;
          const updateTaskKey = getCurrentKey();

          if (
            updateTaskKey &&
            updateTaskKey.length > 0 &&
            taskText &&
            taskText.length > 0 &&
            taskText.startsWith('U2FsdGVkX1')
          ) {
            try {
              const decrypted = CryptoService.decrypt(taskText, updateTaskKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) decryptedText = decrypted;
            } catch (_) {}
          }

          const updatedAssignedToUserId = isAssignedToUserUuid(updatedTask.assigned_to)
            ? updatedTask.assigned_to
            : undefined;

          let decryptedAssignee = '누구나';
          if (updatedAssignedToUserId) {
            decryptedAssignee = assigneeDisplayFromUserIdRef.current(updatedAssignedToUserId);
          } else if (
            updatedTask.assigned_to &&
            typeof updatedTask.assigned_to === 'string' &&
            updatedTask.assigned_to !== '누구나' &&
            updatedTask.assigned_to.startsWith('U2FsdGVkX1')
          ) {
            try {
              const decrypted = CryptoService.decrypt(updatedTask.assigned_to, updateTaskKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) decryptedAssignee = decrypted;
            } catch (_) {}
          } else if (updatedTask.assigned_to && typeof updatedTask.assigned_to === 'string') {
            decryptedAssignee = updatedTask.assigned_to;
          }

          onTasksChange(
            latestTasks.map((t) =>
              t.id === updatedTask.id
                ? {
                    ...t,
                    id: updatedTask.id,
                    text: decryptedText,
                    assignee: decryptedAssignee || t.assignee,
                    done: updatedTask.is_completed !== undefined ? updatedTask.is_completed : t.done,
                    assigned_to_user_id: updatedAssignedToUserId ?? t.assigned_to_user_id,
                  }
                : t
            )
          );
          return;
        }

        // INSERT
        const newTask = payload.new;
        console.log('Realtime 할일 INSERT 이벤트 수신 (family_tasks 테이블):', payload);

        if (!newTask || !newTask.id) {
          console.error('Realtime 할일: 잘못된 payload:', payload);
          return;
        }

        if (newTask.group_id !== currentGroupId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Realtime 할일: 다른 그룹의 데이터는 무시합니다.', {
              eventGroupId: newTask.group_id,
              currentGroupId,
            });
          }
          return;
        }

        const taskText = newTask.title || newTask.task_text || '';
        let decryptedText = taskText;
        const taskKey = getCurrentKey();

        if (taskKey && taskKey.length > 0 && taskText && taskText.length > 0) {
          const isEncrypted = taskText.startsWith('U2FsdGVkX1');
          if (isEncrypted) {
            try {
              const decrypted = CryptoService.decrypt(taskText, taskKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                decryptedText = decrypted;
              } else {
                decryptedText = taskText;
              }
            } catch (e: any) {
              decryptedText = taskText;
            }
          } else {
            decryptedText = taskText;
          }
        } else {
          decryptedText = taskText;
        }

        const newAssignedToUserId = isAssignedToUserUuid(newTask.assigned_to) ? newTask.assigned_to : undefined;

        let decryptedAssignee = '누구나';
        if (newAssignedToUserId) {
          decryptedAssignee = assigneeDisplayFromUserIdRef.current(newAssignedToUserId);
        } else if (decryptedText && decryptedText.includes(' - ')) {
          const parts = decryptedText.split(' - ');
          if (parts.length >= 2) {
            const extractedAssignee = parts[parts.length - 1].trim();
            if (extractedAssignee && extractedAssignee.length > 0) {
              decryptedAssignee = extractedAssignee;
            }
          }
        }

        if (
          decryptedAssignee === '누구나' &&
          newTask.assigned_to &&
          typeof newTask.assigned_to === 'string' &&
          newTask.assigned_to !== '누구나' &&
          !isAssignedToUserUuid(newTask.assigned_to)
        ) {
          const isEncrypted = newTask.assigned_to.startsWith('U2FsdGVkX1');
          if (isEncrypted) {
            try {
              const decrypted = CryptoService.decrypt(newTask.assigned_to, taskKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) {
                decryptedAssignee = decrypted;
              }
            } catch (e) {}
          } else {
            decryptedAssignee = newTask.assigned_to;
          }
        }

        const existingTaskById = latestTasks?.find((t) => String(t.id) === String(newTask.id));
        if (existingTaskById) {
          return;
        }

        if (newTask.created_by === userId) {
          const recentDuplicate = latestTasks?.find((t) => {
            const isTempId = typeof t.id === 'number';
            const isRecent = isTempId && (t.id as number) > Date.now() - 30000;
            return isRecent && t.text === decryptedText;
          });

          if (recentDuplicate) {
            onTasksChange(
              latestTasks.map((t) =>
                t.id === recentDuplicate.id
                  ? {
                      ...t,
                      id: newTask.id,
                      text: decryptedText,
                      assignee: decryptedAssignee,
                      done: newTask.is_completed || false,
                      assigned_to_user_id: newAssignedToUserId ?? t.assigned_to_user_id,
                    }
                  : t
              )
            );
            return;
          }

          const duplicateByContent = latestTasks?.find(
            (t) => t.text === decryptedText && String(t.id) !== String(newTask.id)
          );
          if (duplicateByContent) {
            return;
          }
        }

        onTasksChange([
          {
            id: newTask.id,
            text: decryptedText,
            assignee: decryptedAssignee,
            done: newTask.is_completed || false,
            created_by: newTask.created_by,
            assigned_to_user_id: newAssignedToUserId,
          },
          ...latestTasks,
        ]);
      })
      .subscribe((status, err) => {
        console.log('📋 Realtime 할일 subscription 상태:', status);
        if (err) {
          console.error('❌ Realtime 할일 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 할일 subscription 연결 성공');
          subscriptionRef.current = tasksSubscription;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ Realtime 할일 subscription 연결 실패:', status);
        }
      });

    return () => {
      // SUBSCRIBED 콜백 전에 이펙트가 다시 돌면 subscriptionRef가 비어 unsubscribe가 스킵되어
      // 같은 토픽 채널이 남고, 다음 마운트에서 .on() after subscribe() 오류가 남.
      if (subscriptionRef.current === tasksSubscription) {
        subscriptionRef.current = null;
      }
      console.log('🔌 Realtime 할일 subscription 해제');
      void supabase.removeChannel(tasksSubscription);
    };
  }, [currentGroupId, realtimeSubscriptionId, userId, getCurrentKey, CryptoService, onTasksChange, assigneeDisplayFromUserIdRef]);

  return {
    addTask,
    toggleTask,
    deleteTask,
  };
}
