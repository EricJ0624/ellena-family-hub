import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const VACCINE_COLUMNS =
  'id, baby_id, group_id, vaccine_key, scheduled_at, administered_at, notes, created_by, created_at';

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
      .from('baby_vaccinations')
      .select(VACCINE_COLUMNS)
      .eq('baby_id', babyId)
      .eq('group_id', groupId)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('[GET baby-growth/vaccinations]', error);
      return NextResponse.json({ error: '예방접종 기록을 불러오지 못했습니다.' }, { status: 500 });
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
    const { groupId, babyId, vaccine_key, scheduled_at, administered_at, notes } = body ?? {};

    if (!groupId || !babyId || !vaccine_key) {
      return NextResponse.json(
        { error: 'groupId, babyId, vaccine_key는 필수입니다.' },
        { status: 400 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_vaccinations')
      .upsert(
        {
          group_id: groupId,
          baby_id: babyId,
          vaccine_key,
          scheduled_at: scheduled_at ?? null,
          administered_at: administered_at ?? null,
          notes: notes ?? null,
          created_by: user.id,
        },
        { onConflict: 'baby_id,vaccine_key' }
      )
      .select(VACCINE_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/vaccinations]', error);
      return NextResponse.json({ error: '예방접종 기록 저장에 실패했습니다.' }, { status: 500 });
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
    const { vaccinationId, groupId, ...patch } = body ?? {};

    if (!vaccinationId || !groupId) {
      return NextResponse.json({ error: 'vaccinationId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_vaccinations')
      .update(patch)
      .eq('id', vaccinationId)
      .eq('group_id', groupId)
      .select(VACCINE_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH baby-growth/vaccinations]', error);
      return NextResponse.json({ error: '예방접종 기록 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
