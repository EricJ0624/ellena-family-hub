/**
 * Foreground GPS field recorder (PWA-ready: background hook is a no-op for now).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatLocalDayDate, formatLocalHm } from '@/lib/modules/travel-planner/field-match';

export type FieldGeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recorded_at: string;
};

type AuthHeaders = Record<string, string>;

type Options = {
  groupId: string | null;
  tripId: string | null;
  getAuthHeaders: () => Promise<AuthHeaders>;
  /** Called after successful check-in / route complete so UI can reload itineraries */
  onSaved?: () => void;
  /** If tripId is null (widget, no trips yet), create a trip first */
  ensureTripId?: () => Promise<string>;
};

export type FieldAttachChoice = {
  attachMode: 'create' | 'attach';
  itineraryId?: string | null;
  /** Override trip for this action (widget: pick existing / newly created trip) */
  tripId?: string | null;
};

const STORAGE_KEY = 'travel_field_active_track_v1';
const FLUSH_EVERY_MS = 10000;
const MIN_MOVE_M = 5;

function haversineM(a: FieldGeoPoint, b: FieldGeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Reserved for PWA background sync — web MVP returns false. */
export function supportsBackgroundFieldRecording(): boolean {
  return false;
}

function readStoredTrack(): { trackId: string; tripId: string; groupId: string; startDay: string; startHm: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      trackId?: string;
      tripId?: string;
      groupId?: string;
      startDay?: string;
      startHm?: string;
    };
    if (!parsed.trackId || !parsed.tripId || !parsed.groupId) return null;
    return {
      trackId: parsed.trackId,
      tripId: parsed.tripId,
      groupId: parsed.groupId,
      startDay: parsed.startDay || formatLocalDayDate(),
      startHm: parsed.startHm || formatLocalHm(),
    };
  } catch {
    return null;
  }
}

function writeStoredTrack(v: {
  trackId: string;
  tripId: string;
  groupId: string;
  startDay: string;
  startHm: string;
} | null) {
  if (typeof window === 'undefined') return;
  if (!v) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

async function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 기기에서 위치를 사용할 수 없습니다.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
    });
  });
}

