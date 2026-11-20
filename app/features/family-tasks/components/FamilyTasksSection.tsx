/**
 * 가족 임무(Family Tasks) 섹션 컴포넌트
 * - kids_friendly: 칠판(키즈) 디자인
 * - default / highend_glass: 다른 위젯과 같은 기본 UI
 */

'use client';

import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';
import { useOnlineUsers } from '@/app/dashboard/online-presence';
import { isOpaqueIdLabel } from '@/app/features/family-games/components/MemberSelect';
import type { FamilyTask, FamilyTaskMemberOption, TaskRemindOffsetMinutes } from '../types';
import { useFamilyTasks } from '../hooks/useFamilyTasks';
import { useFamilyTaskSubtaskProgress } from '../hooks/useFamilyTaskSubtasks';
import { TaskSubtaskDesk } from './TaskSubtaskDesk';
import { TaskListComposer } from './TaskListComposer';
import { TaskSwipeRow } from './TaskSwipeRow';
import {
  DEFAULT_TASK_REMIND_OFFSETS,
  formatTaskDueShort,
  localInputValueToDueAtIso,
  normalizeTaskRemindOffsets,
  taskReminderFireAt,
} from '../remind-offsets';
import { dispatchDueTaskReminderClient } from '@/lib/notifications/client';
import { supabase } from '@/lib/supabase';
import { useFamilyTaskListTemplates } from '../hooks/useFamilyTaskListTemplates';
import {
  clearOpenTaskDesk,
  readOpenTaskDesk,
  writeOpenTaskDesk,
} from '../desk-persistence';
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
    close: string;
    delete_confirm: string;
    todo_due_label: string;
    todo_remind_1h: string;
    todo_list_btn: string;
    subtask_desk_title: string;
    subtask_add_placeholder: string;
    subtask_add_btn: string;
    subtask_empty: string;
    subtask_save_list: string;
    subtask_load_list: string;
    subtask_template_name_placeholder: string;
    subtask_template_empty: string;
    subtask_template_delete: string;
    subtask_template_delete_confirm: string;
    subtask_add_list_btn: string;
    subtask_composer_title: string;
    subtask_all_done: string;
  };
  chatDragOver: boolean;
  chatDropRef: React.RefObject<HTMLDivElement | null>;
  onChatDragOver: (e: React.DragEvent) => void;
  onChatDragLeave: () => void;
  onChatDrop: (e: React.DragEvent) => void;
  /**
   * 채팅 위젯에서 "할 일 추가" 클릭 시 새 할 일 모달을 열도록
   * 래퍼를 외부 ref에 노출. (캘린더 openFromChatRef와 동일 패턴)
   */
  openFromChatRef?: React.MutableRefObject<((titlePrefill: string) => void) | undefined>;
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
  openFromChatRef,
}: FamilyTasksSectionProps) {
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const todoTextRef = useRef<HTMLInputElement>(null);
  const todoWhoRef = useRef<HTMLSelectElement>(null);
  const todoDueRef = useRef<HTMLInputElement>(null);
  const todoRemind1hRef = useRef<HTMLInputElement>(null);
  const emptyStateRef = useRef<HTMLParagraphElement>(null);
  const chalkTodoListRef = useRef<HTMLDivElement>(null);
  const [emptyStateFontPx, setEmptyStateFontPx] = useState<number | null>(null);
  const [chalkTodoListMaxPx, setChalkTodoListMaxPx] = useState<number | null>(null);
  const [deskTaskId, setDeskTaskId] = useState<string | null>(null);
  const [sendReadyTick, setSendReadyTick] = useState(0);
  const [createTemplateId, setCreateTemplateId] = useState('');
  const [createListDraft, setCreateListDraft] = useState<string[]>([]);
  const [isListComposerOpen, setIsListComposerOpen] = useState(false);

  const onlineUsers = useOnlineUsers();

  const {
    templates: listTemplates,
    loadTemplateItemTexts,
    saveTemplate,
    deleteTemplate,
    reloadTemplates,
  } = useFamilyTaskListTemplates({
    currentGroupId,
    userId,
    getCurrentKey,
    CryptoService,
  });

  const handleDeleteSelectedTemplate = useCallback(async () => {
    const id = createTemplateId.trim();
    if (!id) return;
    if (!confirm(t.subtask_template_delete_confirm)) return;
    try {
      await deleteTemplate(id);
      setCreateTemplateId('');
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  }, [createTemplateId, deleteTemplate, t.subtask_template_delete_confirm]);

  const openDesk = useCallback(
    (taskId: string) => {
      setDeskTaskId(taskId);
      writeOpenTaskDesk(userId, currentGroupId, taskId);
    },
    [userId, currentGroupId],
  );

  const closeDesk = useCallback(() => {
    setDeskTaskId(null);
    clearOpenTaskDesk(userId, currentGroupId);
  }, [userId, currentGroupId]);

  // 로그아웃·복귀 시 열려 있던 서브태스크 창 복원 (로그아웃 후 userId 없으면 스킵)
  useEffect(() => {
    if (!userId || !currentGroupId) {
      setDeskTaskId(null);
      return;
    }
    const saved = readOpenTaskDesk(userId, currentGroupId);
    setDeskTaskId((prev) => prev ?? saved);
  }, [userId, currentGroupId]);

  const formatAssigneeDisplay = useCallback(
    (uid: string) => {
      const member = taskMembers.find((m) => m.userId === uid);
      const memberNick = member?.nickname?.trim() ?? '';
      const presenceName = onlineUsers.find((user) => user.id === uid)?.name?.trim() ?? '';
      const nick =
        (memberNick && !isOpaqueIdLabel(memberNick, uid) ? memberNick : '') ||
        (presenceName && !isOpaqueIdLabel(presenceName, uid) ? presenceName : '');
      const role = familyRoleByUserId[uid] ?? null;
      if (!nick && !role) return '';
      if (!role) return nick;
      if (!nick) return `${getFamilyRoleEmoji(role)} ${getFamilyRoleLabel(lang, role)}`;
      return `${getFamilyRoleEmoji(role)} ${nick} - ${getFamilyRoleLabel(lang, role)}`;
    },
    [taskMembers, onlineUsers, familyRoleByUserId, lang, getFamilyRoleEmoji, getFamilyRoleLabel]
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
  }, [tasks, taskMembers, onlineUsers, familyRoleByUserId, lang, onTasksChange]);

  const { addTask, toggleTask, deleteTask, claimTask, applyTasksChange } =
    useFamilyTasks({
      currentGroupId,
      userId,
      getCurrentKey,
      CryptoService,
      onTasksChange,
      currentTasks: tasks,
      assigneeDisplayFromUserIdRef,
    });

  const { progressByTaskId, reloadProgress } = useFamilyTaskSubtaskProgress(currentGroupId);

  const commitTasks = (next: FamilyTask[]) => {
    tasksRef.current = next;
    applyTasksChange(next);
  };

  const insertTask = async (
    sanitizedText: string,
    assignedToUserId: string | null,
    dueAt: string | null,
    remindOffsetsMinutes: TaskRemindOffsetMinutes[],
    templateIdToApply?: string,
    draftItems?: string[],
  ) => {
    const assigneeStr = assignedToUserId ? formatAssigneeDisplay(assignedToUserId) : '누구나';
    const tempId = nextTempTaskId();
    const optimisticTask: FamilyTask = {
      id: tempId,
      text: sanitizedText,
      assignee: assigneeStr,
      done: false,
      assigned_to_user_id: assignedToUserId ?? undefined,
      created_by: userId,
      due_at: dueAt,
      remind_offsets_minutes: remindOffsetsMinutes,
    };
    commitTasks([optimisticTask, ...tasksRef.current]);
    try {
      const inserted = await addTask({
        text: sanitizedText,
        assignee: assigneeStr,
        done: false,
        assignedToUserId,
        dueAt,
        remindOffsetsMinutes,
      });
      const latest = tasksRef.current.filter(
        (row) => row.id !== tempId && String(row.id) !== String(inserted.id),
      );
      const nextTask: FamilyTask = {
        ...optimisticTask,
        id: inserted.id,
        created_by: inserted.created_by ?? userId,
        done: inserted.is_completed ?? false,
        due_at: inserted.due_at ?? dueAt,
        remind_offsets_minutes: normalizeTaskRemindOffsets(
          inserted.remind_offsets_minutes ?? remindOffsetsMinutes,
        ),
      };
      commitTasks([nextTask, ...latest]);
      void dispatchDueTaskReminderClient({
        taskId: String(inserted.id),
        title: sanitizedText,
        dueAt: nextTask.due_at,
        remindOffsetsMinutes: nextTask.remind_offsets_minutes ?? [],
      });

      const draftTitles = (draftItems ?? []).map((text) => text.trim()).filter(Boolean);
      try {
        let titles = draftTitles;
        if (titles.length === 0 && templateIdToApply) {
          titles = await loadTemplateItemTexts(templateIdToApply);
        }
        if (titles.length > 0 && currentGroupId) {
          const key = getCurrentKey();
          const rows = titles.map((text, index) => ({
            task_id: String(inserted.id),
            group_id: currentGroupId,
            title: CryptoService.encrypt(text, key),
            is_done: false,
            sort_order: index,
          }));
          const { error: subError } = await supabase.from('family_task_subtasks').insert(rows);
          if (subError) console.warn('목록 항목 저장 실패:', subError);
          else void reloadProgress();
        }
      } catch (listError) {
        console.warn('목록 항목 저장 실패:', listError);
      }
    } catch (error) {
      commitTasks(tasksRef.current.filter((row) => row.id !== tempId));
      throw error;
    }
  };

  // 앱이 열려 있을 때 마감 알림 시각이 되면 발송 API 호출
  useEffect(() => {
    const now = Date.now();
    let wait = Number.POSITIVE_INFINITY;
    for (const task of tasks) {
      if (task.done || !task.due_at || isTempTaskId(task.id)) continue;
      for (const offset of normalizeTaskRemindOffsets(task.remind_offsets_minutes)) {
        const fire = taskReminderFireAt(task.due_at, offset);
        if (!fire) continue;
        const delta = fire.getTime() - now;
        if (delta <= 0) {
          void dispatchDueTaskReminderClient({
            taskId: String(task.id),
            title: task.text,
            dueAt: task.due_at,
            remindOffsetsMinutes: task.remind_offsets_minutes ?? [],
          });
        } else if (delta < wait) {
          wait = delta;
        }
      }
    }
    if (!Number.isFinite(wait)) return;
    const id = window.setTimeout(
      () => setSendReadyTick((tick) => tick + 1),
      Math.min(wait, 2_147_000_000),
    );
    return () => window.clearTimeout(id);
  }, [tasks, sendReadyTick]);

  const handleToggleTask = (taskId: number | string) => {
    const latest = tasksRef.current;
    const task = latest.find((x) => x.id === taskId);
    if (!task) return;

    commitTasks(latest.map((x) => (x.id === taskId ? { ...x, done: !x.done } : x)));

    toggleTask(taskId, !task.done);
  };

  /** 목록 전부 완료 후 닫기 — 미완료 임무만 완료로 (이미 완료면 유지) */
  const markTaskDoneIfNeeded = useCallback(
    (taskId: number | string) => {
      const latest = tasksRef.current;
      const task = latest.find((x) => x.id === taskId);
      if (!task || task.done || isTempTaskId(task.id)) return;
      commitTasks(latest.map((x) => (x.id === taskId ? { ...x, done: true } : x)));
      toggleTask(taskId, true);
    },
    [toggleTask],
  );

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
    if (deskTaskId && String(taskId) === deskTaskId) closeDesk();

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

  const openTodoModal = (titlePrefill?: string) => {
    setTodoError(null);
    setIsTodoModalOpen(true);
    void reloadTemplates();
    requestAnimationFrame(() => {
      if (todoTextRef.current) {
        const raw = titlePrefill?.trim() ?? '';
        todoTextRef.current.value = raw ? sanitizeInput(raw, 100) : '';
      }
      if (todoWhoRef.current) todoWhoRef.current.value = '';
      if (todoDueRef.current) todoDueRef.current.value = '';
      if (todoRemind1hRef.current) todoRemind1hRef.current.checked = true;
      setCreateTemplateId('');
      setCreateListDraft([]);
      setIsListComposerOpen(false);
    });
  };

  if (openFromChatRef) {
    openFromChatRef.current = (titlePrefill: string) => {
      openTodoModal(titlePrefill);
    };
  }

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
    const dueAt = localInputValueToDueAtIso(todoDueRef.current?.value ?? '');
    const remindOffsets: TaskRemindOffsetMinutes[] =
      dueAt && todoRemind1hRef.current?.checked !== false
        ? [...DEFAULT_TASK_REMIND_OFFSETS]
        : [];

    const templateId = createTemplateId.trim();
    const draftItems = [...createListDraft];
    if (todoTextRef.current) todoTextRef.current.value = '';
    if (todoWhoRef.current) todoWhoRef.current.value = '';
    if (todoDueRef.current) todoDueRef.current.value = '';
    setCreateTemplateId('');
    setCreateListDraft([]);
    setIsListComposerOpen(false);
    setTodoError(null);
    setIsTodoModalOpen(false);

    try {
      await insertTask(
        sanitizedText,
        assignedToUserId,
        dueAt,
        remindOffsets,
        templateId || undefined,
        draftItems,
      );
    } catch (error) {
      console.error('임무 추가 실패:', error);
      alert('임무 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const visibleTasks = dedupeFamilyTasks(tasks || []);
  const deskTask = deskTaskId
    ? visibleTasks.find((row) => String(row.id) === deskTaskId) ?? null
    : null;

  // 저장된 창의 임무가 목록에 더 이상 없으면 닫기 (삭제·그룹 전환)
  useEffect(() => {
    if (!deskTaskId || visibleTasks.length === 0) return;
    if (!visibleTasks.some((row) => String(row.id) === deskTaskId)) {
      closeDesk();
    }
  }, [deskTaskId, visibleTasks, closeDesk]);
  const chalkTasksScrollable = visibleTasks.length > CHALK_TASK_SCROLL_AFTER;
  const chalkTasksLayoutKey = visibleTasks
    .map(
      (task) =>
        `${task.id}:${task.text}:${task.assignee ?? ''}:${task.done ? 1 : 0}:${task.due_at ?? ''}`,
    )
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

  const templateEmptyLabel = listTemplates.length === 0 ? t.subtask_template_empty : '—';
  const addListBtnLabel =
    createListDraft.length > 0
      ? `${t.subtask_add_list_btn} (${createListDraft.length})`
      : t.subtask_add_list_btn;

  const todoModal = (
    <TopLayerDialog
      open={isTodoModalOpen}
      onClose={() => {
        setTodoError(null);
        setIsListComposerOpen(false);
        setIsTodoModalOpen(false);
      }}
    >
      {isKidsTheme ? (
            <div
              className="chalkboard-modal-frame chalkboard-modal-frame--stack"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chalkboard-modal-container">
                <div className="chalkboard-modal-stack">
                  <h2 className="chalkboard-modal-heading chalkboard-modal-heading--in-stack">
                    {t.todo_modal_title}
                  </h2>
                  <div className="chalkboard-modal-stack-body">
                    <div className="chalkboard-modal-field">
                      <label className="chalkboard-modal-field-label" htmlFor="chalkboard-todo-what">
                        {t.todo_what_label}
                      </label>
                      <input
                        ref={todoTextRef}
                        id="chalkboard-todo-what"
                        type="text"
                        className="chalkboard-form-input"
                        placeholder={t.todo_what_placeholder}
                        autoComplete="off"
                      />
                    </div>
                    <div className="chalkboard-modal-field">
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
                    <div className="chalkboard-modal-field chalkboard-modal-field--due">
                      <label className="chalkboard-modal-field-label" htmlFor="chalkboard-todo-due">
                        {t.todo_due_label}
                      </label>
                      <input
                        ref={todoDueRef}
                        id="chalkboard-todo-due"
                        type="datetime-local"
                        className="chalkboard-form-input"
                      />
                      <label className="chalkboard-modal-remind">
                        <input ref={todoRemind1hRef} type="checkbox" defaultChecked />
                        <span>{t.todo_remind_1h}</span>
                      </label>
                    </div>
                    {todoError ? (
                      <p className="chalkboard-modal-error">{todoError}</p>
                    ) : null}
                  </div>
                  {/* overflow 스크롤 영역 밖 — chalk 테두리 잘림 방지 */}
                  <div className="chalkboard-modal-field chalkboard-modal-field--template chalkboard-modal-field--template-footer">
                    <label className="chalkboard-modal-field-label" htmlFor="chalkboard-todo-template">
                      {t.subtask_load_list}
                    </label>
                      <div className="chalkboard-template-row">
                        <select
                          id="chalkboard-todo-template"
                          className="chalkboard-form-input"
                          value={createTemplateId}
                          onChange={(e) => setCreateTemplateId(e.target.value)}
                        >
                          <option value="">{templateEmptyLabel}</option>
                          {listTemplates.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.name} ({tpl.item_count})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="chalkboard-btn-secondary chalkboard-template-add-btn"
                          disabled={!createTemplateId.trim()}
                          onClick={() => void handleDeleteSelectedTemplate()}
                        >
                          {t.subtask_template_delete}
                        </button>
                        <button
                          type="button"
                          className="chalkboard-btn-secondary chalkboard-template-add-btn"
                          onClick={() => setIsListComposerOpen(true)}
                        >
                          {addListBtnLabel}
                        </button>
                      </div>
                  </div>
                  <div className="chalkboard-modal-actions chalkboard-modal-actions--in-stack">
                    <button
                      type="button"
                      onClick={() => {
                        setTodoError(null);
                        setIsListComposerOpen(false);
                        setIsTodoModalOpen(false);
                      }}
                      className="chalkboard-btn-secondary"
                    >
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
                    autoComplete="off"
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="plain-todo-due">
                    {t.todo_due_label}
                  </label>
                  <input
                    ref={todoDueRef}
                    id="plain-todo-due"
                    type="datetime-local"
                    className="form-input w-full"
                  />
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <label className="inline-flex items-center gap-1.5">
                      <input ref={todoRemind1hRef} type="checkbox" defaultChecked />
                      {t.todo_remind_1h}
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="plain-todo-template">
                    {t.subtask_load_list}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="plain-todo-template"
                      className="form-input min-w-0 flex-1"
                      value={createTemplateId}
                      onChange={(e) => setCreateTemplateId(e.target.value)}
                    >
                      <option value="">{templateEmptyLabel}</option>
                      {listTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.item_count})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!createTemplateId.trim()}
                      onClick={() => void handleDeleteSelectedTemplate()}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t.subtask_template_delete}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsListComposerOpen(true)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {addListBtnLabel}
                    </button>
                  </div>
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
                    setIsListComposerOpen(false);
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

  const deskModal = (
    <TaskSubtaskDesk
      open={!!deskTaskId}
      onClose={closeDesk}
      onCloseWithAllDone={() => {
        if (deskTaskId) markTaskDoneIfNeeded(deskTaskId);
      }}
      task={deskTask}
      currentGroupId={currentGroupId}
      getCurrentKey={getCurrentKey}
      CryptoService={CryptoService}
      isKidsTheme={isKidsTheme}
      translations={t}
    />
  );

  const listComposerModal = (
    <TaskListComposer
      open={isListComposerOpen}
      onClose={() => setIsListComposerOpen(false)}
      items={createListDraft}
      onChangeItems={setCreateListDraft}
      sanitizeInput={sanitizeInput}
      isKidsTheme={isKidsTheme}
      translations={t}
      saveTemplate={saveTemplate}
      onTemplateSaved={(id) => setCreateTemplateId(id)}
    />
  );

  const renderMeta = (task: FamilyTask) => {
    const dueLabel = formatTaskDueShort(task.due_at, typeof lang === 'string' ? lang : undefined);
    const progress = progressByTaskId[String(task.id)];
    const progressLabel =
      progress && progress.total > 0 ? `${progress.done}/${progress.total}` : null;
    if (!dueLabel && !progressLabel) return null;
    const metaText =
      dueLabel && progressLabel
        ? `${dueLabel} · ${progressLabel}`
        : dueLabel || progressLabel || '';
    return (
      <span className="todo-meta mt-0.5 block text-[0.7rem] leading-tight opacity-80 whitespace-nowrap">
        {metaText}
      </span>
    );
  };

  if (!isKidsTheme) {
    return (
      <>
        {todoModal}
        {listComposerModal}
        {deskModal}
        <section className="content-section">
          <div className="section-header">
            <h3 className="section-title">{t.todo_section_title}</h3>
            <button
              type="button"
              onClick={() => openTodoModal()}
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
                  const nick =
                    assigneeLabel === '누구나' ? t.anyone : assigneeLabel || t.anyone;
                  return (
                    <li key={task.id} className="list-none">
                      <TaskSwipeRow
                        className="rounded-xl border border-glass-medium bg-glass-soft shadow-glass-soft backdrop-blur-glass-soft"
                        onDeleteRequest={() => handleDeleteTask(task.id)}
                      >
                        <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTask(task.id);
                            }}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              task.done
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                            aria-checked={task.done}
                            role="checkbox"
                          >
                            {task.done ? (
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <span
                              className={`block text-sm font-medium leading-tight text-slate-800 line-clamp-2 ${
                                task.done ? 'line-through opacity-60' : ''
                              }`}
                            >
                              {task.text}
                            </span>
                            {renderMeta(task)}
                          </div>
                          {!isTempTaskId(task.id) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDesk(String(task.id));
                              }}
                              className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              {t.todo_list_btn}
                            </button>
                          ) : null}
                          <span className="max-w-[30%] shrink truncate text-xs text-slate-500">{nick}</span>
                          {!task.done && !task.assigned_to_user_id && !isTempTaskId(task.id) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaimTask(task.id);
                              }}
                              className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              내가 할게요
                            </button>
                          ) : null}
                        </div>
                      </TaskSwipeRow>
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
      {listComposerModal}
      {deskModal}

      <div className="chalkboard-frame flex w-full min-w-0 flex-col">
        <section className="chalkboard-container flex flex-col">
          <div className="chalkboard-top-bar">
            {/* chalkboard-bg.png 에 Family Tasks 타이틀이 포함됨 — HTML은 a11y용 sr-only */}
            <h3 className="chalkboard-title chalkboard-title--sr-only">{t.todo_section_title}</h3>
            <div className="chalkboard-top-actions">
              <button type="button" onClick={() => openTodoModal()} className="chalkboard-btn-add">
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
                  const nick =
                    assigneeLabel === '누구나' ? t.anyone : assigneeLabel || t.anyone;
                  return (
                    <TaskSwipeRow
                      key={task.id}
                      className="todo-item"
                      onDeleteRequest={() => handleDeleteTask(task.id)}
                    >
                      <div className="todo-content">
                        <button
                          type="button"
                          className={`todo-checkbox ${task.done ? 'todo-checkbox-checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTask(task.id);
                          }}
                          aria-checked={task.done}
                          role="checkbox"
                        >
                          {task.done ? (
                            <svg className="todo-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          ) : null}
                        </button>
                        <div className="todo-text-wrapper">
                          <div className="min-w-0 flex-1">
                            <span className={`todo-text ${task.done ? 'todo-text-done' : ''}`}>
                              {task.text}
                            </span>
                            {renderMeta(task)}
                          </div>
                          {!isTempTaskId(task.id) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDesk(String(task.id));
                              }}
                              className="chalkboard-btn-claim shrink-0"
                            >
                              {t.todo_list_btn}
                            </button>
                          ) : null}
                          <span className="todo-assignee">{nick}</span>
                        </div>
                        {!task.done && !task.assigned_to_user_id && !isTempTaskId(task.id) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaimTask(task.id);
                            }}
                            className="chalkboard-btn-claim"
                          >
                            내가 할게요
                          </button>
                        ) : null}
                      </div>
                    </TaskSwipeRow>
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
