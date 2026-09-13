/**
 * Self-contained field record host — keeps GPS/watch state out of dashboard page.tsx
 *
 * widget:
 *   - 0 trips → auto-create trip, then location/route itinerary
 *   - 1+ trips → same picker UI: new trip OR add itinerary to existing trip
 * page:
 *   - 0 itineraries → create itinerary
 *   - 1+ itineraries → picker: create vs attach to existing itinerary
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatLocalDayDate } from '@/lib/modules/travel-planner/field-match';
import { dispatchWidgetConfigsUpdated } from '@/lib/widgets/widget-config-events';
import { TravelFieldRecordBar, type TravelFieldRecordBarLabels } from './TravelFieldRecordBar';
import {
  TravelFieldTargetPicker,
  type FieldTargetOption,
  type FieldTargetPickLabels,
} from './TravelFieldTargetPicker';
import {
  useTravelFieldRecorder,
  type FieldAttachChoice,
} from '../hooks/useTravelFieldRecorder';

export type FieldWidgetTripOption = {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
};

type Props = {
  groupId: string | null;
  tripId: string | null;
  mode: 'widget' | 'page';
  /** Widget: existing trips for picker (empty → auto-create trip) */
  trips?: FieldWidgetTripOption[];
  /** widget UI: circular hero buttons (default = page row) */
  barLayout?: 'default' | 'circles';
  /** Default trip title when creating from widget */
  newTripTitle?: string;
  /** When creating a trip from widget, also enable diary write access */
  enableDiaryOnCreate?: boolean;
  labels: TravelFieldRecordBarLabels;
  pickLabels?: FieldTargetPickLabels;
  enabled?: boolean;
  onSaved?: () => void;
};

const DEFAULT_PICK_PAGE: FieldTargetPickLabels = {
  title: '어디에 저장할까요?',
  create: '새 일정으로 저장',
  attach_hint: '기존 일정에 붙이기',
  cancel: '취소',
};

const DEFAULT_PICK_WIDGET: FieldTargetPickLabels = {
  title: '어디에 저장할까요?',
  create: '새 여행으로 저장',
  attach_hint: '기존 여행에 일정 추가',
  cancel: '취소',
};

