import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { writeAdminAuditLog, getAuditRequestMeta } from '@/lib/admin-audit';
import { isAdminStepUpError, requireAdminStepUpPassword } from '@/lib/admin-stepup';

function messageFromTransferError(raw: string | null | undefined): string {
  const text = String(raw || '');
  if (text.includes('CANNOT_TRANSFER_TO_SELF')) return '본인을 후임자로 지정할 수 없습니다.';
  if (text.includes('NOT_SYSTEM_ADMIN')) return '시스템 관리자 권한이 필요합니다.';
  if (text.includes('ALREADY_SYSTEM_ADMIN')) return '선택한 사용자는 이미 시스템 관리자입니다.';
  if (text.includes('SUCCESSOR_NOT_FOUND')) return '후임자를 찾을 수 없습니다.';
  if (text.includes('TRANSFER_FAILED') || text.includes('INVALID_USER')) return '권한 이양에 실패했습니다.';
  return '권한 이양에 실패했습니다.';
}

/** 후임자 지정 및 본인 권한 해제. 비밀번호 확인 후 DB 한 트랜잭션으로 이양. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json();
    const { successor_user_id, password } = body as {
      successor_user_id?: string;
      password?: string;
    };

    if (!successor_user_id) {
      return NextResponse.json(
        { error: '후임자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (successor_user_id === user.id) {
      return NextResponse.json(
        { error: '본인을 후임자로 지정할 수 없습니다.' },
        { status: 400 }
      );
    }

    await requireAdminStepUpPassword({
      userId: user.id,
      email: user.email,
      password,
    });

    const supabase = getSupabaseServerClient();
    const { data: successorProfile } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .eq('id', successor_user_id)
      .single();

    if (!successorProfile) {
      return NextResponse.json(
        { error: '후임자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { error: transferError } = await supabase.rpc('transfer_system_admin', {
      p_from_user_id: user.id,
      p_to_user_id: successor_user_id,
    });
    if (transferError) {
      console.error('시스템 관리자 이양 RPC 오류:', transferError);
      return NextResponse.json(
        { error: messageFromTransferError(transferError.message) },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'TRANSFER',
      resourceType: 'system_admin',
      resourceId: successor_user_id,
      targetUserId: successor_user_id,
      details: { predecessor_user_id: user.id },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `${successorProfile.nickname || successorProfile.email}님에게 시스템 관리자 권한을 넘겼습니다.`,
    });
  } catch (error) {
    if (isAdminStepUpError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const errorMessage = error instanceof Error ? error.message : '후임자 지정 중 오류가 발생했습니다.';
    console.error('후임자 지정 오류:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
