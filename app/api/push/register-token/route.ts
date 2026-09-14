// Web Push 토큰 등록/업데이트 API (Supabase 사용)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthUser } from '@/lib/api-guards';
import { CURRENT_APP_ID } from '@/lib/apps';

// 환경 변수 안전하게 가져오기 (Non-null assertion 제거)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 환경 변수 검증 (런타임 에러 방지)
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('필수 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.');
}

// TypeScript 타입 안전성: 환경 변수 체크 후에는 undefined가 아님을 보장
const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_SERVICE_KEY: string = supabaseServiceKey;

// Web Push 토큰 등록 또는 업데이트
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { userId, token, deviceInfo } = await request.json();

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'userId와 token이 필요합니다.' },
        { status: 400 }
      );
    }

    if (userId !== user.id) {
      return NextResponse.json(
        { error: '요청자 정보가 올바르지 않습니다.' },
        { status: 403 }
      );
    }

    // Service role key를 사용하여 RLS 우회 (서버 사이드 검증)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1) 현재 앱으로 이미 등록된 토큰
    const { data: existingForApp, error: checkError } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .eq('app_id', CURRENT_APP_ID)
      .maybeSingle();

    if (checkError) {
      console.error('Push 토큰 조회 오류:', checkError);
    }

    // 2) 레거시(app_id NULL) 동일 토큰 → 현재 앱으로 귀속
    let existingLegacy: { id: string } | null = null;
    if (!existingForApp) {
      const { data } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('token', token)
        .is('app_id', null)
        .maybeSingle();
      existingLegacy = data;
    }

    const existingId = existingForApp?.id || existingLegacy?.id || null;

    if (existingId) {
      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
          device_info: deviceInfo || null,
          app_id: CURRENT_APP_ID,
        })
        .eq('id', existingId);

      if (updateError) {
        console.error('Push 토큰 업데이트 오류:', updateError);
        return NextResponse.json(
          { error: '토큰 업데이트에 실패했습니다.', details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Push 토큰이 업데이트되었습니다.'
      });
    }

    // 3) 새 행 등록 (같은 endpoint라도 앱이 다르면 별도 행)
    const { error: insertError } = await supabase
      .from('push_tokens')
      .insert({
        user_id: userId,
        token: token,
        is_active: true,
        device_info: deviceInfo || null,
        app_id: CURRENT_APP_ID,
      });

    if (insertError) {
      // 동시 요청 등으로 유니크 충돌 시 재조회 후 업데이트
      if (String(insertError.message || '').includes('duplicate key') || insertError.code === '23505') {
        const { data: raced } = await supabase
          .from('push_tokens')
          .select('id')
          .eq('user_id', userId)
          .eq('token', token)
          .eq('app_id', CURRENT_APP_ID)
          .maybeSingle();
        if (raced?.id) {
          await supabase
            .from('push_tokens')
            .update({
              is_active: true,
              updated_at: new Date().toISOString(),
              device_info: deviceInfo || null,
            })
            .eq('id', raced.id);
          return NextResponse.json({
            success: true,
            message: 'Push 토큰이 업데이트되었습니다.',
          });
        }
      }
      console.error('Push 토큰 등록 오류:', insertError);
      return NextResponse.json(
        { error: '토큰 등록에 실패했습니다.', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push 토큰이 등록되었습니다.'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Push 토큰 등록 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

// Push 토큰 삭제 (로그아웃 시)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthUser(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'userId와 token이 필요합니다.' },
        { status: 400 }
      );
    }

    if (userId !== user.id) {
      return NextResponse.json(
        { error: '요청자 정보가 올바르지 않습니다.' },
        { status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 토큰 비활성화 (현재 앱)
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token)
      .eq('app_id', CURRENT_APP_ID);

    if (error) {
      console.error('Push 토큰 삭제 오류:', error);
      return NextResponse.json(
        { error: '토큰 삭제에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push 토큰이 삭제되었습니다.'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Push 토큰 삭제 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}