export function useTravelFieldRecorder({
  groupId,
  tripId,
  getAuthHeaders,
  onSaved,
  ensureTripId,
}: Options) {
  const [recording, setRecording] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<FieldGeoPoint[]>([]);
  const lastKeptRef = useRef<FieldGeoPoint | null>(null);
  const startMetaRef = useRef<{ day: string; hm: string } | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const ensureTripIdRef = useRef(ensureTripId);
  ensureTripIdRef.current = ensureTripId;

  const resolveTripId = useCallback(
    async (override?: string | null): Promise<string> => {
      if (override && String(override).trim()) return String(override).trim();
      if (tripId) return tripId;
      if (ensureTripIdRef.current) return ensureTripIdRef.current();
      throw new Error('여행을 먼저 추가해 주세요.');
    },
    [tripId],
  );

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushPoints = useCallback(
    async (id: string, gid: string) => {
      const batch = bufferRef.current.splice(0, bufferRef.current.length);
      if (batch.length === 0) return;
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/v1/travel/field-tracks/${id}/points`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: gid, points: batch }),
        });
      } catch {
        // re-queue on failure
        bufferRef.current = [...batch, ...bufferRef.current];
      }
    },
    [getAuthHeaders],
  );

  const startWatch = useCallback(
    (id: string, gid: string) => {
      clearWatch();
      if (!navigator.geolocation) return;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const next: FieldGeoPoint = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            recorded_at: new Date().toISOString(),
          };
          const prev = lastKeptRef.current;
          if (prev && haversineM(prev, next) < MIN_MOVE_M) return;
          lastKeptRef.current = next;
          bufferRef.current.push(next);
        },
        () => {
          /* keep recording; user can still stop */
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
      );

      flushTimerRef.current = setInterval(() => {
        void flushPoints(id, gid);
      }, FLUSH_EVERY_MS);
    },
    [clearWatch, flushPoints],
  );

  // Restore active track after refresh
  useEffect(() => {
    if (!groupId || !tripId) return;
    const stored = readStoredTrack();
    if (!stored || stored.groupId !== groupId || stored.tripId !== tripId) return;

    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/v1/travel/trips/${tripId}/field-tracks?groupId=${encodeURIComponent(groupId)}`,
          { headers },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (json?.data?.id && json.data.status === 'recording') {
          setTrackId(json.data.id);
          setRecording(true);
          startMetaRef.current = {
            day: stored.startDay,
            hm: stored.startHm,
          };
          startWatch(json.data.id, groupId);
        } else {
          writeStoredTrack(null);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, tripId, getAuthHeaders, startWatch]);

  useEffect(() => () => clearWatch(), [clearWatch]);

  const checkInHere = useCallback(async (choice: FieldAttachChoice = { attachMode: 'create' }) => {
    if (!groupId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const resolvedTripId = await resolveTripId(choice.tripId);
      const pos = await getPosition();
      const headers = await getAuthHeaders();
      const day_date = formatLocalDayDate();
      const time_hm = formatLocalHm();
      const res = await fetch(`/api/v1/travel/trips/${resolvedTripId}/field-checkin`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          day_date,
          time_hm,
          attach_mode: choice.attachMode,
          itinerary_id: choice.itineraryId ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '위치 저장에 실패했습니다.');
      setMessage(json.data?.created ? '새 일정으로 위치를 저장했습니다.' : '선택한 일정에 위치를 붙였습니다.');
      onSavedRef.current?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '위치 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }, [groupId, busy, getAuthHeaders, resolveTripId]);

  const startRoute = useCallback(async (tripIdOverride?: string | null) => {
    if (!groupId || busy || recording) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const resolvedTripId = await resolveTripId(tripIdOverride);
      const pos = await getPosition();
      const day = formatLocalDayDate();
      const hm = formatLocalHm();
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/travel/trips/${resolvedTripId}/field-tracks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          day_date: day,
          start_time: hm,
          start_lat: pos.coords.latitude,
          start_lng: pos.coords.longitude,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && json?.data?.trackId) {
          setTrackId(json.data.trackId);
          setRecording(true);
          startMetaRef.current = { day, hm };
          writeStoredTrack({
            trackId: json.data.trackId,
            tripId: resolvedTripId,
            groupId,
            startDay: day,
            startHm: hm,
          });
          startWatch(json.data.trackId, groupId);
          setMessage('이전 경로 기록을 이어서 진행합니다.');
          return;
        }
        throw new Error(json.error || '경로 시작에 실패했습니다.');
      }
      const id = json.data?.id as string;
      setTrackId(id);
      setRecording(true);
      startMetaRef.current = { day, hm };
      writeStoredTrack({ trackId: id, tripId: resolvedTripId, groupId, startDay: day, startHm: hm });
      bufferRef.current = [
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          recorded_at: new Date().toISOString(),
        },
      ];
      lastKeptRef.current = bufferRef.current[0];
      startWatch(id, groupId);
      void flushPoints(id, groupId);
      setMessage('경로 기록을 시작했습니다.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '경로 시작에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }, [groupId, busy, recording, getAuthHeaders, startWatch, resolveTripId, flushPoints]);

  const stopRoute = useCallback(async (choice: FieldAttachChoice = { attachMode: 'create' }) => {
    if (!groupId || !trackId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await flushPoints(trackId, groupId);
      let endLat: number | null = null;
      let endLng: number | null = null;
      try {
        const pos = await getPosition();
        endLat = pos.coords.latitude;
        endLng = pos.coords.longitude;
      } catch {
        /* use last buffered / server points */
      }
      const meta = startMetaRef.current || {
        day: formatLocalDayDate(),
        hm: formatLocalHm(),
      };
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/v1/travel/field-tracks/${trackId}/complete`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          day_date: meta.day,
          start_time: meta.hm,
          end_time: formatLocalHm(),
          end_lat: endLat,
          end_lng: endLng,
          attach_mode: choice.attachMode,
          itinerary_id: choice.itineraryId ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '경로 저장에 실패했습니다.');
      clearWatch();
      setRecording(false);
      setTrackId(null);
      writeStoredTrack(null);
      startMetaRef.current = null;
      bufferRef.current = [];
      lastKeptRef.current = null;
      setMessage(json.data?.created ? '새 일정으로 경로를 저장했습니다.' : '선택한 일정에 경로를 붙였습니다.');
      onSavedRef.current?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '경로 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }, [groupId, trackId, busy, flushPoints, getAuthHeaders, clearWatch]);

  return {
    recording,
    busy,
    message,
    error,
    checkInHere,
    startRoute,
    stopRoute,
    clearFeedback: () => {
      setMessage(null);
      setError(null);
    },
  };
}
