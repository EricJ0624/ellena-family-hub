import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { isValidUUID } from '@/lib/validation';

const REASON_CODES = [
  'report',
  'dispute',
  'legal',
  'admin_absent',
  'other',
] as const;

type ReasonCode = (typeof REASON_CODES)[number];

function isReasonCode(value: unknown): value is ReasonCode {
  return typeof value === 'string' && (REASON_CODES as readonly string[]).includes(value);
}

function parseAccessReason(body: {
  reason?: unknown;
  reason_code?: unknown;
}): { ok: true; reason: string; reasonCode: ReasonCode } | { ok: false; response: NextResponse } {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 10) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '접근 사유를 10자 이상 입력해 주세요.' },
        { status: 400 }
      ),
    };
  }
  if (reason.length > 2000) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: '접근 사유가 너무 깁니다.' },
        { status: 400 }
      ),
    };
  }
  if (!isReasonCode(body.reason_code)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            '사유 유형이 필요합니다. (report | dispute | legal | admin_absent | other)',
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, reason, reasonCode: body.reason_code };
}

async function loadTicketWithGroup(ticketId: string) {
  const supabase = getSupabaseServerClient();
  const { data: ticket, error } = await supabase
    .from('member_support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (error) {
    console.error('멤버 문의 단건 조회 오류:', error);
    return { error: NextResponse.json({ error: '문의 조회에 실패했습니다.' }, { status: 500 }) };
  }
  if (!ticket) {
    return { error: NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 }) };
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, app_id')
    .eq('id', ticket.group_id)
    .maybeSingle();

  return {
    supabase,
    ticket: {
      ...ticket,
      app_id: group?.app_id ?? null,
      groups: group
        ? { id: group.id, name: group.name, app_id: group.app_id ?? null }
        : { id: ticket.group_id, name: String(ticket.group_id), app_id: null },
    },
  };
}

/**
 * 시스템 관리자 예외 단건 조회.
 * 전역 목록은 제공하지 않음. 사유·유형 필수 + 감사로그.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const ticketId = typeof body.ticket_id === 'string' ? body.ticket_id.trim() : '';
    if (!ticketId || !isValidUUID(ticketId)) {
      return NextResponse.json({ error: '유효한 문의 ID(ticket_id)가 필요합니다.' }, { status: 400 });
    }

    const parsed = parseAccessReason(body);
    if (!parsed.ok) return parsed.response;

    const loaded = await loadTicketWithGroup(ticketId);
    if ('error' in loaded && loaded.error) return loaded.error;
    const { supabase, ticket } = loaded as {
      supabase: ReturnType<typeof getSupabaseServerClient>;
      ticket: Record<string, unknown> & { group_id: string; created_by?: string; title?: string };
    };

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'READ',
      resourceType: 'member_support_ticket',
      resourceId: ticketId,
      groupId: ticket.group_id,
      targetUserId: (ticket.created_by as string) || null,
      details: {
        actor: 'system_admin',
        access_mode: 'exception_lookup',
        reason_code: parsed.reasonCode,
        reason: parsed.reason,
        title: ticket.title ?? null,
        app_id: (ticket as { app_id?: string | null }).app_id ?? null,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '문의 조회 중 오류가 발생했습니다.';
    console.error('멤버 문의 예외 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 시스템 관리자 예외 삭제.
 * 그룹 관리자 부재 등으로 방치된 문의 정리 등. 사유·유형 필수 + 감사로그.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    const ticketId = typeof body.ticket_id === 'string' ? body.ticket_id.trim() : '';
    if (!ticketId || !isValidUUID(ticketId)) {
      return NextResponse.json({ error: '유효한 문의 ID(ticket_id)가 필요합니다.' }, { status: 400 });
    }

    const parsed = parseAccessReason(body);
    if (!parsed.ok) return parsed.response;

    const loaded = await loadTicketWithGroup(ticketId);
    if ('error' in loaded && loaded.error) return loaded.error;
    const { supabase, ticket } = loaded as {
      supabase: ReturnType<typeof getSupabaseServerClient>;
      ticket: Record<string, unknown> & { group_id: string; created_by?: string; title?: string };
    };

    const { error: delErr } = await supabase
      .from('member_support_tickets')
      .delete()
      .eq('id', ticketId);

    if (delErr) {
      console.error('멤버 문의 예외 삭제 오류:', delErr);
      return NextResponse.json({ error: '문의 삭제에 실패했습니다.' }, { status: 500 });
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'DELETE',
      resourceType: 'member_support_ticket',
      resourceId: ticketId,
      groupId: ticket.group_id,
      targetUserId: (ticket.created_by as string) || null,
      details: {
        actor: 'system_admin',
        access_mode: 'exception_delete',
        reason_code: parsed.reasonCode,
        reason: parsed.reason,
        title: ticket.title ?? null,
        app_id: (ticket as { app_id?: string | null }).app_id ?? null,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '문의 삭제 중 오류가 발생했습니다.';
    console.error('멤버 문의 예외 삭제 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/** 전역 목록은 제공하지 않음 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        '멤버 문의 전역 목록은 제공하지 않습니다. 사유와 함께 POST(단건 조회) 또는 DELETE(예외 삭제)를 사용하세요.',
    },
    { status: 405 }
  );
}
