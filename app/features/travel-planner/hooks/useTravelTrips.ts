/**
 * Travel Trips 데이터 로딩 훅
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { TravelTrip } from '../types';

interface UseTravelTripsProps {
  currentGroupId: string | null;
  isAuthenticated: boolean;
  errorMessage?: string;
}

export function useTravelTrips({ 
  currentGroupId, 
  isAuthenticated,
  errorMessage = 'Failed to load trips'
}: UseTravelTripsProps) {
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [loading, setLoading] = useState(false);
  /**
   * 기존 여행 데이터 유무 추적 — 재조회 시 기존 목록을 보존하기 위해 ref로 관리.
   * 그룹/인증 변경 시 초기화해 새 그룹에서는 로딩 표시가 정상 동작.
   */
  const tripsRef = useRef<TravelTrip[]>([]);

  const loadTrips = useCallback(async () => {
    if (!isAuthenticated || !currentGroupId) {
      setTrips([]);
      tripsRef.current = [];
      return;
    }
    
    try {
      // 기존 데이터가 없을 때만 로딩 스피너 표시 — 재조회 시 기존 목록이 공백이 되는 것 방지
      if (tripsRef.current.length === 0) setLoading(true);

      const session = await waitForSupabaseSession(supabase);
      if (!session?.access_token) {
        // 세션 없으면 기존 데이터 유지 (표시 유지)
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/v1/travel/trips?groupId=${currentGroupId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || errorMessage);
      
      const newTrips = Array.isArray(result.data) ? result.data : [];
      tripsRef.current = newTrips;
      setTrips(newTrips);
    } catch (error) {
      console.error('Failed to load travel trips:', error);
      // 오류 시 기존 데이터 유지 — 재조회 실패로 화면이 공백이 되는 것 방지
      // 첫 로드(기존 데이터 없음)일 때만 빈 배열로 설정
      if (tripsRef.current.length === 0) setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentGroupId, errorMessage]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return { trips, loading, reload: loadTrips };
}
