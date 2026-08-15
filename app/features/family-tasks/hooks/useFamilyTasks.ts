/**
 * 가족 임무(Family Tasks) 훅
 * - 임무 CRUD 작업
 * - Realtime 구독
 * - 암호화/복호화 처리
 */

import { useEffect, type MutableRefObject } from 'react';
import { supabase } from '@/lib/supabase';
import { acquireRealtimeChannel } from '@/lib/realtime-channel-lease';
import { emitNotificationClient } from '@/lib/notifications/client';
import type { FamilyTask } from '../types';

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
  /** assigned_to 가 사용자 UUID일 때 표시 문자열(닉네임·가족표시·이모지) */
  assigneeDisplayFromUserIdRef: MutableRefObject<(userId: string) => string>;
}

const tasksRt = {
  tasks: { current: [] as FamilyTask[] },
  onTasksChange: { current: ((_tasks: FamilyTask[]) => {}) as (tasks: FamilyTask[]) => void },
  getCurrentKey: { current: () => '' },
  crypto: { current: null as UseFamilyTasksProps['CryptoService'] | null },
  assigneeDisplay: { current: ((_id: string) => '') as (userId: string) => string },
};

export function useFamilyTasks({
  currentGroupId,
  userId,
  getCurrentKey,
  CryptoService,
  onTasksChange,
  currentTasks,
  assigneeDisplayFromUserIdRef,
}: UseFamilyTasksProps) {
  tasksRt.tasks.current = currentTasks;
  tasksRt.onTasksChange.current = onTasksChange;
  tasksRt.getCurrentKey.current = getCurrentKey;
  tasksRt.crypto.current = CryptoService;
  tasksRt.assigneeDisplay.current = assigneeDisplayFromUserIdRef.current;

  // ADD TODO — 성공 시 삽입된 행 반환, 실패 시 throw
  const addTask = async (payload: {
    text: string;
    assignee: string;
    done: boolean;
    assignedToUserId?: string | null;
  }) => {
    if (!payload?.text) {
      throw new Error('ADD_TODO: invalid payload');
    }

    if (!currentGroupId) {
      throw new Error('ADD_TODO: currentGroupId가 없습니다.');
    }

    const encryptedText = CryptoService.encrypt(payload.text, getCurrentKey());

    const taskData: Record<string, unknown> = {
      group_id: currentGroupId,
      created_by: userId,
      title: encryptedText,
      assigned_to:
        payload.assignedToUserId && isAssignedToUserUuid(payload.assignedToUserId)
          ? payload.assignedToUserId
          : null,
      is_completed: payload.done || false,
    };

    const { error, data } = await supabase.from('family_tasks').insert(taskData).select();

    if (error) {
      console.error('할일 저장 오류:', error);
      throw error;
    }

    const inserted = data?.[0];
    if (!inserted?.id) {
      throw new Error('ADD_TODO: insert succeeded but no row returned');
    }

    const assignedTo =
      payload.assignedToUserId && isAssignedToUserUuid(payload.assignedToUserId)
        ? payload.assignedToUserId
        : null;
    if (assignedTo && assignedTo !== userId) {
      void emitNotificationClient({
        groupId: currentGroupId,
        widgetKey: 'tasks',
        eventType: 'TASK_ASSIGNED',
        title: '✅ 새 임무 할당',
        body: '당신에게 가족 임무가 할당되었습니다.',
        url: '/dashboard?focus=tasks',
        entityId: String(inserted.id),
        recipientUserIds: [assignedTo],
      });
    } else if (!assignedTo) {
      void emitNotificationClient({
        groupId: currentGroupId,
        widgetKey: 'tasks',
        eventType: 'TASK_OPEN_CREATED',
        title: '✅ 새 가족 임무',
        body: '담당자 없는(누구나) 임무가 등록되었습니다.',
        url: '/dashboard?focus=tasks',
        entityId: String(inserted.id),
      });
    }

    return inserted as { id: string; created_by?: string; is_completed?: boolean };
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
    } else if (done) {
      void emitNotificationClient({
        groupId: currentGroupId,
        widgetKey: 'tasks',
        eventType: 'TASK_COMPLETED',
        title: '✅ 임무 완료',
        body: '가족 임무가 완료되었습니다.',
        url: '/dashboard?focus=tasks',
        entityId: String(taskId),
      });
    }
  };

  /** 「누구나」임무를 현재 사용자가 맡기 */
  const claimTask = async (taskId: number | string) => {
    const taskIdStr = String(taskId);
    const isNumericId = typeof taskId === 'number' || /^\d+$/.test(taskIdStr);
    if (isNumericId) return;

    if (!currentGroupId) {
      throw new Error('CLAIM_TODO: currentGroupId가 없습니다.');
    }

    const { data: existing, error: fetchError } = await supabase
      .from('family_tasks')
      .select('id, assigned_to, is_completed')
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) throw new Error('임무를 찾을 수 없습니다.');
    if (existing.is_completed) throw new Error('이미 완료된 임무입니다.');
    if (isAssignedToUserUuid(existing.assigned_to)) {
      throw new Error('이미 담당자가 지정된 임무입니다.');
    }

    const { error } = await supabase
      .from('family_tasks')
      .update({ assigned_to: userId })
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId);

    if (error) throw error;

    void emitNotificationClient({
      groupId: currentGroupId,
      widgetKey: 'tasks',
      eventType: 'TASK_CLAIMED',
      title: '✅ 임무 담당 확정',
      body: '가족 멤버가 「누구나」임무를 맡았습니다.',
      url: '/dashboard?focus=tasks',
      entityId: taskIdStr,
    });
  };

  // DELETE TODO — 성공 시 delete 1회만; 0행일 때만 select로 권한/부재 구분
  const deleteTask = async (taskId: number | string) => {
    const taskIdStr = String(taskId);
    const isNumericId = typeof taskId === 'number' || /^\d+$/.test(taskIdStr);

    if (isNumericId) {
      return;
    }

    if (!currentGroupId) {
      console.error('DELETE_TODO: currentGroupId가 없습니다. Multi-tenant 아키텍처에서는 groupId가 필수입니다.');
      return;
    }

    const { error, data } = await supabase
      .from('family_tasks')
      .delete()
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId)
      .select('id, created_by');

    if (error) {
      console.error('할일 삭제 오류:', error);
      if (process.env.NODE_ENV === 'development') {
        console.error('에러 상세:', JSON.stringify(error, null, 2));
      }
      throw error;
    }

    const deletedCount = data?.length ?? 0;
    if (deletedCount > 0) {
      return;
    }

    const { data: existingTask } = await supabase
      .from('family_tasks')
      .select('id, created_by')
      .eq('id', taskIdStr)
      .eq('group_id', currentGroupId)
      .maybeSingle();

    if (existingTask) {
      throw new Error('삭제 권한이 없습니다. 이 할일을 삭제할 수 없습니다.');
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn('할일 삭제: 삭제된 행 없음(이미 삭제됐을 수 있음):', taskIdStr);
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
          const currentKey = tasksRt.getCurrentKey.current();

          if (currentKey && currentKey.length > 0 && taskText && taskText.length > 0) {
            const isEncrypted = taskText.startsWith('U2FsdGVkX1');
            if (isEncrypted) {
              try {
                const decrypted = tasksRt.crypto.current!.decrypt(taskText, currentKey);
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
            decryptedAssignee = tasksRt.assigneeDisplay.current(assignedToUserId);
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

        const nextSig = formattedTasks.map((t) => `${t.id}:${t.done ? 1 : 0}:${t.text}:${t.assignee}:${t.assigned_to_user_id ?? ''}`).join('|');
        const prevSig = tasksRt.tasks.current.map((t) => `${t.id}:${t.done ? 1 : 0}:${t.text}:${t.assignee}:${t.assigned_to_user_id ?? ''}`).join('|');
        if (nextSig !== prevSig) onTasksChange(formattedTasks);
      }
    };

    loadTasks();
  }, [currentGroupId, userId, onTasksChange, assigneeDisplayFromUserIdRef]);

  // Realtime 구독 — 그룹당 채널 1개 재사용 (돋보기 리마운트의 CLOSED 레이스 방지)
  useEffect(() => {
    if (!currentGroupId) return;

    const gid = currentGroupId;
    const release = acquireRealtimeChannel(`family_tasks_changes:${gid}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_tasks', filter: `group_id=eq.${gid}` },
        (payload: any) => {
        const latestTasks = tasksRt.tasks.current;
        const onTasksChange = tasksRt.onTasksChange.current;
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
          const updateTaskKey = tasksRt.getCurrentKey.current();

          if (
            updateTaskKey &&
            updateTaskKey.length > 0 &&
            taskText &&
            taskText.length > 0 &&
            taskText.startsWith('U2FsdGVkX1')
          ) {
            try {
              const decrypted = tasksRt.crypto.current!.decrypt(taskText, updateTaskKey);
              if (decrypted && typeof decrypted === 'string' && decrypted.length > 0) decryptedText = decrypted;
            } catch (_) {}
          }

          const updatedAssignedToUserId = isAssignedToUserUuid(updatedTask.assigned_to)
            ? updatedTask.assigned_to
            : undefined;

          let decryptedAssignee = '누구나';
          if (updatedAssignedToUserId) {
            decryptedAssignee = tasksRt.assigneeDisplay.current(updatedAssignedToUserId);
          } else if (
            updatedTask.assigned_to &&
            typeof updatedTask.assigned_to === 'string' &&
            updatedTask.assigned_to !== '누구나' &&
            updatedTask.assigned_to.startsWith('U2FsdGVkX1')
          ) {
            try {
              const decrypted = tasksRt.crypto.current!.decrypt(updatedTask.assigned_to, updateTaskKey);
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
        const taskKey = tasksRt.getCurrentKey.current();

        if (taskKey && taskKey.length > 0 && taskText && taskText.length > 0) {
          const isEncrypted = taskText.startsWith('U2FsdGVkX1');
          if (isEncrypted) {
            try {
              const decrypted = tasksRt.crypto.current!.decrypt(taskText, taskKey);
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
          decryptedAssignee = tasksRt.assigneeDisplay.current(newAssignedToUserId);
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
              const decrypted = tasksRt.crypto.current!.decrypt(newTask.assigned_to, taskKey);
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
    );

    return release;
  }, [currentGroupId]);

  return {
    addTask,
    toggleTask,
    deleteTask,
    claimTask,
  };
}
