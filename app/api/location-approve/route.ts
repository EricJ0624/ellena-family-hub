import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

// 위치 요청 승인/거부/취소 API
export async function POST(request: NextRequest) {
  try {
    const { requestId, userId, action, silent } = await request.json();

    if (!requestId || !userId || !action) {
      return NextResponse.json(
        { error: 'requestId, userId, action이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!['accept', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'action은 accept, reject, cancel 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 요청 정보 조회
    const { data: locationRequest, error: fetchError } = await supabase
      .from('location_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !locationRequest) {
      return NextResponse.json(
        { error: '위치 요청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인
    if (action === 'cancel') {
      // 취소 권한: 
      // - pending 상태: 요청자(requester_id)만 취소 가능
      // - accepted 상태: 요청자(requester_id)와 대상자(target_id) 모두 취소 가능
      const isRequester = locationRequest.requester_id === userId;
      const isTarget = locationRequest.target_id === userId;
      const isAccepted = locationRequest.status === 'accepted';
      
      if (!isRequester && !(isAccepted && isTarget)) {
        return NextResponse.json(
          { error: '취소 권한이 없습니다.' },
          { status: 403 }
        );
      }
    } else {
      // 승인/거부는 대상자만 가능
      if (locationRequest.target_id !== userId) {
        return NextResponse.json(
          { error: '승인/거부 권한이 없습니다.' },
          { status: 403 }
        );
      }
    }

    // 상태 확인 (silent 모드가 아닐 때만 체크)
    if (!silent && locationRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '이미 처리된 요청입니다.' },
        { status: 400 }
      );
    }

    // 만료 확인 (cancel 액션은 만료된 요청도 취소 가능, accept/reject는 만료된 요청 불가)
    if (!silent && action !== 'cancel' && new Date(locationRequest.expires_at) < new Date()) {
      return NextResponse.json(
        { error: '만료된 요청입니다.' },
        { status: 400 }
      );
    }

    // silent 모드이고 이미 cancelled/rejected 상태면 성공으로 처리
    if (silent && (locationRequest.status === 'cancelled' || locationRequest.status === 'rejected')) {
      return NextResponse.json({ success: true, data: locationRequest }, { status: 200 });
    }

    // 상태 업데이트
    let newStatus: string;
    if (action === 'accept') {
      newStatus = 'accepted';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      newStatus = 'cancelled';
    }

    const { data, error } = await supabase
      .from('location_requests')
      .update({ status: newStatus })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('위치 요청 상태 업데이트 오류:', error);
      return NextResponse.json(
        { error: '요청 상태 업데이트에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    console.error('위치 요청 승인 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

