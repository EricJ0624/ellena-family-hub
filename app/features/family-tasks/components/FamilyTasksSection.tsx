/**
 * 가족 임무(Family Tasks) 섹션 컴포넌트
 * - kids_friendly: 칠판(키즈) 디자인
 * - default / highend_glass: 다른 위젯과 같은 기본 UI
 */

'use client';

import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';
import { isOpaqueIdLabel } from '@/app/features/family-games/components/MemberSelect';
import type { FamilyTask, FamilyTaskMemberOption } from '../types';
import { useFamilyTasks } from '../hooks/useFamilyTasks';
import {
  fitFontSizeToWidth,
  shrinkFontSizeToElement,
  shrinkFontSizeToMaxLines,
} from '@/lib/dashboard-title-fit';

/** chalkboard-empty-state — Caveat + Gaegu(Hangul), globals.css --chalk-font-body 와 동일 */
const CHALK_EMPTY_FONT_FAMILY = "'Caveat', 'Gaegu', 'Patrick Hand', cursive";
const CHALK_EMPTY_FONT_MIN_PX = 10;
/** 이전 7.5cqw 상한과 동일 비율 — 컨테이너 기준 최대 시작 크기 */
const CHALK_EMPTY_FONT_MAX_CQW = 0.075;
/** 칠판 목록: 이 개수까지는 높이 성장, 초과 시 스크롤 */
const CHALK_TASK_SCROLL_AFTER = 4;
/** .todo-text 기본 5.5cqw / 축소 하한 */
const CHALK_TASK_TEXT_MAX_CQW = 0.055;
const CHALK_TASK_TEXT_MIN_CQW = 0.032;
const CHALK_TASK_TEXT_MAX_LINES = 2;

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
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (
    lang: any,
    role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null
  ) => string;
  lang: any;
  /** 대시보드에서 내려줌 — 내부 useGroup 금지(memo가 깨져 위젯 클릭 시 전체 재렌더됨) */
  isKidsTheme: boolean;
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

/**
 * 같은 id만 제거. 제목이 같은 임무 두 개는 유지한다.
 * 서버 행이 있으면 그 제목의 임시 행은 서버 행 수만큼만 짝을 지어 뺀다.
 */
