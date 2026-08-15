/**
 * 가족 임무(Family Tasks) 섹션 컴포넌트
 * - kids_friendly: 칠판(키즈) 디자인
 * - default / highend_glass: 다른 위젯과 같은 기본 UI
 */

'use client';

import React, { memo, startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FamilyTask, FamilyTaskMemberOption } from '../types';
import { useFamilyTasks } from '../hooks/useFamilyTasks';
import { fitFontSizeToWidth, shrinkFontSizeToElement } from '@/lib/dashboard-title-fit';
import { useGroup } from '@/app/contexts/GroupContext';
import { resolveUiTheme } from '@/lib/ui-theme';

/** chalkboard-empty-state — Caveat + Gaegu(Hangul), globals.css --chalk-font-body 와 동일 */
const CHALK_EMPTY_FONT_FAMILY = "'Caveat', 'Gaegu', 'Patrick Hand', cursive";
const CHALK_EMPTY_FONT_MIN_PX = 10;
/** 이전 7.5cqw 상한과 동일 비율 — 컨테이너 기준 최대 시작 크기 */
const CHALK_EMPTY_FONT_MAX_CQW = 0.075;

/** chalkboard-bg.png 에 섹션 타이틀(Family Tasks)이 항상 포함됨 — 모든 언어에서 HTML 타이틀은 sr-only */
function usesBakedChalkboardTitle(_sectionTitle: string): boolean {
  return true;
}

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

