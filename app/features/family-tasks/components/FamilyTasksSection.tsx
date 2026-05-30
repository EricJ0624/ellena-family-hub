/**
 * 가족 임무(Family Tasks) 섹션 컴포넌트
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FamilyTask, FamilyTaskMemberOption } from '../types';
import { useFamilyTasks } from '../hooks/useFamilyTasks';

interface FamilyTasksSectionProps {
  tasks: FamilyTask[];
  onTasksChange: (tasks: FamilyTask[]) => void;
  userId: string;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  realtimeSubscriptionId: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (
    lang: any,
    role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null
  ) => string;
  lang: any;
  /** 현재 그룹 멤버(소유자·멤버십, 본인 포함) — 닉네임 표시용 */
  taskMembers: FamilyTaskMemberOption[];
  translations: {
    todo_section_title: string;
    todo_add_btn: string;
    todo_empty_state: string;
    todo_modal_title: string;
    todo_what_label: string;
    todo_what_placeholder: string;
    todo_who_label: string;
    todo_who_placeholder: string;
    todo_register_btn: string;
    todo_required: string;
    invalid_input: string;
    anyone: string;
    cancel: string;
    delete_confirm: string;
  };
  chatDragOver: boolean;
  chatDropRef: React.RefObject<HTMLDivElement | null>;
  onChatDragOver: (e: React.DragEvent) => void;
  onChatDragLeave: () => void;
  onChatDrop: (e: React.DragEvent) => void;
}

function isTempTaskId(id: number | string): boolean {
  return typeof id === 'number' || /^\d+$/.test(String(id));
}

