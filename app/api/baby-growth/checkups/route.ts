import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const CHECKUP_COLUMNS =
  'id, baby_id, group_id, checkup_type, checkup_date, weight_kg, height_cm, head_cm, vision_ok, hearing_ok, dev_notes, doctor_notes, created_by, created_at';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
    const babyId = request.nextUrl.searchParams.get('babyId')?.trim() ?? '';

    if (!groupId || !babyId) {
      return NextResponse.json({ error: 'groupId, babyId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_checkups')
      .select(CHECKUP_COLUMNS)
      .eq('baby_id', babyId)
      .eq('group_id', groupId)
      .order('checkup_date', { ascending: true });

    if (error) {
      console.error('[GET baby-growth/checkups]', error);
      return NextResponse.json({ error: '검진 기록을 불러오지 못했습니다.' }, { status: 500 });
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
    const { group_id, baby_id, checkup_type, checkup_date, weight_kg, height_cm, head_cm,
            vision_ok, hearing_ok, dev_notes, doctor_notes } = body;

    if (!group_id || !baby_id || !checkup_type || !checkup_date) {
      return NextResponse.json({ error: 'group_id, baby_id, checkup_type, checkup_date는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_checkups')
      .insert({
        baby_id, group_id, checkup_type, checkup_date,
        weight_kg: weight_kg ?? null,
        height_cm: height_cm ?? null,
        head_cm: head_cm ?? null,
        vision_ok: vision_ok ?? null,
        hearing_ok: hearing_ok ?? null,
        dev_notes: dev_notes ?? null,
        doctor_notes: doctor_notes ?? null,
        created_by: user.id,
      })
      .select(CHECKUP_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/checkups]', error);
      return NextResponse.json({ error: '검진 기록 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
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
    const { id, group_id, ...patch } = body;

    if (!id || !group_id) {
      return NextResponse.json({ error: 'id, group_id는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, group_id);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_checkups')
      .update(patch)
      .eq('id', id)
      .select(CHECKUP_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH baby-growth/checkups]', error);
      return NextResponse.json({ error: '검진 기록 수정 실패' }, { status: 500 });
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

    const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';

    if (!id || !groupId) {
      return NextResponse.json({ error: 'id, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('baby_checkups').delete().eq('id', id);

    if (error) {
      console.error('[DELETE baby-growth/checkups]', error);
      return NextResponse.json({ error: '검진 기록 삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
