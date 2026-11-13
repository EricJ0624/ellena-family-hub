import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const LOG_COLUMNS =
  'id, baby_id, group_id, log_type, logged_at, ' +
  'feeding_type, feeding_amount_ml, feeding_duration_min, ' +
  'breast_left_min, breast_right_min, solid_ingredients, allergy_reaction, ' +
  'sleep_end_at, ' +
  'diaper_type, diaper_color, diaper_consistency, ' +
  'temperature_celsius, ' +
  'medication_name, medication_dose_mg, ' +
  'activity_type, activity_duration_min, pump_amount_ml, ' +
  'notes, created_by, created_at';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
    const babyId = request.nextUrl.searchParams.get('babyId')?.trim() ?? '';
    const limit = Math.min(200, Number(request.nextUrl.searchParams.get('limit') ?? '50'));

    if (!groupId || !babyId) {
      return NextResponse.json({ error: 'groupId, babyId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_daily_logs')
      .select(LOG_COLUMNS)
      .eq('baby_id', babyId)
      .eq('group_id', groupId)
      .order('logged_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[GET baby-growth/logs]', error);
      return NextResponse.json({ error: '로그를 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { groupId, babyId, log_type, logged_at, ...rest } = body ?? {};

    if (!groupId || !babyId || !log_type) {
      return NextResponse.json({ error: 'groupId, babyId, log_type은 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_daily_logs')
      .insert({
        group_id: groupId,
        baby_id: babyId,
        log_type,
        logged_at: logged_at ?? new Date().toISOString(),
        created_by: user.id,
        ...rest,
      })
      .select(LOG_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/logs]', error);
      return NextResponse.json({ error: '로그 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { logId, groupId, ...patch } = body ?? {};

    if (!logId || !groupId) {
      return NextResponse.json({ error: 'logId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_daily_logs')
      .update(patch)
      .eq('id', logId)
      .eq('group_id', groupId)
      .select(LOG_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH baby-growth/logs]', error);
      return NextResponse.json({ error: '로그 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const logId = request.nextUrl.searchParams.get('logId')?.trim() ?? '';
    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';

    if (!logId || !groupId) {
      return NextResponse.json({ error: 'logId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('baby_daily_logs')
      .delete()
      .eq('id', logId)
      .eq('group_id', groupId);

    if (error) {
      console.error('[DELETE baby-growth/logs]', error);
      return NextResponse.json({ error: '로그 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