export function TravelFieldRecordHost({
  groupId,
  tripId,
  mode,
  trips = [],
  barLayout = 'default',
  newTripTitle = '빠른 여행 기록',
  enableDiaryOnCreate = false,
  labels,
  pickLabels,
  enabled = true,
  onSaved,
}: Props) {
  const resolvedPickLabels =
    pickLabels ?? (mode === 'widget' ? DEFAULT_PICK_WIDGET : DEFAULT_PICK_PAGE);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('auth');
    return { Authorization: `Bearer ${token}` };
  }, []);

  /** Widget: group만 있으면 활성. Page: trip 필수 */
  const canUse =
    mode === 'widget'
      ? Boolean(enabled && groupId)
      : Boolean(enabled && groupId && tripId);

  const [options, setOptions] = useState<FieldTargetOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<'checkin' | 'route_start' | 'route_stop' | null>(
    null,
  );
  const [localTripId, setLocalTripId] = useState<string | null>(null);
  const ensureTripPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (tripId) setLocalTripId(tripId);
  }, [tripId]);

  const effectiveTripId = tripId || localTripId;

  /** Always POST a new trip (widget "새 여행으로 저장") */
  const createFreshTrip = useCallback(async () => {
    if (!groupId) throw new Error('그룹을 선택해 주세요.');
    const headers = await getAuthHeaders();
    const today = formatLocalDayDate();
    const res = await fetch('/api/v1/travel/trips', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        title: newTripTitle,
        start_date: today,
        end_date: today,
        ...(enableDiaryOnCreate ? { diary_enabled: true } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || '여행 생성에 실패했습니다.');
    const id = json.data?.id as string | undefined;
    if (!id) throw new Error('여행 생성에 실패했습니다.');
    if (enableDiaryOnCreate) {
      void fetch('/api/v1/travel/widgets/enable-travel-diary', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      })
        .then((r) => {
          if (r.ok) dispatchWidgetConfigsUpdated();
        })
        .catch(() => undefined);
    }
    setLocalTripId(id);
    onSaved?.();
    return id;
  }, [groupId, getAuthHeaders, onSaved, newTripTitle, enableDiaryOnCreate]);

  /** Only when no trip yet (0 trips / first use) */
  const ensureTripId = useCallback(async () => {
    if (tripId) return tripId;
    if (localTripId) return localTripId;
    if (ensureTripPromiseRef.current) return ensureTripPromiseRef.current;
    const run = createFreshTrip();
    ensureTripPromiseRef.current = run;
    try {
      return await run;
    } finally {
      if (ensureTripPromiseRef.current === run) ensureTripPromiseRef.current = null;
    }
  }, [tripId, localTripId, createFreshTrip]);

  const recorder = useTravelFieldRecorder({
    groupId: canUse ? groupId : null,
    tripId: mode === 'widget' ? null : effectiveTripId,
    getAuthHeaders,
    onSaved,
    ensureTripId: mode === 'widget' ? ensureTripId : undefined,
  });

  const tripsToOptions = useCallback((): FieldTargetOption[] => {
    return trips.map((t) => {
      const start = String(t.start_date || '').slice(0, 10);
      const end = String(t.end_date || '').slice(0, 10);
      const day_date = start && end && end !== start ? `${start} ~ ${end}` : start || '';
      return {
        id: t.id,
        title: t.title || '여행',
        day_date,
        start_time: null,
      };
    });
  }, [trips]);

  const loadItineraryOptions = useCallback(async () => {
    if (!groupId || !effectiveTripId) {
      setOptions([]);
      return [];
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/v1/travel/trips/${effectiveTripId}/itineraries?groupId=${encodeURIComponent(groupId)}`,
        { headers },
      );
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json.data) ? json.data : [];
      const mapped: FieldTargetOption[] = rows
        .filter(
          (r: { field_record_kind?: string | null }) =>
            !r.field_record_kind || !String(r.field_record_kind).trim(),
        )
        .map(
          (r: { id: string; title?: string; day_date?: string; start_time?: string | null }) => ({
            id: r.id,
            title: r.title || '일정',
            day_date: String(r.day_date || '').slice(0, 10),
            start_time: r.start_time ?? null,
          }),
        );
      setOptions(mapped);
      return mapped;
    } catch {
      setOptions([]);
      return [];
    }
  }, [groupId, effectiveTripId, getAuthHeaders]);

  useEffect(() => {
    if (mode === 'page' && canUse) void loadItineraryOptions();
  }, [mode, canUse, loadItineraryOptions]);

  const runPageChoice = (choice: FieldAttachChoice) => {
    setPickerOpen(false);
    const kind = pickerKind;
    setPickerKind(null);
    if (kind === 'checkin') void recorder.checkInHere(choice);
    else if (kind === 'route_stop') void recorder.stopRoute(choice);
  };

  const runWidgetChoice = async (tripIdChoice: string | 'new') => {
    setPickerOpen(false);
    const kind = pickerKind;
    setPickerKind(null);
    try {
      const tid =
        tripIdChoice === 'new' ? await createFreshTrip() : tripIdChoice;
      setLocalTripId(tid);
      if (kind === 'checkin') {
        void recorder.checkInHere({ attachMode: 'create', tripId: tid });
      } else if (kind === 'route_start') {
        void recorder.startRoute(tid);
      }
    } catch (e: unknown) {
      /* createFreshTrip / recorder surfaces errors via recorder.error when possible */
      console.error('widget field pick:', e);
    }
  };

  const handleCheckIn = async () => {
    if (!canUse) return;
    if (mode === 'widget') {
      if (trips.length === 0) {
        void recorder.checkInHere({ attachMode: 'create' });
        return;
      }
      setOptions(tripsToOptions());
      setPickerKind('checkin');
      setPickerOpen(true);
      return;
    }
    const list = await loadItineraryOptions();
    if (list.length === 0) {
      void recorder.checkInHere({ attachMode: 'create' });
      return;
    }
    setPickerKind('checkin');
    setPickerOpen(true);
  };

  const handleToggleRoute = async () => {
    if (!canUse) return;
    if (recorder.recording) {
      if (mode === 'widget') {
        void recorder.stopRoute({ attachMode: 'create' });
        return;
      }
      const list = await loadItineraryOptions();
      if (list.length === 0) {
        void recorder.stopRoute({ attachMode: 'create' });
        return;
      }
      setPickerKind('route_stop');
      setPickerOpen(true);
      return;
    }
    if (mode === 'widget') {
      if (trips.length === 0) {
        void recorder.startRoute();
        return;
      }
      setOptions(tripsToOptions());
      setPickerKind('route_start');
      setPickerOpen(true);
      return;
    }
    void recorder.startRoute();
  };

  return (
    <>
      <TravelFieldRecordBar
        mode={mode}
        layout={barLayout}
        disabled={!canUse}
        busy={recorder.busy}
        recording={recorder.recording}
        message={recorder.message}
        error={recorder.error}
        labels={labels}
        onCheckIn={() => void handleCheckIn()}
        onToggleRoute={() => void handleToggleRoute()}
      />
      <TravelFieldTargetPicker
        open={pickerOpen}
        options={options}
        labels={resolvedPickLabels}
        onCreate={() => {
          if (mode === 'widget') void runWidgetChoice('new');
          else runPageChoice({ attachMode: 'create' });
        }}
        onAttach={(id) => {
          if (mode === 'widget') void runWidgetChoice(id);
          else runPageChoice({ attachMode: 'attach', itineraryId: id });
        }}
        onCancel={() => {
          setPickerOpen(false);
          setPickerKind(null);
        }}
      />
    </>
  );
}
