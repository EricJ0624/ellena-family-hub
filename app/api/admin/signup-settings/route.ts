import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireSystemAdmin } from '@/lib/api-guards';
import { getAuditRequestMeta, writeAdminAuditLog } from '@/lib/admin-audit';
import { loadSignupAvailability } from '@/lib/signup-settings-query';
import { parseSignupMaxUsers } from '@/lib/signup-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const adminCheck = await requireSystemAdmin(authResult.user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const data = await loadSignupAvailability();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '가입 설정을 불러오지 못했습니다.';
    console.error('가입 설정 조회 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    const adminCheck = await requireSystemAdmin(user.id);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await request.json().catch(() => ({}));
    if (typeof body.signupEnabled !== 'boolean') {
      return NextResponse.json({ error: '가입 허용 여부가 올바르지 않습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const before = await loadSignupAvailability();

    let nextMax = before.signupMaxUsers;
    if (Object.prototype.hasOwnProperty.call(body, 'signupMaxUsers')) {
      const maxParsed = parseSignupMaxUsers(body.signupMaxUsers);
      if (!maxParsed.ok) {
        return NextResponse.json(
          { error: '최대 가입자 수는 비우거나 1 이상의 정수여야 합니다.' },
          { status: 400 },
        );
      }
      nextMax = maxParsed.value;
    }

    const { data: saved, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          id: 1,
          signup_enabled: body.signupEnabled,
          signup_max_users: nextMax,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'id' },
      )
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!saved?.id) {
      throw new Error('가입 설정을 저장하지 못했습니다.');
    }

    const data = await loadSignupAvailability();
    const meta = getAuditRequestMeta(request);
    await writeAdminAuditLog(supabase, {
      adminId: user.id,
      action: 'UPDATE',
      resourceType: 'system_settings',
      resourceId: 'signup',
      details: {
        before: {
          signupEnabled: before.signupEnabled,
          signupMaxUsers: before.signupMaxUsers,
        },
        after: {
          signupEnabled: data.signupEnabled,
          signupMaxUsers: data.signupMaxUsers,
        },
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '가입 설정 저장에 실패했습니다.';
    console.error('가입 설정 저장 오류:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
