import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/api-helpers';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const PROFILE_COLUMNS =
  'id, group_id, created_by, name, birth_date, gender, avatar_url, country_code, notes, created_at, updated_at';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
    if (!groupId) {
      return NextResponse.json({ error: 'groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_profiles')
      .select(PROFILE_COLUMNS)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('[GET baby-growth/profiles]', error);
      return NextResponse.json({ error: '프로필을 불러오지 못했습니다.' }, { status: 500 });
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
    const { groupId, name, birth_date, gender, avatar_url, country_code, notes } = body ?? {};

    if (!groupId || !name?.trim() || !birth_date) {
      return NextResponse.json({ error: 'groupId, name, birth_date는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_profiles')
      .insert({
        group_id: groupId,
        created_by: user.id,
        name: name.trim(),
        birth_date,
        gender: gender ?? null,
        avatar_url: avatar_url ?? null,
        country_code: country_code ?? 'KR',
        notes: notes ?? null,
      })
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      console.error('[POST baby-growth/profiles]', error);
      return NextResponse.json({ error: '프로필 저장에 실패했습니다.' }, { status: 500 });
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
    const { profileId, groupId, ...patch } = body ?? {};

    if (!profileId || !groupId) {
      return NextResponse.json({ error: 'profileId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('baby_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', profileId)
      .eq('group_id', groupId)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      console.error('[PATCH baby-growth/profiles]', error);
      return NextResponse.json({ error: '프로필 수정에 실패했습니다.' }, { status: 500 });
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

    const profileId = request.nextUrl.searchParams.get('profileId')?.trim() ?? '';
    const groupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';

    if (!profileId || !groupId) {
      return NextResponse.json({ error: 'profileId, groupId는 필수입니다.' }, { status: 400 });
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('baby_profiles')
      .delete()
      .eq('id', profileId)
      .eq('group_id', groupId);

    if (error) {
      console.error('[DELETE baby-growth/profiles]', error);
      return NextResponse.json({ error: '프로필 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '서버 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
