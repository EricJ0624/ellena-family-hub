import { NextRequest, NextResponse } from 'next/server';
import { runCalendarReminderCron } from '@/lib/calendar/reminders-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron은 CRON_SECRET 설정 시 Authorization: Bearer <CRON_SECRET> 을 보낸다.
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;

  const headerSecret = req.headers.get('x-cron-secret') || '';
  if (headerSecret === secret) return true;

  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  try {
    const result = await runCalendarReminderCron({ dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/calendar-reminders]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
