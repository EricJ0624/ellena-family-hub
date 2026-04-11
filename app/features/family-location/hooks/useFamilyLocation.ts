/**
 * 가족 위치(Family Location) 비즈니스 로직 Hook
 */

'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { FamilyLocation, LocationRequest } from '../types';

interface UseFamilyLocationProps {
  supabase: SupabaseClient;
  currentGroupId: string | null;
  userId: string;
  onLocationsChange: (locations: FamilyLocation[]) => void;
  onRequestsChange: (requests: LocationRequest[]) => void;
  currentLocations: FamilyLocation[];
  currentRequests: LocationRequest[];
  realtimeSubscriptionId: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  userNames: Record<string, string>;
}

export function useFamilyLocation({
  supabase,
  currentGroupId,
  userId,
  onLocationsChange,
  onRequestsChange,
  currentLocations,
  currentRequests,
  realtimeSubscriptionId,
  familyRoleByUserId,
  userNames,
}: UseFamilyLocationProps) {
  const locationsSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const requestsSubscriptionRef = useRef<RealtimeChannel | null>(null);

  // 위치 데이터 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    const loadLocations = async () => {
      try {
        // 승인된 위치 요청 가져오기
        const { data: acceptedRequests, error: reqError } = await supabase
          .from('location_requests')
          .select('*')
          .eq('group_id', currentGroupId)
          .eq('status', 'accepted')
          .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`);

        if (reqError) {
          console.error('위치 요청 로드 오류:', reqError);
          return;
        }

        if (!acceptedRequests || acceptedRequests.length === 0) {
          onLocationsChange([]);
          return;
        }

        // 공유할 사용자 ID 목록
        const sharedUserIds = new Set<string>();
        acceptedRequests.forEach((req) => {
          if (req.requester_id === userId) {
            sharedUserIds.add(req.target_user_id);
          }
          if (req.target_user_id === userId) {
            sharedUserIds.add(req.requester_id);
          }
        });

        if (sharedUserIds.size === 0) {
          onLocationsChange([]);
          return;
        }

        // 위치 데이터 가져오기
        const { data: locationsData, error: locError } = await supabase
          .from('user_locations')
          .select('*')
          .eq('group_id', currentGroupId)
          .in('user_id', Array.from(sharedUserIds));

        if (locError) {
          console.error('위치 데이터 로드 오류:', locError);
          return;
        }

        if (!locationsData || locationsData.length === 0) {
          onLocationsChange([]);
          return;
        }

        const formattedLocations: FamilyLocation[] = locationsData.map((loc) => ({
          userId: loc.user_id,
          userName: userNames[loc.user_id] || '사용자',
          address: loc.address || '',
          latitude: loc.latitude,
          longitude: loc.longitude,
          updatedAt: loc.last_updated || loc.updated_at,
          familyRole: familyRoleByUserId[loc.user_id] || null,
        }));

        onLocationsChange(formattedLocations);
      } catch (error) {
        console.error('위치 로드 오류:', error);
      }
    };

    loadLocations();
  }, [currentGroupId, userId, supabase, onLocationsChange, familyRoleByUserId, userNames]);

  // 위치 요청 로드
  useEffect(() => {
    if (!currentGroupId || !userId) return;

    const loadRequests = async () => {
      try {
        const { data: requestsData, error } = await supabase
          .from('location_requests')
          .select('*')
          .eq('group_id', currentGroupId)
          .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`);

        if (error) {
          console.error('위치 요청 로드 오류:', error);
          return;
        }

        if (!requestsData) {
          onRequestsChange([]);
          return;
        }

        const formattedRequests: LocationRequest[] = requestsData.map((req) => ({
          id: req.id,
          requester_id: req.requester_id,
          target_user_id: req.target_user_id,
          status: req.status,
          created_at: req.created_at,
          updated_at: req.updated_at,
        }));

        onRequestsChange(formattedRequests);
      } catch (error) {
        console.error('위치 요청 로드 오류:', error);
      }
    };

    loadRequests();
  }, [currentGroupId, userId, supabase, onRequestsChange]);

  // 위치 Realtime 구독
  useEffect(() => {
    if (!currentGroupId) return;

    if (locationsSubscriptionRef.current) {
      supabase.removeChannel(locationsSubscriptionRef.current);
      locationsSubscriptionRef.current = null;
    }

    console.log('📍 위치 subscription 설정 중...');
    const locationsSubscription = supabase
      .channel(`user_locations_changes:${currentGroupId}:${realtimeSubscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedLoc = payload.old;
          if (!deletedLoc?.user_id) return;

          onLocationsChange(currentLocations.filter((loc) => loc.userId !== deletedLoc.user_id));
          return;
        }

        if (ev === 'UPDATE' || ev === 'INSERT') {
          const newLoc = payload.new;
          if (!newLoc || !newLoc.user_id) return;
          if (newLoc.group_id !== currentGroupId) return;

          const formattedLoc: FamilyLocation = {
            userId: newLoc.user_id,
            userName: userNames[newLoc.user_id] || '사용자',
            address: newLoc.address || '',
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
            updatedAt: newLoc.last_updated || newLoc.updated_at,
            familyRole: familyRoleByUserId[newLoc.user_id] || null,
          };

          const existingIndex = currentLocations.findIndex((loc) => loc.userId === newLoc.user_id);
          if (existingIndex >= 0) {
            const updated = [...currentLocations];
            updated[existingIndex] = formattedLoc;
            onLocationsChange(updated);
          } else {
            onLocationsChange([...currentLocations, formattedLoc]);
          }
        }
      })
      .subscribe((status, err) => {
        console.log('📍 Realtime 위치 subscription 상태:', status);
        if (err) {
          console.error('❌ Realtime 위치 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 위치 subscription 연결 성공');
          locationsSubscriptionRef.current = locationsSubscription;
        }
      });

    return () => {
      if (locationsSubscriptionRef.current) {
        supabase.removeChannel(locationsSubscriptionRef.current);
        locationsSubscriptionRef.current = null;
      }
    };
  }, [currentGroupId, supabase, realtimeSubscriptionId, onLocationsChange, currentLocations, familyRoleByUserId, userNames]);

  // 위치 요청 Realtime 구독
  useEffect(() => {
    if (!currentGroupId) return;

    if (requestsSubscriptionRef.current) {
      supabase.removeChannel(requestsSubscriptionRef.current);
      requestsSubscriptionRef.current = null;
    }

    console.log('📍 위치 요청 subscription 설정 중...');
    const requestsSubscription = supabase
      .channel(`location_requests_changes:${currentGroupId}:${realtimeSubscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_requests' }, (payload: any) => {
        const ev = payload.eventType ?? (payload.old && !payload.new ? 'DELETE' : payload.new ? 'UPDATE' : 'INSERT');

        if (ev === 'DELETE') {
          const deletedReq = payload.old;
          if (!deletedReq?.id) return;

          onRequestsChange(currentRequests.filter((req) => req.id !== deletedReq.id));
          return;
        }

        if (ev === 'UPDATE' || ev === 'INSERT') {
          const newReq = payload.new;
          if (!newReq || !newReq.id) return;
          if (newReq.group_id !== currentGroupId) return;

          // 자신과 관련된 요청만
          if (newReq.requester_id !== userId && newReq.target_user_id !== userId) return;

          const formattedReq: LocationRequest = {
            id: newReq.id,
            requester_id: newReq.requester_id,
            target_user_id: newReq.target_user_id,
            status: newReq.status,
            created_at: newReq.created_at,
            updated_at: newReq.updated_at,
          };

          const existingIndex = currentRequests.findIndex((req) => req.id === newReq.id);
          if (existingIndex >= 0) {
            const updated = [...currentRequests];
            updated[existingIndex] = formattedReq;
            onRequestsChange(updated);
          } else {
            onRequestsChange([...currentRequests, formattedReq]);
          }
        }
      })
      .subscribe((status, err) => {
        console.log('📍 Realtime 위치 요청 subscription 상태:', status);
        if (err) {
          console.error('❌ Realtime 위치 요청 subscription 오류:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime 위치 요청 subscription 연결 성공');
          requestsSubscriptionRef.current = requestsSubscription;
        }
      });

    return () => {
      if (requestsSubscriptionRef.current) {
        supabase.removeChannel(requestsSubscriptionRef.current);
        requestsSubscriptionRef.current = null;
      }
    };
  }, [currentGroupId, userId, supabase, realtimeSubscriptionId, onRequestsChange, currentRequests]);

  return {};
}