function dedupeFamilyTasks(tasks: FamilyTask[]): FamilyTask[] {
  const seenIds = new Set<string>();
  const unique: FamilyTask[] = [];
  for (const task of tasks) {
    const id = String(task.id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    unique.push(task);
  }

  const realCountByText = new Map<string, number>();
  for (const task of unique) {
    if (isTempTaskId(task.id)) continue;
    const textKey = task.text.trim();
    if (!textKey) continue;
    realCountByText.set(textKey, (realCountByText.get(textKey) ?? 0) + 1);
  }
  if (realCountByText.size === 0) return unique;

  const pairedTemps = new Map<string, number>();
  return unique.filter((task) => {
    if (!isTempTaskId(task.id)) return true;
    const textKey = task.text.trim();
    const reals = realCountByText.get(textKey) ?? 0;
    const used = pairedTemps.get(textKey) ?? 0;
    if (used < reals) {
      pairedTemps.set(textKey, used + 1);
      return false;
    }
    return true;
  });
}

let lastTempTaskId = 0;
function nextTempTaskId(): number {
  const now = Date.now();
  lastTempTaskId = now > lastTempTaskId ? now : lastTempTaskId + 1;
  return lastTempTaskId;
}

export const FamilyTasksSection = memo(function FamilyTasksSection({
  tasks,
  onTasksChange,
  userId,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  sanitizeInput,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
  isKidsTheme,
  taskMembers,
  translations: t,
  chatDragOver,
  chatDropRef,
  onChatDragOver,
  onChatDragLeave,
  onChatDrop,
}: FamilyTasksSectionProps) {
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLSelectElement>(null);
  const emptyStateRef = useRef<HTMLParagraphElement>(null);
  const chalkTodoListRef = useRef<HTMLDivElement>(null);
  const [emptyStateFontPx, setEmptyStateFontPx] = useState<number | null>(null);
  const [chalkTodoListMaxPx, setChalkTodoListMaxPx] = useState<number | null>(null);

  const formatAssigneeDisplay = useCallback(
    (uid: string) => {
      const member = taskMembers.find((m) => m.userId === uid);
      const rawNick = member?.nickname?.trim() ?? '';
      const nick = rawNick && !isOpaqueIdLabel(rawNick, uid) ? rawNick : '';
      const role = familyRoleByUserId[uid] ?? null;
      if (!nick && !role) return '';
      if (!role) return nick;
      if (!nick) return `${getFamilyRoleEmoji(role)} ${getFamilyRoleLabel(lang, role)}`;
      return `${getFamilyRoleEmoji(role)} ${nick} - ${getFamilyRoleLabel(lang, role)}`;
    },
    [taskMembers, familyRoleByUserId, lang, getFamilyRoleEmoji, getFamilyRoleLabel]
  );

  const assigneeText = useCallback(
    (task: FamilyTask) => {
      if (!task.assigned_to_user_id) return task.assignee || '';
      const resolved = formatAssigneeDisplay(task.assigned_to_user_id);
      if (resolved && !isOpaqueIdLabel(resolved, task.assigned_to_user_id)) return resolved;
      if (task.assignee && !isOpaqueIdLabel(task.assignee, task.assigned_to_user_id)) return task.assignee;
      return '';
    },
    [formatAssigneeDisplay]
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
      const resolved = resolve(task.assigned_to_user_id);
      const resolvedOk = Boolean(resolved) && !isOpaqueIdLabel(resolved, task.assigned_to_user_id);
      if (resolvedOk) {
        if (resolved === task.assignee) return task;
        changed = true;
        return { ...task, assignee: resolved };
      }
      if (task.assignee && isOpaqueIdLabel(task.assignee, task.assigned_to_user_id)) {
        changed = true;
        return { ...task, assignee: '' };
      }
      return task;
    });
    if (changed) onTasksChange(next);
  }, [tasks, taskMembers, familyRoleByUserId, lang, onTasksChange]);

  const { addTask, toggleTask, deleteTask, claimTask, applyTasksChange } = useFamilyTasks({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
    onTasksChange,
    currentTasks: tasks,
    assigneeDisplayFromUserIdRef,
  });

  const commitTasks = (next: FamilyTask[]) => {
    tasksRef.current = next;
    applyTasksChange(next);
  };

  const handleToggleTask = (taskId: number | string) => {
    const latest = tasksRef.current;
    const task = latest.find((x) => x.id === taskId);
    if (!task) return;

    commitTasks(latest.map((x) => (x.id === taskId ? { ...x, done: !x.done } : x)));

    toggleTask(taskId, !task.done);
  };

  const handleClaimTask = (taskId: number | string) => {
    const latest = tasksRef.current;
    const task = latest.find((x) => x.id === taskId);
    if (!task || task.done || task.assigned_to_user_id) return;

    const display = formatAssigneeDisplay(userId);
    commitTasks(
      latest.map((x) =>
        x.id === taskId ? { ...x, assigned_to_user_id: userId, assignee: display } : x,
      ),
    );

    void (async () => {
      try {
        await claimTask(taskId);
      } catch (error) {
        const rolled = tasksRef.current.map((x) => (x.id === taskId ? task : x));
        commitTasks(rolled);
        alert(error instanceof Error ? error.message : '임무를 맡는 데 실패했습니다.');
      }
    })();
  };

  const handleDeleteTask = (taskId: number | string) => {
    if (!confirm(t.delete_confirm)) return;

    const removed = tasksRef.current.find((x) => x.id === taskId);
    commitTasks(tasksRef.current.filter((x) => x.id !== taskId));

    void (async () => {
      try {
        await deleteTask(taskId);
      } catch {
        const latest = tasksRef.current;
        if (removed && !latest.some((x) => x.id === taskId)) {
          commitTasks([removed, ...latest]);
        }
        alert('삭제에 실패했습니다.');
      }
    })();
  };

  const openTodoModal = () => {
    setTodoError(null);
    setIsTodoModalOpen(true);
    requestAnimationFrame(() => {
      if (todoTextRef.current) todoTextRef.current.value = '';
      if (todoWhoRef.current) todoWhoRef.current.value = '';
    });
  };

  const submitNewTodo = async () => {
    const text = todoTextRef.current?.value;
    if (!text?.trim()) {
      setTodoError(t.todo_required);
      return;
    }

    const sanitizedText = sanitizeInput(text, 100);
    if (!sanitizedText) {
      setTodoError(t.invalid_input);
      return;
    }

    const selectedUserId = (todoWhoRef.current?.value ?? '').trim();
    const assignedToUserId = selectedUserId.length > 0 ? selectedUserId : null;
    const assigneeStr = assignedToUserId ? formatAssigneeDisplay(assignedToUserId) : '누구나';

    const tempId = nextTempTaskId();
    const optimisticTask: FamilyTask = {
      id: tempId,
      text: sanitizedText,
      assignee: assigneeStr,
      done: false,
      assigned_to_user_id: assignedToUserId ?? undefined,
      created_by: userId,
    };

    if (todoTextRef.current) todoTextRef.current.value = '';
    if (todoWhoRef.current) todoWhoRef.current.value = '';
    setTodoError(null);
    setIsTodoModalOpen(false);
    commitTasks([optimisticTask, ...tasksRef.current]);

    try {
      const inserted = await addTask({
        text: sanitizedText,
        assignee: assigneeStr,
        done: false,
        assignedToUserId,
      });

      const latest = tasksRef.current.filter(
        (row) => row.id !== tempId && String(row.id) !== String(inserted.id),
      );
      commitTasks([
        {
          ...optimisticTask,
          id: inserted.id,
          created_by: inserted.created_by ?? userId,
          done: inserted.is_completed ?? false,
        },
        ...latest,
      ]);
    } catch (error) {
      console.error('임무 추가 실패:', error);
      commitTasks(tasksRef.current.filter((row) => row.id !== tempId));
      alert('임무 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const visibleTasks = dedupeFamilyTasks(tasks || []);
  const chalkTasksScrollable = visibleTasks.length > CHALK_TASK_SCROLL_AFTER;
  const chalkTasksLayoutKey = visibleTasks
    .map((task) => `${task.id}:${task.text}:${task.assignee ?? ''}:${task.done ? 1 : 0}`)
    .join('|');

  const fitChalkTodoTextsAndCap = useCallback(() => {
    const list = chalkTodoListRef.current;
    if (!list) return;

    const frame = list.closest('.chalkboard-frame') as HTMLElement | null;
    const frameW = frame?.clientWidth ?? list.clientWidth;
    if (frameW <= 0) return;

    const maxPx = Math.max(CHALK_EMPTY_FONT_MIN_PX, frameW * CHALK_TASK_TEXT_MAX_CQW);
    const minPx = Math.max(8, frameW * CHALK_TASK_TEXT_MIN_CQW);

    list.querySelectorAll<HTMLElement>('.todo-text').forEach((el) => {
      el.style.fontSize = '';
      shrinkFontSizeToMaxLines(el, maxPx, minPx, CHALK_TASK_TEXT_MAX_LINES);
    });

    if (visibleTasks.length <= CHALK_TASK_SCROLL_AFTER) {
      setChalkTodoListMaxPx((prev) => (prev === null ? prev : null));
      return;
    }

    const items = list.querySelectorAll<HTMLElement>('.todo-item');
    if (items.length < CHALK_TASK_SCROLL_AFTER) return;

    let height = 0;
    for (let i = 0; i < CHALK_TASK_SCROLL_AFTER; i++) {
      height += items[i].offsetHeight;
    }
    const gap = parseFloat(getComputedStyle(list).rowGap || getComputedStyle(list).gap) || 0;
    height += gap * (CHALK_TASK_SCROLL_AFTER - 1);
    const next = Math.ceil(height);
    setChalkTodoListMaxPx((prev) => (prev === next ? prev : next));
  }, [visibleTasks.length]);

  useLayoutEffect(() => {
    if (!isKidsTheme || isTodoModalOpen || visibleTasks.length === 0) {
      setChalkTodoListMaxPx((prev) => (prev === null ? prev : null));
      return;
    }

    fitChalkTodoTextsAndCap();
    const list = chalkTodoListRef.current;
    const frame = list?.closest('.chalkboard-frame') ?? null;
    if (!list) return;

    const ro = new ResizeObserver(() => {
      fitChalkTodoTextsAndCap();
    });
    ro.observe(list);
    if (frame) ro.observe(frame);
    return () => ro.disconnect();
  }, [
    isKidsTheme,
    isTodoModalOpen,
    visibleTasks.length,
    chalkTasksLayoutKey,
    fitChalkTodoTextsAndCap,
  ]);

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
    setEmptyStateFontPx((prev) => (prev === fitted ? prev : fitted));
  }, [t.todo_empty_state]);

  useLayoutEffect(() => {
    if (isTodoModalOpen) return;
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
  }, [isKidsTheme, visibleTasks.length, fitEmptyStateFont, isTodoModalOpen]);

  const todoModal = (
    <TopLayerDialog
      open={isTodoModalOpen}
      onClose={() => {
        setTodoError(null);
        setIsTodoModalOpen(false);
      }}
    >
      {isKidsTheme ? (
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
                {todoError ? (
                  <p className="mt-2 text-center text-sm font-medium text-red-200">{todoError}</p>
                ) : null}
                <div className="chalkboard-modal-actions">
                  <button type="button" onClick={() => { setTodoError(null); setIsTodoModalOpen(false); }} className="chalkboard-btn-secondary">
                    {t.cancel}
                  </button>
                  <button type="button" onClick={submitNewTodo} className="chalkboard-btn-primary">
                    {t.todo_register_btn}
                  </button>
                </div>
              </div>
            </div>
        ) : (
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
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
              {todoError ? (
                <p className="mt-3 text-sm font-medium text-red-600">{todoError}</p>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTodoError(null);
                    setIsTodoModalOpen(false);
                  }}
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
      )}
    </TopLayerDialog>
  );

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
                {visibleTasks.map((task) => {
                  const assigneeLabel = assigneeText(task);
                  return (
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
                        {assigneeLabel ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {assigneeLabel === '누구나' ? t.anyone : assigneeLabel}
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
                  );
                })}
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
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
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
            {/* chalkboard-bg.png 에 Family Tasks 타이틀이 포함됨 — HTML은 a11y용 sr-only */}
            <h3 className="chalkboard-title chalkboard-title--sr-only">{t.todo_section_title}</h3>
            <div className="chalkboard-top-actions">
              <button type="button" onClick={openTodoModal} className="chalkboard-btn-add">
                {t.todo_add_btn}
              </button>
            </div>
          </div>
          <div
            className={`chalkboard-task-area${chalkTasksScrollable ? ' chalkboard-task-area--scroll' : ''}${chatDragOver ? ' rounded-[10px] outline outline-2 outline-offset-4 outline-dashed outline-indigo-500' : ''}`}
            ref={chatDropRef}
            onDragOver={onChatDragOver}
            onDragLeave={onChatDragLeave}
            onDrop={onChatDrop}
          >
            {visibleTasks.length > 0 ? (
              <div
                className="todo-list"
                ref={chalkTodoListRef}
                style={
                  chalkTasksScrollable && chalkTodoListMaxPx != null
                    ? { maxHeight: chalkTodoListMaxPx }
                    : undefined
                }
              >
                {visibleTasks.map((task) => {
                  const assigneeLabel = assigneeText(task);
                  return (
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
                        {assigneeLabel ? (
                          <span className="todo-assignee">
                            {assigneeLabel === '누구나' ? t.anyone : assigneeLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {!task.done && !task.assigned_to_user_id && !isTempTaskId(task.id) ? (
                      <button
                        type="button"
                        onClick={() => handleClaimTask(task.id)}
                        className="chalkboard-btn-claim"
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
                  );
                })}
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
