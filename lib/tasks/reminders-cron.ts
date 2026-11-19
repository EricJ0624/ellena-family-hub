import { CURRENT_APP_ID } from '@/lib/apps';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import {
  isTaskReminderFireDue,
  normalizeTaskRemindOffsets,
} from '@/app/features/family-tasks/remind-offsets';
import { getGroupMemberUserIds, notifyFamily } from '@/lib/notifications/notify';

export type TaskReminderCronResult = {
  scanned: number;
  due: number;
  notified: number;
  skipped: number;
  errors: string[];
};

type SupabaseServer = ReturnType<typeof getSupabaseServerClient>;

type DispatchStatus = 'notified' | 'skipped' | 'error';

type ReminderTask = {
  id: string;
  groupId: string;
  dueAt: string;
  remindOffsets: number[];
  assignedTo: string | null;
  isCompleted: boolean;
};

async function recordDispatch(
  result: { notified: number; skipped: number; errors: string[] },
  label: string,
  run: () => Promise<DispatchStatus>,
) {
  try {
    const status = await run();
    if (status === 'notified') result.notified += 1;
    else if (status === 'skipped') result.skipped += 1;
    else result.errors.push(`${label}: notify produced no delivery`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${label}: ${message}`);
  }
}

async function deleteDispatch(
  supabase: SupabaseServer,
  taskId: string,
  offsetMinutes: number,
) {
  await supabase
    .from('task_reminder_dispatches')
    .delete()
    .eq('task_id', taskId)
    .eq('offset_minutes', offsetMinutes);
}

async function resolveRecipients(
  supabase: SupabaseServer,
  groupId: string,
  assignedTo: string | null,
): Promise<string[]> {
  if (assignedTo) return [assignedTo];
  return getGroupMemberUserIds(groupId, supabase);
}

/** 이미 발송 시각이 된 알림 하나를 기록하고 보낸다. 같은 (task, offset)은 한 번만. */
export async function dispatchOneTaskReminder(
  supabase: SupabaseServer,
  input: {
    taskId: string;
    groupId: string;
    offsetMinutes: number;
    assignedTo: string | null;
    plainTitle?: string | null;
    dryRun?: boolean;
  },
): Promise<DispatchStatus> {
  if (input.dryRun) return 'notified';

  const { error: insertError } = await supabase.from('task_reminder_dispatches').insert({
    task_id: input.taskId,
    group_id: input.groupId,
    offset_minutes: input.offsetMinutes,
    app_id: CURRENT_APP_ID,
  });

  if (insertError) {
    if (String(insertError.code) === '23505' || /duplicate|unique/i.test(insertError.message)) {
      return 'skipped';
    }
    throw new Error(insertError.message);
  }

  try {
    const recipients = await resolveRecipients(supabase, input.groupId, input.assignedTo);
    if (recipients.length === 0) {
      await deleteDispatch(supabase, input.taskId, input.offsetMinutes);
      return 'skipped';
    }

    const title = input.plainTitle?.trim()
      ? `⏰ ${input.plainTitle.trim().slice(0, 60)}`
      : '⏰ 마감된 가족 임무가 있습니다';
    const body =
      input.offsetMinutes === 60
        ? '임무 마감 1시간 전입니다.'
        : `임무 마감 ${input.offsetMinutes}분 전입니다.`;

    const notifyResult = await notifyFamily({
      groupId: input.groupId,
      actorUserId: null,
      recipientUserIds: recipients,
      widgetKey: 'tasks',
      eventType: 'TASK_DUE_REMINDER',
      title,
      body,
      url: `/dashboard?focus=tasks`,
      entityId: input.taskId,
      payload: {
        taskId: input.taskId,
        offsetMinutes: input.offsetMinutes,
      },
      tag: `task-reminder-${input.taskId}-${input.offsetMinutes}`,
      appId: CURRENT_APP_ID,
    });

    const delivered = notifyResult.notified > 0 || notifyResult.pushSent > 0;
    if (delivered) return 'notified';
    if (notifyResult.skipped > 0) return 'skipped';

    await deleteDispatch(supabase, input.taskId, input.offsetMinutes);
    return 'error';
  } catch (err) {
    await deleteDispatch(supabase, input.taskId, input.offsetMinutes);
    throw err;
  }
}

export async function runTaskReminderCron(options?: {
  dryRun?: boolean;
}): Promise<TaskReminderCronResult> {
  const dryRun = !!options?.dryRun;
  const result: TaskReminderCronResult = {
    scanned: 0,
    due: 0,
    notified: 0,
    skipped: 0,
    errors: [],
  };

  const supabase = getSupabaseServerClient();
  const { data: tasks, error } = await supabase
    .from('family_tasks')
    .select('id, group_id, due_at, remind_offsets_minutes, assigned_to, is_completed, app_id')
    .eq('app_id', CURRENT_APP_ID)
    .not('due_at', 'is', null)
    .or('is_completed.is.null,is_completed.eq.false');

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = tasks || [];
  result.scanned = rows.length;

  for (const task of rows) {
    const taskId = String(task.id);
    const groupId = task.group_id ? String(task.group_id) : '';
    const dueAt = typeof task.due_at === 'string' ? task.due_at : '';
    if (!groupId || !dueAt) {
      result.skipped += 1;
      continue;
    }
    if (task.is_completed) {
      result.skipped += 1;
      continue;
    }

    const offsets = normalizeTaskRemindOffsets(task.remind_offsets_minutes);
    if (offsets.length === 0) {
      result.skipped += 1;
      continue;
    }

    const assignedTo =
      typeof task.assigned_to === 'string' && task.assigned_to ? String(task.assigned_to) : null;

    for (const offsetMinutes of offsets) {
      if (!isTaskReminderFireDue(dueAt, offsetMinutes)) continue;
      result.due += 1;
      await recordDispatch(result, `${taskId}/${offsetMinutes}`, () =>
        dispatchOneTaskReminder(supabase, {
          taskId,
          groupId,
          offsetMinutes,
          assignedTo,
          dryRun,
        }),
      );
    }
  }

  return result;
}

export async function loadTaskReminderTask(taskId: string): Promise<ReminderTask | null> {
  const supabase = getSupabaseServerClient();
  const { data: task, error } = await supabase
    .from('family_tasks')
    .select('id, group_id, due_at, remind_offsets_minutes, assigned_to, is_completed, app_id')
    .eq('id', taskId)
    .maybeSingle();

  if (error || !task?.group_id || !task.due_at) return null;
  if (String(task.app_id || '') !== CURRENT_APP_ID) return null;

  return {
    id: String(task.id),
    groupId: String(task.group_id),
    dueAt: String(task.due_at),
    remindOffsets: normalizeTaskRemindOffsets(task.remind_offsets_minutes),
    assignedTo:
      typeof task.assigned_to === 'string' && task.assigned_to ? String(task.assigned_to) : null,
    isCompleted: !!task.is_completed,
  };
}

/** 저장 직후·대시보드 열림 시, 이미 알림 시각이 된 것만 보낸다. */
export async function dispatchDueRemindersForTask(
  task: ReminderTask,
  plainTitle: unknown,
): Promise<{ notified: number; skipped: number; errors: string[] }> {
  const result = { notified: 0, skipped: 0, errors: [] as string[] };
  if (task.isCompleted || !task.dueAt || task.remindOffsets.length === 0) {
    return result;
  }

  const supabase = getSupabaseServerClient();
  const plain =
    typeof plainTitle === 'string' ? plainTitle.replace(/\s+/g, ' ').trim().slice(0, 60) : null;

  for (const offsetMinutes of normalizeTaskRemindOffsets(task.remindOffsets)) {
    if (!isTaskReminderFireDue(task.dueAt, offsetMinutes)) continue;
    await recordDispatch(result, `${task.id}/${offsetMinutes}`, () =>
      dispatchOneTaskReminder(supabase, {
        taskId: task.id,
        groupId: task.groupId,
        offsetMinutes,
        assignedTo: task.assignedTo,
        plainTitle: plain,
      }),
    );
  }

  return result;
}