/** optimistic·Realtime·insert가 겹치면 id·동일 제목 중복 행 제거 */
function dedupeFamilyTasks(tasks: FamilyTask[]): FamilyTask[] {
  const seenIds = new Set<string>();
  const textToIndex = new Map<string, number>();
  const out: FamilyTask[] = [];

  for (const task of tasks) {
    const id = String(task.id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const textKey = task.text.trim();
    if (textKey && textToIndex.has(textKey)) {
      const idx = textToIndex.get(textKey)!;
      const prev = out[idx];
      if (isTempTaskId(prev.id) && !isTempTaskId(task.id)) {
        out[idx] = task;
      }
      continue;
    }

    const idx = out.length;
    out.push(task);
    if (textKey) textToIndex.set(textKey, idx);
  }

  return out;
}

export function FamilyTasksSection({
  tasks,
  onTasksChange,
  userId,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  sanitizeInput,
  realtimeSubscriptionId,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
  taskMembers,
  translations: t,
  chatDragOver,
  chatDropRef,
  onChatDragOver,
  onChatDragLeave,
  onChatDrop,
}: FamilyTasksSectionProps) {
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLSelectElement>(null);

  const formatAssigneeDisplay = useCallback(
    (uid: string) => {
      const member = taskMembers.find((m) => m.userId === uid);
      const nick = member?.nickname ?? uid.slice(0, 8);
      const role = familyRoleByUserId[uid] ?? null;
      if (!role) return nick;
      return `${getFamilyRoleEmoji(role)} ${nick} - ${getFamilyRoleLabel(lang, role)}`;
    },
    [taskMembers, familyRoleByUserId, lang, getFamilyRoleEmoji, getFamilyRoleLabel]
  );

  const assigneeDisplayFromUserIdRef = useRef(formatAssigneeDisplay);
  assigneeDisplayFromUserIdRef.current = formatAssigneeDisplay;

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    const cur = tasksRef.current;
    const resolve = assigneeDisplayFromUserIdRef.current;
    let changed = false;
    const next = cur.map((task) => {
      if (!task.assigned_to_user_id) return task;
      const nextAssignee = resolve(task.assigned_to_user_id);
      if (nextAssignee === task.assignee) return task;
      changed = true;
      return { ...task, assignee: nextAssignee };
    });
    if (changed) onTasksChange(next);
  }, [taskMembers, familyRoleByUserId, lang, onTasksChange]);

  const { addTask, toggleTask, deleteTask } = useFamilyTasks({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
    onTasksChange,
    currentTasks: tasks,
    realtimeSubscriptionId,
    assigneeDisplayFromUserIdRef,
  });

  const handleToggleTask = (taskId: number | string) => {
    const task = tasks.find((x) => x.id === taskId);
    if (!task) return;

    onTasksChange(tasks.map((x) => (x.id === taskId ? { ...x, done: !x.done } : x)));

    toggleTask(taskId, !task.done);
  };

  const handleDeleteTask = async (taskId: number | string) => {
    if (!confirm(t.delete_confirm)) return;

    const previousTasks = tasks;
    onTasksChange(tasks.filter((x) => x.id !== taskId));

    try {
      await deleteTask(taskId);
    } catch (error) {
      onTasksChange(previousTasks);
      alert('삭제에 실패했습니다.');
    }
  };

  const openTodoModal = () => {
    setIsTodoModalOpen(true);
    requestAnimationFrame(() => {
      if (todoTextRef.current) todoTextRef.current.value = '';
      if (todoWhoRef.current) todoWhoRef.current.value = '';
    });
  };

  const submitNewTodo = async () => {
    const text = todoTextRef.current?.value;
    if (!text?.trim()) return alert(t.todo_required);

    const sanitizedText = sanitizeInput(text, 100);
    if (!sanitizedText) return alert(t.invalid_input);

    const selectedUserId = (todoWhoRef.current?.value ?? '').trim();
    const assignedToUserId = selectedUserId.length > 0 ? selectedUserId : null;
    const assigneeStr = assignedToUserId ? formatAssigneeDisplay(assignedToUserId) : '누구나';

    const tempId = Date.now();
    const optimisticTask: FamilyTask = {
      id: tempId,
      text: sanitizedText,
      assignee: assigneeStr,
      done: false,
      assigned_to_user_id: assignedToUserId ?? undefined,
      created_by: userId,
    };

    const previousTasks = tasks;
    onTasksChange([optimisticTask, ...tasks]);

    if (todoTextRef.current) todoTextRef.current.value = '';
    if (todoWhoRef.current) todoWhoRef.current.value = '';
    setIsTodoModalOpen(false);

    try {
      const inserted = await addTask({
        text: sanitizedText,
        assignee: assigneeStr,
        done: false,
        assignedToUserId,
      });

      onTasksChange([
        {
          ...optimisticTask,
          id: inserted.id,
          created_by: inserted.created_by ?? userId,
          done: inserted.is_completed ?? false,
        },
        ...previousTasks.filter((t) => t.id !== tempId && t.id !== inserted.id),
      ]);
    } catch (error) {
      console.error('임무 추가 실패:', error);
      onTasksChange(previousTasks);
      alert('임무 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const visibleTasks = dedupeFamilyTasks(tasks || []);

  return (
    <>
      {isTodoModalOpen && createPortal(
        <div className="chalkboard-modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
          <div className="chalkboard-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="chalkboard-modal-title">
              <span className="chalkboard-modal-icon">📝</span>
              {t.todo_modal_title}
            </h3>
            <div className="chalkboard-modal-form">
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">{t.todo_what_label}</label>
                <input
                  ref={todoTextRef}
                  type="text"
                  className="chalkboard-form-input"
                  placeholder={t.todo_what_placeholder}
                />
              </div>
              <div className="chalkboard-form-field">
                <label className="chalkboard-form-label">{t.todo_who_label}</label>
                <select
                  ref={todoWhoRef}
                  className="chalkboard-form-input"
                  defaultValue=""
                  aria-label={t.todo_who_label}
                >
                  <option value="">{t.todo_who_placeholder || t.anyone}</option>
                  {taskMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {formatAssigneeDisplay(m.userId)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="chalkboard-modal-actions">
              <button type="button" onClick={() => setIsTodoModalOpen(false)} className="chalkboard-btn-secondary">
                {t.cancel}
              </button>
              <button type="button" onClick={submitNewTodo} className="chalkboard-btn-primary">
                {t.todo_register_btn}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      <div className="chalkboard-frame flex h-full min-h-[var(--tasks-min-h,0px)] w-full min-w-0 flex-1 flex-col">
      <section className="chalkboard-container flex min-h-0 flex-1 flex-col">
        <div className="chalkboard-top-bar">
          <h3 className="chalkboard-title">{t.todo_section_title}</h3>
          <div className="chalkboard-top-actions">
            <button type="button" onClick={openTodoModal} className="chalkboard-btn-add">
              {t.todo_add_btn}
            </button>
          </div>
        </div>
        <div
          className={`chalkboard-task-area ${chatDragOver ? 'rounded-[10px] outline outline-2 outline-offset-4 outline-dashed outline-indigo-500' : ''}`}
          ref={chatDropRef}
          onDragOver={onChatDragOver}
          onDragLeave={onChatDragLeave}
          onDrop={onChatDrop}
        >
          {visibleTasks.length > 0 ? (
            <div className="todo-list">
              {visibleTasks.map((task) => (
                <div key={task.id} className="todo-item">
                  <div onClick={() => handleToggleTask(task.id)} className="todo-content">
                    <div className={`todo-checkbox ${task.done ? 'todo-checkbox-checked' : ''}`}>
                      {task.done && (
                        <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                    <div className="todo-text-wrapper">
                      <span className={`todo-text ${task.done ? 'todo-text-done' : ''}`}>{task.text}</span>
                      {task.assignee && (
                        <span className="todo-assignee">
                          {task.assignee === '누구나' ? t.anyone : task.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                  {(task.created_by === userId || !task.created_by) && (
                    <button type="button" onClick={() => handleDeleteTask(task.id)} className="chalkboard-btn-delete">
                      <svg className="chalkboard-icon-delete" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="chalkboard-empty-state">{t.todo_empty_state}</p>
          )}
        </div>
      </section>
      </div>
    </>
  );
}
