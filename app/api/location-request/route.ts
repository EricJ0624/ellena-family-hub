import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 위치 요청 생성 API
export async function POST(request: NextRequest) {
  try {
    const { targetId, requesterId } = await request.json();

    if (!targetId || !requesterId) {
      return NextResponse.json(
        { error: 'targetId와 requesterId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (targetId === requesterId) {
      return NextResponse.json(
        { error: '자기 자신에게 위치 요청을 보낼 수 없습니다.' },
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

    // 이미 pending 요청이 있는지 확인
    const { data: existingRequest, error: checkError } = await supabase
      .from('location_requests')
      .select('id, status')
      .eq('requester_id', requesterId)
      .eq('target_id', targetId)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json(
        { error: '이미 보류 중인 위치 요청이 있습니다.' },
        { status: 409 }
      );
    }

    // 이미 승인된 요청이 있는지 확인
    const { data: acceptedRequest, error: acceptedCheckError } = await supabase
      .from('location_requests')
      .select('id')
      .or(`and(requester_id.eq.${requesterId},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${requesterId})`)
      .eq('status', 'accepted')
      .single();

    if (acceptedRequest) {
      return NextResponse.json(
        { error: '이미 승인된 위치 공유 관계가 있습니다.' },
        { status: 409 }
      );
    }

    // 위치 요청 생성 (1시간 후 만료)
    const { data, error } = await supabase
      .from('location_requests')
      .insert({
        requester_id: requesterId,
        target_id: targetId,
        status: 'pending',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1시간 후 만료
      })
      .select()
      .single();

    if (error) {
      console.error('위치 요청 생성 오류:', error);
      return NextResponse.json(
        { error: '위치 요청 생성에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // 요청자 정보 조회 (푸시 알림용)
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', requesterId)
      .single();

    const requesterName = requesterProfile?.full_name || requesterProfile?.email || '알 수 없음';

    // Web Push 알림 전송 (비동기, 실패해도 요청은 성공으로 처리)
    try {
      const pushResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/push/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetUserId: targetId,
          requesterName: requesterName,
          requestId: data.id
        })
      });

      if (!pushResponse.ok) {
        console.warn('Web Push 알림 전송 실패 (요청은 성공):', await pushResponse.text());
      }
    } catch (pushError) {
      console.warn('Web Push 알림 전송 중 오류 (요청은 성공):', pushError);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('위치 요청 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 위치 요청 목록 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'sent' | 'received' | 'all'

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // profiles 테이블 조인을 위해 별도로 조회
    let query = supabase
      .from('location_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // 타입에 따라 필터링
    if (type === 'sent') {
      query = query.eq('requester_id', userId);
    } else if (type === 'received') {
      query = query.eq('target_id', userId);
    } else {
      // all: 요청자 또는 대상자인 모든 요청
      query = query.or(`requester_id.eq.${userId},target_id.eq.${userId}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('위치 요청 조회 오류:', error);
      return NextResponse.json(
        { error: '위치 요청 조회에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // 사용자 정보 조회 (profiles 테이블 또는 auth.users)
    if (data && data.length > 0) {
      const userIds = new Set<string>();
      data.forEach((req: any) => {
        userIds.add(req.requester_id);
        userIds.add(req.target_id);
      });

      // profiles 테이블에서 사용자 정보 조회
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(userIds));

      const profilesMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      // 요청 데이터에 사용자 정보 추가
      const enrichedData = data.map((req: any) => ({
        ...req,
        requester: profilesMap.get(req.requester_id) || {
          id: req.requester_id,
          email: req.requester_id,
          full_name: null
        },
        target: profilesMap.get(req.target_id) || {
          id: req.target_id,
          email: req.target_id,
          full_name: null
        }
      }));

      return NextResponse.json({ success: true, data: enrichedData }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  } catch (error: any) {
    console.error('위치 요청 조회 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

