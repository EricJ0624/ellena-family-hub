'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelDiaryTranslation } from '@/lib/translations/travel-diary';
import type {
  TravelTrip,
  TravelAccommodation,
  TravelAttraction,
  TravelDining,
  TravelExpense,
  TravelItinerary,
  TravelPlaceFeedback,
  TravelTransport,
} from '@/lib/modules/travel-planner/types';
import { intlLocaleForLang } from '@/lib/language-fonts';
import type { TravelDiaryEntry } from '@/lib/modules/travel-planner/diary-types';
import { buildUnifiedItineraries } from '@/lib/modules/travel-planner/unified-itinerary';
import { buildDiaryTimelineSlots, buildHiddenDiarySlots } from '@/lib/modules/travel-planner/diary-timeline';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';
import { listAttachments, type UploadedAttachment } from '@/lib/feature-attachments-client';
import { DiaryEntryCard } from '@/app/features/travel-diary/components/DiaryEntryCard';
import { DiaryHiddenSlotList } from '@/app/features/travel-diary/components/DiaryHiddenSlotList';
import { DiaryHorizontalPager } from '@/app/features/travel-diary/components/DiaryHorizontalPager';
import { TravelFieldRecordHost } from '@/app/features/travel-planner/components/TravelFieldRecordHost';
import { getTravelTranslation } from '@/lib/translations/travel';

const API = '/api/v1/travel';
const VIEW_MODE_KEY = 'ellena-travel-diary-view';

