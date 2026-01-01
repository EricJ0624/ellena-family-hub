// Web Push 토큰 등록/업데이트 API (Supabase 사용)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Web Push 토큰 등록 또는 업데이트
export async function POST(request: NextRequest) {
  try {
    const { userId, token, deviceInfo } = await request.json();

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'userId와 token이 필요합니다.' },
        { status: 400 }
      );
    }

    // Service role key를 사용하여 RLS 우회 (서버 사이드 검증)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 기존 토큰 확인
    const { data: existingToken, error: checkError } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .single();

    if (existingToken) {
      // 기존 토큰 업데이트 (활성화 및 업데이트 시간 갱신)
      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
          device_info: deviceInfo || null
        })
        .eq('id', existingToken.id);

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

    // 새 토큰 등록
    const { error: insertError } = await supabase
      .from('push_tokens')
      .insert({
        user_id: userId,
        token: token,
        is_active: true,
        device_info: deviceInfo || null
      });

    if (insertError) {
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
  } catch (error: any) {
    console.error('Push 토큰 등록 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// Push 토큰 삭제 (로그아웃 시)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'userId와 token이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 토큰 비활성화
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

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
  } catch (error: any) {
    console.error('Push 토큰 삭제 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

