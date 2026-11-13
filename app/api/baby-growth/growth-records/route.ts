import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const RECORD_COLUMNS =
  'id, baby_id, group_id, measured_at, weight_kg, height_cm, head_cm, notes, created_by, created_at';

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
      .from('baby_growth_records')
      .select(RECORD_COLUMNS)
      .eq('baby_id', babyId)
      .eq('group_id', groupId)
      .order('measured_at', { ascending: true });

    if (error) {
      console.error('[GET baby-growth/growth-records]', error);
      return NextResponse.json({ error: '성장 기록을 불러오지 못했습니다.' }, { status: 500 });
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
    const { groupId, babyId, measured_at, weight_kg, height_cm, head_cm, notes } = body ?? {};

    if (!groupId || !babyId || !measured_at) {
      return NextResponse.json(
        { error: 'groupId, babyId, measured_at은 필수입니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_growth_records')
      .insert({
        group_id: groupId,
        baby_id: babyId,
        measured_at,
        weight_kg: weight_kg ?? null,
        height_cm: height_cm ?? null,
        head_cm: head_cm ?? null,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select(RECORD_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/growth-records]', error);
      return NextResponse.json({ error: '성장 기록 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
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

    const recordId = request.nextUrl.searchParams.get('recordId')?.trim() ?? '';
    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';

    if (!recordId || !groupId) {
      return NextResponse.json({ error: 'recordId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('baby_growth_records')
      .delete()
      .eq('id', recordId)
      .eq('group_id', groupId);

    if (error) {
      console.error('[DELETE baby-growth/growth-records]', error);
      return NextResponse.json({ error: '성장 기록 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