function localTodayYmd(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

type DiaryViewMode = 'vertical' | 'horizontal';

type PlannerBundle = {
  accommodations: TravelAccommodation[];
  dining: TravelDining[];
  attractions: TravelAttraction[];
  transports: TravelTransport[];
  itineraries: TravelItinerary[];
};

export function TravelDiaryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get('tripId');
  const { currentGroupId, currentGroup, uiTheme } = useGroup();
  const { lang } = useLanguage();
  const isFamilyTheme = uiTheme === 'kids_friendly';
  const isNightShell = uiTheme === 'highend_glass';
  /** Family·High-end: 어두운 앱 셸 위 밝은 카드 */
  const isDarkPage = isFamilyTheme || isNightShell;
  const t = useCallback(
    (key: Parameters<typeof getTravelDiaryTranslation>[1]) => getTravelDiaryTranslation(lang, key),
    [lang],
  );

  const [trip, setTrip] = useState<TravelTrip | null>(null);
  const [entries, setEntries] = useState<TravelDiaryEntry[]>([]);
  const [hiddenEntries, setHiddenEntries] = useState<TravelDiaryEntry[]>([]);
  const [feedback, setFeedback] = useState<TravelPlaceFeedback[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [planner, setPlanner] = useState<PlannerBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidingAll, setHidingAll] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [viewMode, setViewMode] = useState<DiaryViewMode>('vertical');
  const [showAddItinerary, setShowAddItinerary] = useState(false);
  const [addDay, setAddDay] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addStart, setAddStart] = useState('');
  const [addEnd, setAddEnd] = useState('');
  const [addingItinerary, setAddingItinerary] = useState(false);
  const addingItineraryRef = useRef(false);
  const [entryPhotos, setEntryPhotos] = useState<Map<string, UploadedAttachment[]> | null>(null);
  const shownTripRef = useRef<string | null>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const loadAll = useCallback(async () => {
    if (!currentGroupId || !tripIdParam) {
      setTrip(null);
      setEntries([]);
      setHiddenEntries([]);
      setFeedback([]);
      setExpenses([]);
      setPlanner(null);
      setEntryPhotos(null);
      setLoading(false);
      return;
    }
    const firstPaint = shownTripRef.current !== tripIdParam;
    if (firstPaint) setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const gid = currentGroupId;
      const tid = tripIdParam;

      const tripP = fetch(`${API}/trips/${tid}?groupId=${gid}`, { headers });
      const entP = fetch(`${API}/trips/${tid}/diary-entries?groupId=${gid}&includeDeleted=1`, { headers });
      const itP = fetch(`${API}/trips/${tid}/itineraries?groupId=${gid}`, { headers });
      const fbP = fetch(`${API}/trips/${tid}/place-feedback?groupId=${gid}`, { headers });
      const expP = fetch(`${API}/trips/${tid}/expenses?groupId=${gid}`, { headers });
      const accP = fetch(`${API}/trips/${tid}/accommodations?groupId=${gid}`, { headers });
      const dinP = fetch(`${API}/trips/${tid}/dining?groupId=${gid}`, { headers });
      const attP = fetch(`${API}/trips/${tid}/attractions?groupId=${gid}`, { headers });
      const trP = fetch(`${API}/trips/${tid}/transports?groupId=${gid}`, { headers });

      const [tripRes, entRes, itRes] = await Promise.all([tripP, entP, itP]);
      const tripJson = await tripRes.json();
      const entJson = await entRes.json();
      const itJson = await itRes.json();
      if (!tripRes.ok) throw new Error(tripJson.error);

      const nextEntries = Array.isArray(entJson.data) ? (entJson.data as TravelDiaryEntry[]) : [];
      const photoIds = nextEntries.map((entry) => entry.id).filter((id) => Boolean(id));

      setTrip(tripJson.data);
      setEntries(nextEntries);
      setHiddenEntries(Array.isArray(entJson.hidden) ? entJson.hidden : []);
      setPlanner({
        accommodations: [],
        dining: [],
        attractions: [],
        transports: [],
        itineraries: (itJson.data ?? []) as TravelItinerary[],
      });
      shownTripRef.current = tripIdParam;
      setLoading(false);

      const [fbRes, expRes, accRes, dinRes, attRes, trRes] = await Promise.all([fbP, expP, accP, dinP, attP, trP]);
      const fbJson = await fbRes.json();
      const expJson = await expRes.json();
      setFeedback(Array.isArray(fbJson.data) ? fbJson.data : []);
      setExpenses(Array.isArray(expJson.data) ? (expJson.data as TravelExpense[]) : []);
      setPlanner({
        accommodations: ((await accRes.json()).data ?? []) as TravelAccommodation[],
        dining: ((await dinRes.json()).data ?? []) as TravelDining[],
        attractions: ((await attRes.json()).data ?? []) as TravelAttraction[],
        transports: ((await trRes.json()).data ?? []) as TravelTransport[],
        itineraries: (itJson.data ?? []) as TravelItinerary[],
      });

      const photoMap = new Map<string, UploadedAttachment[]>();
      if (photoIds.length > 0) {
        try {
          const rows = await listAttachments({
            groupId: gid,
            entityType: 'travel_diary_entry',
            entityIds: photoIds,
          });
          for (const row of rows) {
            const bucket = photoMap.get(row.entity_id) ?? [];
            bucket.push(row);
            photoMap.set(row.entity_id, bucket);
          }
        } catch (photoError) {
          console.error(photoError);
        }
      }
      setEntryPhotos(photoMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, tripIdParam]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!currentGroupId) return;
    const gid = currentGroupId;
    const ch1 = supabase
      .channel(`travel_diary_entries:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_diary_entries', filter: `group_id=eq.${gid}` },
        () => void loadAll(),
      )
      .subscribe();
    const ch2 = supabase
      .channel(`travel_diary_feedback:${gid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_place_feedback', filter: `group_id=eq.${gid}` },
        () => void loadAll(),
      )
      .subscribe();
    channelsRef.current = [ch1, ch2];
    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [currentGroupId, loadAll]);

  const unifiedItems = useMemo(() => {
    if (!planner) return [];
    return buildUnifiedItineraries({
      ...planner,
      itineraryVisibleOnly: false,
    });
  }, [planner]);

  const timelineSlots = useMemo(() => {
    if (!planner) return [];
    return buildDiaryTimelineSlots(unifiedItems, entries, hiddenEntries);
  }, [planner, unifiedItems, entries, hiddenEntries]);

  const hiddenSlots = useMemo(() => {
    if (!planner) return [];
    return buildHiddenDiarySlots(unifiedItems, hiddenEntries);
  }, [planner, unifiedItems, hiddenEntries]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'horizontal' || saved === 'vertical') setViewMode(saved);
    } catch {
      /* 저장소를 쓸 수 없는 환경 */
    }
  }, []);

  const chooseViewMode = (mode: DiaryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* 저장소를 쓸 수 없는 환경 */
    }
  };

  const feedbackBySource = useMemo(() => {
    const m = new Map<string, TravelPlaceFeedback>();
    for (const f of feedback) {
      m.set(`${f.source_kind}:${f.source_id}`, f);
    }
    return m;
  }, [feedback]);

  const expenseBySource = useMemo(() => {
    const m = new Map<string, TravelExpense>();
    for (const e of expenses) {
      if (!e.source_kind || !e.source_id) continue;
      const key = `${e.source_kind}:${e.source_id}`;
      const prev = m.get(key);
      if (!prev || e.diary_origin) m.set(key, e);
    }
    return m;
  }, [expenses]);

  const tripCurrency = (trip?.currency || 'KRW').trim().toUpperCase() || 'KRW';
  const moneyLocale = intlLocaleForLang(lang);

  const canWrite = trip ? canWriteDiary(trip) : false;

  const beginEditTitle = () => {
    if (!trip || !canWrite) return;
    setTitleDraft(trip.title);
    setEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setEditingTitle(false);
    setTitleDraft('');
  };

  const saveTitle = async () => {
    if (!trip || !currentGroupId || !tripIdParam || savingTitle) return;
    const next = titleDraft.trim();
    if (!next) {
      window.alert(t('trip_title_empty'));
      return;
    }
    if (next === trip.title) {
      cancelEditTitle();
      return;
    }
    setSavingTitle(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const res = await fetch(`${API}/trips/${tripIdParam}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: currentGroupId, title: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(typeof body?.error === 'string' ? body.error : t('save_failed'));
        return;
      }
      const body = (await res.json()) as { trip?: TravelTrip };
      const updated = body.trip;
      if (updated) {
        setTrip(updated);
      } else {
        setTrip((prev) => (prev ? { ...prev, title: next } : prev));
      }
      setEditingTitle(false);
      setTitleDraft('');
    } finally {
      setSavingTitle(false);
    }
  };

  const saveSlot = async (
    slot: (typeof timelineSlots)[0],
    payload: {
      note: string;
      mood_tags: string[];
      rating: number | null;
      is_revisit: boolean;
      actual_expense: number | null;
      collage_style?: 'film' | 'postal';
      show_map?: boolean;
    },
  ): Promise<{ entryId: string | null; expenseId: string | null } | null> => {
    if (!currentGroupId || !tripIdParam) return null;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${API}/trips/${tripIdParam}/diary-entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: currentGroupId,
        id: slot.entry?.id,
        source_kind: slot.source_kind,
        source_id: slot.source_id,
        day_date: slot.day_date,
        note: payload.note,
        mood_tags: payload.mood_tags,
        rating: payload.rating,
        is_revisit: payload.is_revisit,
        actual_expense: payload.actual_expense,
        place_title: slot.title,
        collage_style: payload.collage_style,
        show_map: payload.show_map,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await loadAll();
    return {
      entryId: json.data?.id ?? null,
      expenseId: json.data?.travel_expense_id ?? null,
    };
  };

  const renameSlotTitle = async (slot: (typeof timelineSlots)[0], title: string) => {
    if (!currentGroupId || !slot.source_kind || !slot.source_id) return;
    const next = title.trim();
    if (!next || next === slot.title) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('auth');

    const body: Record<string, unknown> = { groupId: currentGroupId };
    let path = '';
    if (slot.source_kind === 'itinerary') {
      path = `itineraries/${slot.source_id}`;
      body.title = next;
    } else if (
      slot.source_kind === 'attraction' ||
      slot.source_kind === 'dining' ||
      slot.source_kind === 'accommodation'
    ) {
      path =
        slot.source_kind === 'attraction'
          ? `attractions/${slot.source_id}`
          : slot.source_kind === 'dining'
            ? `dining/${slot.source_id}`
            : `accommodations/${slot.source_id}`;
      body.name = next;
    } else if (slot.source_kind === 'transport') {
      path = `transports/${slot.source_id}`;
      const parts = next.split(/\s*(?:→|->)\s*/);
      if (parts.length >= 2 && parts[0]?.trim() && parts[1]?.trim()) {
        body.departure = parts[0].trim();
        body.arrival = parts.slice(1).join(' → ').trim();
      } else {
        body.departure = next;
        body.arrival = null;
      }
    } else {
      return;
    }

    const res = await fetch(`${API}/${path}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'rename');
    await loadAll();
  };

  const saveCollage = async (payload: {
    entryId: string;
    collage_attachment_ids?: (string | null)[];
    collage_style?: 'film' | 'postal';
    photo_focus?: Record<string, { y: number }>;
  }) => {
    if (!currentGroupId) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('auth');
    const body: Record<string, unknown> = { groupId: currentGroupId };
    if (payload.collage_attachment_ids !== undefined) {
      body.collage_attachment_ids = payload.collage_attachment_ids;
    }
    if (payload.collage_style !== undefined) {
      body.collage_style = payload.collage_style;
    }
    if (payload.photo_focus !== undefined) {
      body.photo_focus = payload.photo_focus;
    }
    const res = await fetch(`${API}/diary-entries/${payload.entryId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    const saved = json.data as TravelDiaryEntry | undefined;
    if (saved?.id) {
      setEntries((prev) => prev.map((row) => (row.id === saved.id ? { ...row, ...saved } : row)));
    }
  };

  const hideSlot = async (slot: (typeof timelineSlots)[0]) => {
    if (!currentGroupId || !tripIdParam) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('auth');
    const res = await fetch(`${API}/trips/${tripIdParam}/diary-entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groupId: currentGroupId,
        hide: true,
        id: slot.entry?.id,
        source_kind: slot.source_kind,
        source_id: slot.source_id,
        day_date: slot.day_date,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await loadAll();
  };

  /** 다이어리에서만 전체삭제(복구 불가). 플래너 일정·여행은 유지, 위젯 목록에서는 제거. */
  const hideAllSlots = async () => {
    if (!canWrite || hidingAll || !currentGroupId || !tripIdParam) {
      return;
    }
    if (!window.confirm(t('hide_all_confirm'))) return;
    setHidingAll(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('auth');
      const res = await fetch(`${API}/trips/${tripIdParam}/diary-entries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: currentGroupId, hideAll: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t('hide_all_failed'));
      router.push('/dashboard');
    } catch (e) {
      console.error(e);
      alert(t('hide_all_failed'));
      await loadAll();
    } finally {
      setHidingAll(false);
    }
  };

  const openAddItinerary = () => {
    setAddDay((trip?.start_date || localTodayYmd()).slice(0, 10));
    setAddTitle('');
    setAddStart('');
    setAddEnd('');
    setShowAddItinerary(true);
  };

  const submitAddItinerary = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentGroupId || !tripIdParam || addingItineraryRef.current) return;
    const day = addDay.trim().slice(0, 10);
    const title = addTitle.trim();
    if (!day || !title) {
      alert(getTravelTranslation(lang, 'alert_itinerary_required'));
      return;
    }
    addingItineraryRef.current = true;
    setAddingItinerary(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('auth');
      const res = await fetch(`${API}/trips/${tripIdParam}/itineraries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: currentGroupId,
          day_date: day,
          title,
          place_type: 'other',
          start_time: addStart.trim() || undefined,
          end_time: addEnd.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || getTravelTranslation(lang, 'itinerary_add_failed'));
      setShowAddItinerary(false);
      setAddTitle('');
      setAddStart('');
      setAddEnd('');
      await loadAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : getTravelTranslation(lang, 'itinerary_add_failed'));
    } finally {
      addingItineraryRef.current = false;
      setAddingItinerary(false);
    }
  };

  const restoreSlot = async (slot: (typeof hiddenSlots)[0]) => {
    if (!currentGroupId || !slot.entry?.id) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('auth');
    const res = await fetch(`${API}/diary-entries/${slot.entry.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupId: currentGroupId, restore: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await loadAll();
  };

  const renderSlotCard = (slot: (typeof timelineSlots)[number]) => {
    const fb =
      slot.source_kind && slot.source_id
        ? feedbackBySource.get(`${slot.source_kind}:${slot.source_id}`) ?? null
        : null;
    const linkedExpense =
      (fb?.travel_expense_id
        ? expenses.find((e) => e.id === fb.travel_expense_id) ?? null
        : null) ??
      (slot.source_kind && slot.source_id
        ? expenseBySource.get(`${slot.source_kind}:${slot.source_id}`) ?? null
        : null);
    return (
      <DiaryEntryCard
        key={slot.key}
        slot={slot}
        groupId={currentGroupId ?? ''}
        feedback={fb}
        linkedExpense={linkedExpense}
        entryPhotos={entryPhotos}
        fitFrame={viewMode === 'horizontal'}
        tripCurrency={tripCurrency}
        moneyLocale={moneyLocale}
        labels={{
          note_placeholder: t('note_placeholder'),
          mood_label: t('mood_label'),
          photos_label: t('photos_label'),
          photos_uploading: t('photos_uploading'),
          photos_adjust: t('photos_adjust'),
          slot_title_label: t('slot_title_label'),
          title_required: t('title_required'),
          rating_label: t('rating_label'),
          revisit_label: t('revisit_label'),
          expense_label: t('expense_label'),
          receipt_upload: t('receipt_upload'),
          receipt_need_expense: t('receipt_need_expense'),
          receipt_upload_failed: t('receipt_upload_failed'),
          save: t('save'),
          saved: t('saved'),
          edit: t('edit'),
          cancel: t('cancel'),
          save_failed: t('save_failed'),
          upload_failed: t('upload_failed'),
          photos_close: t('photos_close'),
          photos_slots_label: t('photos_slots_label'),
          photos_slots_hint: t('photos_slots_hint'),
          photos_slot_remove: t('photos_slot_remove'),
          photos_style_label: t('photos_style_label'),
          photos_style_film: t('photos_style_film'),
          photos_style_postal: t('photos_style_postal'),
          photos_album: t('photos_album'),
          photos_album_empty: t('photos_album_empty'),
          photos_album_add: t('photos_album_add'),
          photo_focus_title: t('photo_focus_title'),
          photo_focus_hint: t('photo_focus_hint'),
          photo_focus_confirm: t('photo_focus_confirm'),
          photo_focus_skip: t('photo_focus_skip'),
          map_label: t('map_label'),
          map_add: t('map_add'),
          map_remove: t('map_remove'),
          hide: t('hide'),
          hide_failed: t('hide_failed'),
          hide_confirm: t('hide_confirm'),
        }}
        onSave={(p) => saveSlot(slot, p)}
        onCollageSave={saveCollage}
        onRenameTitle={(title) => renameSlotTitle(slot, title)}
        onHide={() => hideSlot(slot)}
      />
    );
  };

  if (!currentGroupId) {
    return (
      <div
        className={[
          'flex min-h-screen items-center justify-center p-6',
          isDarkPage ? 'bg-app-shell-inner text-slate-300' : 'bg-gradient-to-b from-slate-50 to-sky-50/50 text-slate-500',
        ].join(' ')}
      >
        {t('select_group')}
      </div>
    );
  }

  if (!tripIdParam) {
    return (
      <div
        className={[
          'flex min-h-screen items-center justify-center p-6',
          isDarkPage ? 'bg-app-shell-inner text-slate-300' : 'bg-gradient-to-b from-slate-50 to-sky-50/50 text-slate-500',
        ].join(' ')}
      >
        {t('trip_required')}
      </div>
    );
  }

  return (
    <div
      className={[
        'min-h-screen p-4 sm:p-6',
        isDarkPage
          ? 'bg-app-shell-inner text-slate-50'
          : 'bg-gradient-to-b from-slate-50 via-white to-sky-50/40 text-slate-800',
      ].join(' ')}
    >
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className={[
            'mb-4 inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent text-sm font-medium',
            isDarkPage
              ? 'text-slate-300 hover:text-white'
              : 'text-slate-500 hover:text-slate-800',
          ].join(' ')}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('back')}
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={[
              'm-0 text-xl font-bold tracking-tight',
              isDarkPage ? 'text-white' : 'text-slate-800',
            ].join(' ')}
          >
            {t('diary_page_title')}
          </h1>
          {canWrite ? (
            <button
              type="button"
              onClick={() => void hideAllSlots()}
              disabled={hidingAll}
              className={[
                'inline-flex cursor-pointer items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                isDarkPage
                  ? 'border-rose-300/40 bg-white/95 text-rose-600 hover:bg-white'
                  : 'border-slate-200 bg-white text-rose-600 hover:border-rose-200 hover:bg-rose-50',
              ].join(' ')}
            >
              {hidingAll ? t('loading') : t('hide_all')}
            </button>
          ) : null}
        </div>
        {trip && (
          <div className="mt-1">
            {editingTitle ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveTitle();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEditTitle();
                    }
                  }}
                  disabled={savingTitle}
                  maxLength={200}
                  autoFocus
                  aria-label={t('edit')}
                  className={[
                    'min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium outline-none focus:ring-2',
                    isDarkPage
                      ? 'border-white/20 bg-white/10 text-white focus:ring-cyan-400/40'
                      : 'border-slate-200 bg-white text-slate-800 focus:ring-sky-400/40',
                  ].join(' ')}
                />
                <button
                  type="button"
                  onClick={() => void saveTitle()}
                  disabled={savingTitle}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60',
                    isDarkPage ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-sky-600 hover:bg-sky-500',
                  ].join(' ')}
                >
                  {savingTitle ? t('loading') : t('save')}
                </button>
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  disabled={savingTitle}
                  className={[
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60',
                    isDarkPage
                      ? 'border-white/20 text-slate-300 hover:bg-white/10'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <p
                className={[
                  'flex flex-wrap items-center gap-2 text-sm',
                  isFamilyTheme
                    ? 'text-cyan-200/85'
                    : isNightShell
                      ? 'text-sky-200/75'
                      : 'text-slate-500',
                ].join(' ')}
              >
                <span className="min-w-0 break-words">
                  {trip.title}
                  {currentGroup?.name ? ` · ${currentGroup.name}` : ''}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={beginEditTitle}
                    className={[
                      'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                      isDarkPage
                        ? 'border-white/20 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                    ].join(' ')}
                  >
                    {t('edit')}
                  </button>
                ) : null}
              </p>
            )}
          </div>
        )}

        <TravelFieldRecordHost
          groupId={currentGroupId}
          tripId={tripIdParam}
          mode="page"
          enabled={Boolean(tripIdParam)}
          labels={{
            checkin: getTravelTranslation(lang, 'field_checkin'),
            route_start: getTravelTranslation(lang, 'field_route_start'),
            route_stop: getTravelTranslation(lang, 'field_route_stop'),
            need_active_trip: getTravelTranslation(lang, 'field_need_active_trip'),
            recording: getTravelTranslation(lang, 'field_recording'),
            recording_keep_open: getTravelTranslation(lang, 'field_recording_keep_open'),
          }}
          pickLabels={{
            title: getTravelTranslation(lang, 'field_pick_title'),
            create: getTravelTranslation(lang, 'field_pick_create'),
            attach_hint: getTravelTranslation(lang, 'field_pick_attach'),
            cancel: getTravelTranslation(lang, 'field_pick_cancel'),
          }}
          onSaved={() => void loadAll()}
          onOpenTripDiary={(tid) => {
            if (tid === tripIdParam) {
              void loadAll();
              return;
            }
            router.push(`/travel/diary?tripId=${encodeURIComponent(tid)}`);
          }}
        />

        {loading ? (
          <p className={['mt-8 text-sm', isDarkPage ? 'text-slate-300' : 'text-slate-500'].join(' ')}>
            {t('loading')}
          </p>
        ) : !canWrite ? (
          <p className={['mt-8 text-sm', isDarkPage ? 'text-violet-200' : 'text-violet-600'].join(' ')}>
            {t('cannot_write')}
          </p>
        ) : (
          <>
          <div className="mt-4">
            {showAddItinerary ? (
              <form
                onSubmit={(event) => void submitAddItinerary(event)}
                className={[
                  'rounded-xl border p-3',
                  isDarkPage ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <p className={['text-sm font-semibold', isDarkPage ? 'text-white' : 'text-slate-800'].join(' ')}>
                  {getTravelTranslation(lang, 'add_itinerary')}
                </p>
                <label className={['mt-3 block text-xs font-medium', isDarkPage ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                  {getTravelTranslation(lang, 'label_date')}
                  <input
                    type="date"
                    required
                    value={addDay}
                    onChange={(event) => setAddDay(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className={['mt-3 block text-xs font-medium', isDarkPage ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                  {getTravelTranslation(lang, 'label_title')}
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={addTitle}
                    onChange={(event) => setAddTitle(event.target.value)}
                    placeholder={getTravelTranslation(lang, 'placeholder_itinerary_title')}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className={['block text-xs font-medium', isDarkPage ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                    {getTravelTranslation(lang, 'label_start_time')}
                    <input
                      type="time"
                      value={addStart}
                      onChange={(event) => setAddStart(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </label>
                  <label className={['block text-xs font-medium', isDarkPage ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                    {getTravelTranslation(lang, 'label_end_time')}
                    <input
                      type="time"
                      value={addEnd}
                      onChange={(event) => setAddEnd(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={addingItinerary}
                    onClick={() => setShowAddItinerary(false)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-60"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={addingItinerary}
                    className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {addingItinerary ? t('loading') : t('save')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={openAddItinerary}
                className="cursor-pointer rounded-lg border-0 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                + {getTravelTranslation(lang, 'add_itinerary')}
              </button>
            )}
          </div>
          {timelineSlots.length === 0 && hiddenSlots.length === 0 ? (
          <p className={['mt-8 text-sm', isDarkPage ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
            {t('no_slots')}
          </p>
          ) : null}
          {timelineSlots.length > 0 ? (
            <div
              role="group"
              aria-label={t('view_mode')}
              className={[
                'mt-6 inline-flex rounded-lg border p-0.5',
                isDarkPage ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              {(['vertical', 'horizontal'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseViewMode(mode)}
                    className={[
                      'cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                      active
                        ? isDarkPage
                          ? 'bg-white text-slate-900'
                          : 'bg-sky-600 text-white'
                        : isDarkPage
                          ? 'text-slate-300 hover:bg-white/10'
                          : 'text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {mode === 'vertical' ? t('view_vertical') : t('view_horizontal')}
                  </button>
                );
              })}
            </div>
          ) : null}
          {timelineSlots.length > 0 ? (
            <DiaryHorizontalPager layout={viewMode} label={t('view_horizontal')} isDark={isDarkPage}>
              {timelineSlots.map(renderSlotCard)}
            </DiaryHorizontalPager>
          ) : null}
          {hiddenSlots.length > 0 ? (
            <DiaryHiddenSlotList
              slots={hiddenSlots}
              sectionTitle={t('hidden_section')}
              restoreLabel={t('restore')}
              restoreFailedLabel={t('restore_failed')}
              onRestore={restoreSlot}
            />
          ) : null}
          </>
        )}
      </div>
    </div>
  );
}
