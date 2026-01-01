// 모든 사용자 목록 조회 API (로그인 여부와 관계없이 profiles 테이블의 모든 사용자)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get('currentUserId');

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'currentUserId가 필요합니다.' },
        { status: 400 }
      );
    }

    // Service role key를 사용하여 RLS 우회 (서버 사이드에서 모든 사용자 조회)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. 먼저 profiles 테이블에서 조회 시도
    let { data, error } = await supabase
      .from('profiles')
      .select('id, email, nickname')
      .neq('id', currentUserId);

    // 2. profiles 테이블이 비어있거나 에러가 발생하면 auth.users에서 데이터를 가져와서 profiles에 동기화
    if (error || !data || data.length === 0) {
      console.log('profiles 테이블이 비어있거나 에러 발생, auth.users에서 동기화 시작:', error?.message || '데이터 없음');
      
      try {
        // auth.users에서 모든 사용자 조회 (Service Role Key 사용)
        const adminResult = await supabase.auth.admin.listUsers();
        
        if (adminResult.error) {
          console.error('auth.users 조회 오류:', adminResult.error);
          return NextResponse.json(
            { error: '사용자 목록 조회에 실패했습니다.', details: adminResult.error.message },
            { status: 500 }
          );
        }

        // auth.users 데이터를 profiles 테이블에 동기화
        const usersToSync = (adminResult.data?.users || [])
          .map((user: any) => ({
            id: user.id,
            email: user.email || '',
            nickname: user.user_metadata?.nickname || user.email?.split('@')[0] || ''
          }));

        if (usersToSync.length > 0) {
          // profiles 테이블에 일괄 삽입/업데이트
          const { error: syncError } = await supabase
            .from('profiles')
            .upsert(usersToSync, { onConflict: 'id' });

          if (syncError) {
            console.error('profiles 테이블 동기화 오류:', syncError);
          } else {
            console.log(`profiles 테이블 동기화 성공: ${usersToSync.length}명`);
          }
        }

        // 동기화 후 다시 조회
        const { data: syncedData, error: syncedError } = await supabase
          .from('profiles')
          .select('id, email, nickname')
          .neq('id', currentUserId);

        if (syncedError) {
          console.error('동기화 후 조회 오류:', syncedError);
          data = [];
        } else {
          data = syncedData || [];
          console.log(`동기화 후 profiles 테이블에서 조회 성공: ${data.length}명 (본인 제외: ${currentUserId})`);
        }
      } catch (authErr: any) {
        console.error('auth.users 동기화 중 오류:', authErr);
        return NextResponse.json(
          { error: '사용자 목록 동기화에 실패했습니다.', details: authErr.message },
          { status: 500 }
        );
      }
    } else {
      console.log(`profiles 테이블에서 조회 성공: ${data.length}명 (본인 제외: ${currentUserId})`);
    }

    // 닉네임 기준으로 정렬 (닉네임이 있으면 우선, 없으면 이메일)
    const sortedData = (data || []).sort((a, b) => {
      const nameA = a.nickname || a.email || '';
      const nameB = b.nickname || b.email || '';
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ success: true, data: sortedData }, { status: 200 });
  } catch (error: any) {
    console.error('사용자 목록 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

