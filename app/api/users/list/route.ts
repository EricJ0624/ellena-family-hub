// 그룹 멤버 사용자 목록 조회 API (현재 그룹 스코프만)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser, requireGroupMember } from '@/lib/api-guards';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('필수 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
}

const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_SERVICE_KEY: string = supabaseServiceKey;

type ProfileRow = { id: string; email: string; nickname: string | null };

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get('currentUserId');
    const groupId = searchParams.get('groupId');

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'currentUserId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (currentUserId !== user.id) {
      return NextResponse.json(
        { error: '요청자 정보가 올바르지 않습니다.' },
        { status: 403 }
      );
    }

    const memberCheck = await requireGroupMember(user.id, groupId);
    if (memberCheck instanceof NextResponse) return memberCheck;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (groupError || !groupRow) {
      return NextResponse.json(
        { error: '그룹을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('group_id', groupId);

    if (membershipsError) {
      console.error('그룹 멤버십 조회 오류:', membershipsError);
      return NextResponse.json(
        { error: '그룹 멤버 목록 조회에 실패했습니다.', details: membershipsError.message },
        { status: 500 }
      );
    }

    const allowedIds = new Set<string>();
    if (groupRow.owner_id) allowedIds.add(groupRow.owner_id);
    memberships?.forEach((m: { user_id: string }) => allowedIds.add(m.user_id));
    allowedIds.delete(user.id);

    const memberIdList = Array.from(allowedIds);
    if (memberIdList.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    let { data, error } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .in('id', memberIdList);

    if (error) {
      console.error('profiles 조회 오류:', error);
      return NextResponse.json(
        { error: '사용자 목록 조회에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    let resultData: ProfileRow[] = data || [];
    const foundIds = new Set(resultData.map((p) => p.id));
    const missingIds = memberIdList.filter((id) => !foundIds.has(id));

    // 그룹 멤버 중 profiles 누락분만 보강 (전역 listUsers 금지)
    if (missingIds.length > 0) {
      const usersToSync: ProfileRow[] = [];
      for (const missingId of missingIds) {
        try {
          const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(missingId);
          if (authErr || !authUser?.user) {
            console.warn('auth.users 단건 조회 실패:', missingId, authErr?.message);
            continue;
          }
          const u = authUser.user;
          usersToSync.push({
            id: u.id,
            email: u.email || '',
            nickname: (u.user_metadata?.nickname as string | undefined) || u.email?.split('@')[0] || '',
          });
        } catch (authErr: unknown) {
          console.warn('auth.users 단건 조회 중 오류:', missingId, authErr);
        }
      }

      if (usersToSync.length > 0) {
        const { error: syncError } = await supabase
          .from('profiles')
          .upsert(usersToSync, { onConflict: 'id' });

        if (syncError) {
          console.error('profiles 부분 동기화 오류:', syncError);
        } else {
          resultData = [...resultData, ...usersToSync];
        }
      }
    }

    const sortedData = resultData.sort((a, b) => {
      const nameA = a.nickname || a.email || '';
      const nameB = b.nickname || b.email || '';
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ success: true, data: sortedData }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('사용자 목록 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}
