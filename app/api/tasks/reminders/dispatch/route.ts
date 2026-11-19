import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';
import { dispatchDueRemindersForTask, loadTaskReminderTask } from '@/lib/tasks/reminders-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 할 일 저장 직후·대시보드 열림 시, 이미 발송 시각이 된 마감 알림만 보낸다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => null);
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
    if (!taskId || /^\d+$/.test(taskId)) {
      return NextResponse.json({ error: 'taskId가 필요합니다.' }, { status: 400 });
    }

    const task = await loadTaskReminderTask(taskId);
    if (!task) {
      return NextResponse.json({ error: '임무를 찾을 수 없습니다.' }, { status: 404 });
    }

    const memberCheck = await requireGroupMember(user.id, task.groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const result = await dispatchDueRemindersForTask(task, body?.title);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[tasks/reminders/dispatch]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