export const FamilyTasksSection = memo(function FamilyTasksSection({
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
  const { currentGroup } = useGroup();
  const isKidsTheme = resolveUiTheme((currentGroup as { ui_theme?: unknown } | null)?.ui_theme) === 'kids_friendly';

  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLSelectElement>(null);
  const emptyStateRef = useRef<HTMLParagraphElement>(null);
  const [emptyStateFontPx, setEmptyStateFontPx] = useState<number | null>(null);

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

  const { addTask, toggleTask, deleteTask, claimTask } = useFamilyTasks({
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

  const handleClaimTask = (taskId: number | string) => {
    const task = tasks.find((x) => x.id === taskId);
    if (!task || task.done || task.assigned_to_user_id) return;

    const display = formatAssigneeDisplay(userId);
    const previous = tasks;
    onTasksChange(
      tasks.map((x) =>
        x.id === taskId ? { ...x, assigned_to_user_id: userId, assignee: display } : x,
      ),
    );

    void (async () => {
      try {
        await claimTask(taskId);
      } catch (error) {
        onTasksChange(previous);
        alert(error instanceof Error ? error.message : '임무를 맡는 데 실패했습니다.');
      }
    })();
  };

  const handleDeleteTask = (taskId: number | string) => {
    if (!confirm(t.delete_confirm)) return;

    const previousTasks = tasks;
    startTransition(() => {
      onTasksChange(tasks.filter((x) => x.id !== taskId));
    });

    void (async () => {
      try {
        await deleteTask(taskId);
      } catch {
        startTransition(() => {
          onTasksChange(previousTasks);
        });
        alert('삭제에 실패했습니다.');
      }
    })();
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
        ...previousTasks.filter((row) => row.id !== tempId && row.id !== inserted.id),
      ]);
    } catch (error) {
      console.error('임무 추가 실패:', error);
      onTasksChange(previousTasks);
      alert('임무 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const visibleTasks = dedupeFamilyTasks(tasks || []);
  const hideHtmlTitle = isKidsTheme && usesBakedChalkboardTitle(t.todo_section_title);

  const fitEmptyStateFont = useCallback(() => {
    const el = emptyStateRef.current;
    const area = el?.parentElement;
    if (!el || !area || area.clientWidth <= 0) return;

    const maxWidth = area.clientWidth * 0.92;
    const maxPx = Math.max(
      CHALK_EMPTY_FONT_MIN_PX + 1,
      area.clientWidth * CHALK_EMPTY_FONT_MAX_CQW,
    );
    const estimated = fitFontSizeToWidth(
      t.todo_empty_state,
      maxWidth,
      CHALK_EMPTY_FONT_MIN_PX,
      maxPx,
      CHALK_EMPTY_FONT_FAMILY,
      400,
    );
    const fitted = shrinkFontSizeToElement(el, estimated, CHALK_EMPTY_FONT_MIN_PX);
    setEmptyStateFontPx(fitted);
  }, [t.todo_empty_state]);

  useLayoutEffect(() => {
    if (!isKidsTheme || visibleTasks.length > 0) {
      setEmptyStateFontPx(null);
      return;
    }
    fitEmptyStateFont();
    const area = emptyStateRef.current?.parentElement;
    if (!area) return;
    const ro = new ResizeObserver(() => fitEmptyStateFont());
    ro.observe(area);
    const onFonts = () => fitEmptyStateFont();
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    void document.fonts?.ready?.then(onFonts);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, [isKidsTheme, visibleTasks.length, fitEmptyStateFont]);

  const todoModal = isTodoModalOpen
    ? createPortal(
        isKidsTheme ? (
          <div className="chalkboard-modal-overlay" onClick={() => setIsTodoModalOpen(false)}>
            <div className="chalkboard-modal-frame" onClick={(e) => e.stopPropagation()}>
              <div className="chalkboard-modal-container">
                <h2 className="chalkboard-modal-heading">{t.todo_modal_title}</h2>
                <div className="chalkboard-modal-form">
                  <div className="chalkboard-modal-field chalkboard-modal-field--what">
                    <label className="chalkboard-modal-field-label" htmlFor="chalkboard-todo-what">
                      {t.todo_what_label}
                    </label>
                    <input
                      ref={todoTextRef}
                      id="chalkboard-todo-what"
                      type="text"
                      className="chalkboard-form-input"
                      placeholder={t.todo_what_placeholder}
                    />
                  </div>
                  <div className="chalkboard-modal-field chalkboard-modal-field--who">
                    <label className="chalkboard-modal-field-label" htmlFor="chalkboard-todo-who">
                      {t.todo_who_label}
                    </label>
                    <select
                      ref={todoWhoRef}
                      id="chalkboard-todo-who"
                      className="chalkboard-form-input"
                      defaultValue=""
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
          </div>
        ) : (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4"
            onClick={() => setIsTodoModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-glass-medium bg-glass-strong p-5 shadow-glass-medium backdrop-blur-glass-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="m-0 text-lg font-semibold text-slate-800">{t.todo_modal_title}</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="plain-todo-what">
                    {t.todo_what_label}
                  </label>
                  <input
                    ref={todoTextRef}
                    id="plain-todo-what"
                    type="text"
                    className="form-input w-full"
                    placeholder={t.todo_what_placeholder}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="plain-todo-who">
                    {t.todo_who_label}
                  </label>
                  <select ref={todoWhoRef} id="plain-todo-who" className="form-input w-full" defaultValue="">
                    <option value="">{t.todo_who_placeholder || t.anyone}</option>
                    {taskMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {formatAssigneeDisplay(m.userId)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTodoModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={submitNewTodo}
                  className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
                >
                  {t.todo_register_btn}
                </button>
              </div>
            </div>
          </div>
        ),
        document.body
      )
    : null;

  if (!isKidsTheme) {
    return (
      <>
        {todoModal}
        <section className="content-section">
          <div className="section-header">
            <h3 className="section-title">{t.todo_section_title}</h3>
            <button
              type="button"
              onClick={openTodoModal}
              className="inline-flex cursor-pointer items-center rounded-lg border-0 bg-indigo-500 font-bold text-white transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              style={{ gap: '1.5cqmin', padding: '2cqmin 3cqmin', fontSize: '4cqmin' }}
            >
              {t.todo_add_btn}
            </button>
          </div>
          <div
            className={`section-body ${chatDragOver ? 'rounded-[10px] outline outline-2 outline-offset-4 outline-dashed outline-indigo-500' : ''}`}
            ref={chatDropRef}
            onDragOver={onChatDragOver}
            onDragLeave={onChatDragLeave}
            onDrop={onChatDrop}
          >
            {visibleTasks.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {visibleTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-xl border border-glass-medium bg-glass-soft px-3 py-2 shadow-glass-soft backdrop-blur-glass-soft"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="flex min-w-0 flex-1 items-start gap-2 border-0 bg-transparent p-0 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          task.done
                            ? 'border-indigo-500 bg-indigo-500 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        {task.done ? (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium text-slate-800 ${task.done ? 'line-through opacity-60' : ''}`}
                        >
                          {task.text}
                        </span>
                        {task.assignee ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {task.assignee === '누구나' ? t.anyone : task.assignee}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {!task.done && !task.assigned_to_user_id && !isTempTaskId(task.id) ? (
                      <button
                        type="button"
                        onClick={() => handleClaimTask(task.id)}
                        className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        내가 할게요
                      </button>
                    ) : null}
                    {(task.created_by === userId || !task.created_by) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="delete"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-center text-slate-500" style={{ padding: '8cqmin 4cqmin', fontSize: '5cqmin' }}>
                {t.todo_empty_state}
              </p>
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {/* Shared chalk grain filter — add btn, empty state, modal (portal) all use this id */}
      <svg aria-hidden="true" focusable="false" width={0} height={0} className="pointer-events-none absolute overflow-hidden">
        <defs>
          <filter
            id="chalkboard-chalk-texture"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.05"
              numOctaves="3"
              seed="5"
              stitchTiles="stitch"
              result="noise"
            />
            {/* Gentler dust holes — strong punch made Hangul(추) unreadable */}
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.85 1.08"
              result="dustAlpha"
            />
            <feComposite in="SourceGraphic" in2="dustAlpha" operator="in" result="dusty" />
            <feDisplacementMap
              in="dusty"
              in2="noise"
              scale="1.15"
              xChannelSelector="R"
              yChannelSelector="G"
              result="rough"
            />
            <feGaussianBlur in="rough" stdDeviation="0.18" />
          </filter>
        </defs>
      </svg>
      {todoModal}

      <div className="chalkboard-frame flex w-full min-w-0 flex-col">
        <section className="chalkboard-container flex flex-col">
          <div className="chalkboard-top-bar">
            <h3
              className={
                hideHtmlTitle ? 'chalkboard-title chalkboard-title--sr-only' : 'chalkboard-title'
              }
            >
              {t.todo_section_title}
            </h3>
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
                    {!task.done && !task.assigned_to_user_id && !isTempTaskId(task.id) ? (
                      <button
                        type="button"
                        onClick={() => handleClaimTask(task.id)}
                        className="chalkboard-btn-add"
                        style={{ fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}
                      >
                        내가 할게요
                      </button>
                    ) : null}
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
              <p
                ref={emptyStateRef}
                className="chalkboard-empty-state"
                style={emptyStateFontPx != null ? { fontSize: `${emptyStateFontPx}px` } : undefined}
              >
                {t.todo_empty_state}
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
});
