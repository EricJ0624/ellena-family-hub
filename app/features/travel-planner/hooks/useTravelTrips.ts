/**
 * Travel Trips 데이터 로딩 훅
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

  const loadTrips = useCallback(async () => {
    if (!isAuthenticated || !currentGroupId) {
      setTrips([]);
      return;
    }
    
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setTrips([]);
        return;
      }
      
      const response = await fetch(`/api/v1/travel/trips?groupId=${currentGroupId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || errorMessage);
      
      setTrips(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Failed to load travel trips:', error);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentGroupId, errorMessage]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return { trips, loading, reload: loadTrips };
}
