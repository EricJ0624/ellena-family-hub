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
import { buildDiaryTimelineSlots } from '@/lib/modules/travel-planner/diary-timeline';
import { canWriteDiary } from '@/lib/modules/travel-planner/diary-eligibility';
import { DiaryEntryCard } from '@/app/features/travel-diary/components/DiaryEntryCard';

const API = '/api/v1/travel';

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
  const { currentGroupId, currentGroup } = useGroup();
  const { lang } = useLanguage();
  const t = useCallback(
    (key: Parameters<typeof getTravelDiaryTranslation>[1]) => getTravelDiaryTranslation(lang, key),
    [lang],
  );

  const [trip, setTrip] = useState<TravelTrip | null>(null);
  const [entries, setEntries] = useState<TravelDiaryEntry[]>([]);
  const [feedback, setFeedback] = useState<TravelPlaceFeedback[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [planner, setPlanner] = useState<PlannerBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const loadAll = useCallback(async () => {
    if (!currentGroupId || !tripIdParam) {
      setTrip(null);
      setEntries([]);
      setFeedback([]);
      setExpenses([]);
      setPlanner(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const gid = currentGroupId;
      const tid = tripIdParam;

      const [tripRes, entRes, fbRes, expRes, accRes, dinRes, attRes, trRes, itRes] = await Promise.all([
        fetch(`${API}/trips/${tid}?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/diary-entries?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/place-feedback?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/expenses?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/accommodations?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/dining?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/attractions?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/transports?groupId=${gid}`, { headers }),
        fetch(`${API}/trips/${tid}/itineraries?groupId=${gid}`, { headers }),
      ]);

      const tripJson = await tripRes.json();
      const entJson = await entRes.json();
      const fbJson = await fbRes.json();
      const expJson = await expRes.json();
      if (!tripRes.ok) throw new Error(tripJson.error);

      setTrip(tripJson.data);
      setEntries(Array.isArray(entJson.data) ? entJson.data : []);
      setFeedback(Array.isArray(fbJson.data) ? fbJson.data : []);
      setExpenses(Array.isArray(expJson.data) ? (expJson.data as TravelExpense[]) : []);
      setPlanner({
        accommodations: ((await accRes.json()).data ?? []) as TravelAccommodation[],
        dining: ((await dinRes.json()).data ?? []) as TravelDining[],
        attractions: ((await attRes.json()).data ?? []) as TravelAttraction[],
        transports: ((await trRes.json()).data ?? []) as TravelTransport[],
        itineraries: ((await itRes.json()).data ?? []) as TravelItinerary[],
      });
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

  const timelineSlots = useMemo(() => {
    if (!planner) return [];
    const unified = buildUnifiedItineraries({
      ...planner,
      itineraryVisibleOnly: false,
    });
    return buildDiaryTimelineSlots(unified, entries);
  }, [planner, entries]);

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

  const saveSlot = async (
    slot: (typeof timelineSlots)[0],
    payload: {
      note: string;
      mood_tags: string[];
      rating: number | null;
      is_revisit: boolean;
      actual_expense: number | null;
      collage_style?: 'film' | 'postal';
    },
  ): Promise<string | null> => {
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
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    await loadAll();
    return json.data?.id ?? null;
  };

  const saveCollage = async (payload: {
    entryId: string;
    collage_attachment_ids?: (string | null)[];
    collage_style?: 'film' | 'postal';
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

  if (!currentGroupId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-slate-600">
        {t('select_group')}
      </div>
    );
  }

  if (!tripIdParam) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-slate-600">
        {t('trip_required')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-4 inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('back')}
        </button>

        <h1 className="m-0 text-xl font-bold text-slate-800">{t('diary_page_title')}</h1>
        {trip && (
          <p className="mt-1 text-sm text-slate-500">
            {trip.title} · {currentGroup?.name}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">{t('loading')}</p>
        ) : !canWrite ? (
          <p className="mt-8 text-sm text-violet-700">{t('cannot_write')}</p>
        ) : timelineSlots.length === 0 ? (
          <p className="mt-8 text-sm text-slate-600">{t('no_slots')}</p>
        ) : (
          <div className="mt-6 space-y-4">
            {timelineSlots.map((slot) => {
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
                  groupId={currentGroupId}
                  feedback={fb}
                  linkedExpense={linkedExpense}
                  tripCurrency={tripCurrency}
                  moneyLocale={moneyLocale}
                  labels={{
                    note_placeholder: t('note_placeholder'),
                    mood_label: t('mood_label'),
                    photos_label: t('photos_label'),
                    rating_label: t('rating_label'),
                    revisit_label: t('revisit_label'),
                    expense_label: t('expense_label'),
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
                  }}
                  onSave={(p) => saveSlot(slot, p)}
                  onCollageSave={saveCollage}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
