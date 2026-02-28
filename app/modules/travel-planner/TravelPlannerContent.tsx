'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import type { TravelTrip, TravelItinerary, TravelExpense, TravelAccommodation, TravelDining } from '@/lib/modules/travel-planner/types';
import {
  MapPin,
  ChevronLeft,
  Calendar,
  ListOrdered,
  Wallet,
  Trash2,
  Loader2,
  X,
  Pencil,
  Home,
  UtensilsCrossed,
} from 'lucide-react';

const API_BASE = '/api/v1/travel';

export function TravelPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const tt = (key: keyof import('@/lib/translations/travel').TravelTranslations) => getTravelTranslation(lang, key);
  const { currentGroupId, currentGroup } = useGroup();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TravelTrip | null>(null);
  const [itineraries, setItineraries] = useState<TravelItinerary[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [accommodations, setAccommodations] = useState<TravelAccommodation[]>([]);
  const [dining, setDining] = useState<TravelDining[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showTripEditForm, setShowTripEditForm] = useState(false);
  const [showItineraryForm, setShowItineraryForm] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<TravelItinerary | null>(null);
  const [itineraryDayDate, setItineraryDayDate] = useState('');
  const [itineraryTitle, setItineraryTitle] = useState('');
  const [itineraryDescription, setItineraryDescription] = useState('');
  const [itineraryStartTime, setItineraryStartTime] = useState('');
  const [itineraryEndTime, setItineraryEndTime] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TravelExpense | null>(null);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseMemo, setExpenseMemo] = useState('');
  const [expenseEntryType, setExpenseEntryType] = useState<'addition' | 'expense'>('expense');
  const [showAccommodationForm, setShowAccommodationForm] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<TravelAccommodation | null>(null);
  const [accName, setAccName] = useState('');
  const [accCheckIn, setAccCheckIn] = useState('');
  const [accCheckOut, setAccCheckOut] = useState('');
  const [accAddress, setAccAddress] = useState('');
  const [accMemo, setAccMemo] = useState('');
  const [accLatitude, setAccLatitude] = useState('');
  const [accLongitude, setAccLongitude] = useState('');
  const [showDiningForm, setShowDiningForm] = useState(false);
  const [editingDining, setEditingDining] = useState<TravelDining | null>(null);
  const [diningName, setDiningName] = useState('');
  const [diningDayDate, setDiningDayDate] = useState('');
  const [diningTime, setDiningTime] = useState('');
  const [diningCategory, setDiningCategory] = useState('');
  const [diningMemo, setDiningMemo] = useState('');
  const [diningAddress, setDiningAddress] = useState('');
  const [diningLatitude, setDiningLatitude] = useState('');
  const [diningLongitude, setDiningLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [itineraryAddress, setItineraryAddress] = useState('');
  const [itineraryLatitude, setItineraryLatitude] = useState('');
  const [itineraryLongitude, setItineraryLongitude] = useState('');

  const [formTitle, setFormTitle] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formBudget, setFormBudget] = useState('');

  /** userId → 표시명 (nickname || email || '멤버'). 그룹 멤버 + 프로필에서 로드 */
  const [memberDisplayNames, setMemberDisplayNames] = useState<Map<string, string>>(new Map());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selectedTripIdRef = useRef<string | null>(null);
  selectedTripIdRef.current = selectedTrip?.id ?? null;
  const travelMapRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; fitBounds: (b: unknown) => void } | null>(null);
  const travelMapMarkersRef = useRef<unknown[]>([]);
  const travelMapScriptLoadedRef = useRef(false);
  const accAddressInputRef = useRef<HTMLInputElement>(null);
  const diningAddressInputRef = useRef<HTMLInputElement>(null);
  const itineraryAddressInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(tt('auth_required'));
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  /** 좌표 우선, 없으면 주소로 구글맵 URL 생성 */
  const getGoogleMapsUrl = useCallback((item: { address?: string | null; latitude?: number | null; longitude?: number | null }) => {
    if (item.latitude != null && item.longitude != null) return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    if (item.address?.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address.trim())}`;
    return null;
  }, []);

  const fetchTrips = useCallback(async () => {
    if (!currentGroupId) return;
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_trips_failed'));
      setTrips(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tt('load_failed'));
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, getAuthHeaders]);

  const fetchItineraries = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/itineraries?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_itinerary_failed'));
      setItineraries(json.data ?? []);
    } catch {
      setItineraries([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  const fetchExpenses = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/expenses?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_expense_failed'));
      setExpenses(json.data ?? []);
    } catch {
      setExpenses([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  const fetchAccommodations = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/accommodations?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_accommodation_failed'));
      setAccommodations(json.data ?? []);
    } catch {
      setAccommodations([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  const fetchDining = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/dining?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_dining_failed'));
      setDining(json.data ?? []);
    } catch {
      setDining([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  useEffect(() => {
    if (currentGroupId) {
      fetchTrips();
    } else {
      setLoading(false);
      setTrips([]);
    }
  }, [currentGroupId, fetchTrips]);

  const urlTripId = searchParams.get('tripId');
  const urlOpenAdd = searchParams.get('openAdd') === '1';

  useEffect(() => {
    if (urlOpenAdd) setShowTripForm(true);
  }, [urlOpenAdd]);

  useEffect(() => {
    if (!urlTripId || trips.length === 0) return;
    const trip = trips.find((t) => t.id === urlTripId);
    if (trip) setSelectedTrip(trip);
  }, [urlTripId, trips]);

  // 여행 플래너 지도: 숙소·먹거리·일정(관광지) 위치 표시
  useEffect(() => {
    if (typeof window === 'undefined' || !selectedTrip) {
      travelMapMarkersRef.current.forEach((m: any) => m?.setMap?.(null));
      travelMapMarkersRef.current = [];
      travelMapRef.current = null;
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!apiKey) return;

    const mapEl = document.getElementById('travel-planner-map');
    if (!mapEl) return;

    const initMapAndMarkers = () => {
      const g = (window as any).google;
      if (!g?.maps?.Map) return;

      if (!travelMapRef.current) {
        const center = { lat: 37.5665, lng: 126.978 };
        travelMapRef.current = new g.maps.Map(mapEl, {
          center,
          zoom: 11,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
      }

      const map = travelMapRef.current;
      travelMapMarkersRef.current.forEach((m: any) => m?.setMap?.(null));
      travelMapMarkersRef.current = [];

      const bounds = new g.maps.LatLngBounds();
      let hasAny = false;

      const addMarker = (lat: number, lng: number, title: string, label?: string) => {
        const pos = { lat, lng };
        bounds.extend(pos);
        hasAny = true;
        const marker = new g.maps.Marker({
          map,
          position: pos,
          title,
          label: label ? { text: label, color: 'white', fontSize: '11px' } : undefined,
          icon: label
            ? undefined
            : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });
        if (label === tt('marker_accommodation')) marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
        else if (label === tt('marker_dining')) marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png');
        else if (label === tt('marker_place')) marker.setIcon('http://maps.google.com/mapfiles/ms/icons/red-dot.png');
        travelMapMarkersRef.current.push(marker);
      };

      accommodations.forEach((a) => {
        if (a.latitude != null && a.longitude != null) addMarker(a.latitude, a.longitude, a.name, tt('marker_accommodation'));
      });
      dining.forEach((d) => {
        if (d.latitude != null && d.longitude != null) addMarker(d.latitude, d.longitude, d.name, tt('marker_dining'));
      });
      itineraries.forEach((i) => {
        if (i.latitude != null && i.longitude != null) addMarker(i.latitude, i.longitude, i.title, i.source_type ? undefined : tt('marker_place'));
      });

      if (hasAny && map) map.fitBounds(bounds);
    };

    if ((window as any).google?.maps?.Map) {
      initMapAndMarkers();
      return;
    }
    if (travelMapScriptLoadedRef.current) {
      initMapAndMarkers();
      return;
    }
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      travelMapScriptLoadedRef.current = true;
      const t = setInterval(() => {
        if ((window as any).google?.maps?.Map) {
          clearInterval(t);
          initMapAndMarkers();
        }
      }, 100);
      return () => clearInterval(t);
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      travelMapScriptLoadedRef.current = true;
      let count = 0;
      const iv = setInterval(() => {
        count++;
        if ((window as any).google?.maps?.Map) {
          clearInterval(iv);
          initMapAndMarkers();
        } else if (count >= 80) clearInterval(iv);
      }, 100);
    };
    document.head.appendChild(script);
  }, [selectedTrip, accommodations, dining, itineraries]);

  // Places Autocomplete: 숙소 폼 주소 필드
  useEffect(() => {
    if (!showAccommodationForm) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!apiKey) return;
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const timer = setTimeout(() => {
      const el = accAddressInputRef.current;
      if (!el) return;
      const autocomplete = new g.maps.places.Autocomplete(el, { types: ['establishment', 'geocode'] });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) setAccAddress(place.formatted_address);
        if (place.geometry?.location) {
          setAccLatitude(String(place.geometry.location.lat()));
          setAccLongitude(String(place.geometry.location.lng()));
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [showAccommodationForm]);

  // Places Autocomplete: 먹거리 폼 주소 필드
  useEffect(() => {
    if (!showDiningForm) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!apiKey) return;
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const timer = setTimeout(() => {
      const el = diningAddressInputRef.current;
      if (!el) return;
      const autocomplete = new g.maps.places.Autocomplete(el, { types: ['establishment', 'geocode'] });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) setDiningAddress(place.formatted_address);
        if (place.geometry?.location) {
          setDiningLatitude(String(place.geometry.location.lat()));
          setDiningLongitude(String(place.geometry.location.lng()));
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [showDiningForm]);

  // Places Autocomplete: 일정(관광지) 폼 주소 필드
  useEffect(() => {
    if (!showItineraryForm) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!apiKey) return;
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;
    const timer = setTimeout(() => {
      const el = itineraryAddressInputRef.current;
      if (!el) return;
      const autocomplete = new g.maps.places.Autocomplete(el, { types: ['establishment', 'geocode'] });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) setItineraryAddress(place.formatted_address);
        if (place.geometry?.location) {
          setItineraryLatitude(String(place.geometry.location.lat()));
          setItineraryLongitude(String(place.geometry.location.lng()));
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [showItineraryForm]);

  /** 그룹 멤버 표시명 맵 로드 (memberships + profiles) */
  useEffect(() => {
    if (!currentGroupId) {
      setMemberDisplayNames(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: memberships } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('group_id', currentGroupId);
        const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
        if (userIds.length === 0) {
          if (!cancelled) setMemberDisplayNames(new Map());
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname, email')
          .in('id', userIds);
        const map = new Map<string, string>();
        (profiles ?? []).forEach((p) => {
          const name = (p.nickname && String(p.nickname).trim()) || p.email || tt('member_fallback');
          map.set(p.id, name);
        });
        if (!cancelled) setMemberDisplayNames(map);
      } catch {
        if (!cancelled) setMemberDisplayNames(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, [currentGroupId]);

  const getDisplayName = useCallback((userId: string | null | undefined): string => {
    if (!userId) return '-';
    return memberDisplayNames.get(userId) ?? '-';
  }, [memberDisplayNames]);

  useEffect(() => {
    if (selectedTrip) {
      fetchItineraries(selectedTrip.id);
      fetchExpenses(selectedTrip.id);
      fetchAccommodations(selectedTrip.id);
      fetchDining(selectedTrip.id);
    } else {
      setItineraries([]);
      setExpenses([]);
      setAccommodations([]);
      setDining([]);
    }
  }, [selectedTrip, fetchItineraries, fetchExpenses, fetchAccommodations, fetchDining]);

  /** 실시간 반영: 동일 그룹 사용자의 변경 사항 구독 */
  useEffect(() => {
    if (!currentGroupId) return;

    const groupId = currentGroupId;
    const channel = supabase
      .channel(`travel_planner_${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_trips', filter: `group_id=eq.${groupId}` },
        (payload: { eventType?: string; type?: string; old?: { id?: string }; new?: unknown }) => {
          fetchTrips();
          const isDelete = payload?.eventType === 'DELETE' || payload?.type === 'DELETE' || (payload?.old?.id != null && payload?.new == null);
          if (isDelete && payload?.old?.id === selectedTripIdRef.current) {
            setSelectedTrip(null);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_itineraries', filter: `group_id=eq.${groupId}` },
        () => {
          const tripId = selectedTripIdRef.current;
          if (tripId) fetchItineraries(tripId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_expenses', filter: `group_id=eq.${groupId}` },
        () => {
          const tripId = selectedTripIdRef.current;
          if (tripId) fetchExpenses(tripId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_accommodations', filter: `group_id=eq.${groupId}` },
        () => {
          const tripId = selectedTripIdRef.current;
          if (tripId) fetchAccommodations(tripId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_dining', filter: `group_id=eq.${groupId}` },
        () => {
          const tripId = selectedTripIdRef.current;
          if (tripId) fetchDining(tripId);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentGroupId, fetchTrips, fetchItineraries, fetchExpenses, fetchAccommodations, fetchDining]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !formTitle.trim() || !formStartDate || !formEndDate) {
      alert(tt('alert_trip_required'));
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      alert(tt('alert_end_after_start'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(API_BASE + '/trips', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          title: formTitle.trim(),
          destination: formDestination.trim() || undefined,
          start_date: formStartDate,
          end_date: formEndDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('create_failed'));
      setFormTitle('');
      setFormDestination('');
      setFormStartDate('');
      setFormEndDate('');
      setShowTripForm(false);
      await fetchTrips();
      if (json.data?.id) router.replace(`/travel?tripId=${json.data.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('create_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !formTitle.trim() || !formStartDate || !formEndDate) {
      alert(tt('alert_trip_required'));
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      alert(tt('alert_end_after_start'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          title: formTitle.trim(),
          destination: formDestination.trim() || null,
          start_date: formStartDate,
          end_date: formEndDate,
          budget: formBudget.trim() ? Number(formBudget) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('update_failed'));
      if (json.data) setSelectedTrip(json.data);
      await fetchTrips();
      setShowTripEditForm(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTrip = async (trip: TravelTrip) => {
    if (!currentGroupId || !confirm(`"${trip.title}" 여행을 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${trip.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('delete_failed'));
      const wasCurrent = selectedTrip?.id === trip.id;
      if (wasCurrent) setSelectedTrip(null);
      await fetchTrips();
      if (wasCurrent) router.push('/dashboard');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('delete_failed'));
    }
  };

  const openItineraryForm = (item: TravelItinerary | null) => {
    if (item) {
      setEditingItinerary(item);
      setItineraryDayDate(item.day_date);
      setItineraryTitle(item.title);
      setItineraryDescription(item.description ?? '');
      setItineraryStartTime(item.start_time ?? '');
      setItineraryEndTime(item.end_time ?? '');
      setItineraryAddress(item.address ?? '');
      setItineraryLatitude(item.latitude != null ? String(item.latitude) : '');
      setItineraryLongitude(item.longitude != null ? String(item.longitude) : '');
    } else {
      setEditingItinerary(null);
      setItineraryDayDate('');
      setItineraryTitle('');
      setItineraryDescription('');
      setItineraryStartTime('');
      setItineraryEndTime('');
      setItineraryAddress('');
      setItineraryLatitude('');
      setItineraryLongitude('');
    }
    setShowItineraryForm(true);
  };

  const handleCreateItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !itineraryDayDate || !itineraryTitle.trim()) {
      alert(tt('alert_itinerary_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/itineraries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          day_date: itineraryDayDate,
          title: itineraryTitle.trim(),
          description: itineraryDescription.trim() || undefined,
          start_time: itineraryStartTime.trim() || undefined,
          end_time: itineraryEndTime.trim() || undefined,
          address: itineraryAddress.trim() || undefined,
          latitude: itineraryLatitude.trim() ? Number(itineraryLatitude) : undefined,
          longitude: itineraryLongitude.trim() ? Number(itineraryLongitude) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('itinerary_add_failed'));
      await fetchItineraries(selectedTrip.id);
      setShowItineraryForm(false);
      setEditingItinerary(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('itinerary_add_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItinerary || !currentGroupId || !itineraryDayDate || !itineraryTitle.trim()) {
      alert(tt('alert_itinerary_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/itineraries/${editingItinerary.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          day_date: itineraryDayDate,
          title: itineraryTitle.trim(),
          description: itineraryDescription.trim() || null,
          start_time: itineraryStartTime.trim() || null,
          end_time: itineraryEndTime.trim() || null,
          address: itineraryAddress.trim() || null,
          latitude: itineraryLatitude.trim() ? Number(itineraryLatitude) : null,
          longitude: itineraryLongitude.trim() ? Number(itineraryLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('itinerary_update_failed'));
      await fetchItineraries(selectedTrip!.id);
      setShowItineraryForm(false);
      setEditingItinerary(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('itinerary_update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItinerary = async (item: TravelItinerary) => {
    if (!currentGroupId || !selectedTrip || !confirm(`"${item.title}" 일정을 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/itineraries/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || tt('itinerary_delete_failed'));
      }
      await fetchItineraries(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('itinerary_delete_failed'));
    }
  };

  const openExpenseForm = (item: TravelExpense | null, defaultEntryType?: 'addition' | 'expense') => {
    if (item) {
      setEditingExpense(item);
      setExpenseEntryType(item.entry_type === 'addition' ? 'addition' : 'expense');
      setExpenseCategory(item.category ?? '');
      setExpenseAmount(String(item.amount));
      setExpenseDate(item.expense_date);
      setExpenseMemo(item.memo ?? '');
    } else {
      setEditingExpense(null);
      setExpenseEntryType(defaultEntryType ?? 'expense');
      setExpenseCategory('');
      setExpenseAmount('');
      setExpenseDate('');
      setExpenseMemo('');
    }
    setShowExpenseForm(true);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (!currentGroupId || !selectedTrip || expenseDate === '' || Number.isNaN(amount) || amount < 0) {
      alert(tt('alert_expense_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          entry_type: expenseEntryType,
          amount,
          expense_date: expenseDate,
          category: expenseCategory.trim() || undefined,
          memo: expenseMemo.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('expense_add_failed'));
      await fetchExpenses(selectedTrip.id);
      setShowExpenseForm(false);
      setEditingExpense(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('expense_add_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (!editingExpense || !currentGroupId || expenseDate === '' || Number.isNaN(amount) || amount < 0) {
      alert(tt('alert_expense_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/expenses/${editingExpense.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          entry_type: expenseEntryType,
          category: expenseCategory.trim() || null,
          amount,
          expense_date: expenseDate,
          memo: expenseMemo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('expense_update_failed'));
      await fetchExpenses(selectedTrip!.id);
      setShowExpenseForm(false);
      setEditingExpense(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('expense_update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (item: TravelExpense) => {
    if (!currentGroupId || !selectedTrip || !confirm(`이 경비 항목을 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/expenses/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || tt('expense_delete_failed'));
      }
      await fetchExpenses(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('expense_delete_failed'));
    }
  };

  const openAccommodationForm = (item: TravelAccommodation | null) => {
    if (item) {
      setEditingAccommodation(item);
      setAccName(item.name);
      setAccCheckIn(item.check_in_date);
      setAccCheckOut(item.check_out_date);
      setAccAddress(item.address ?? '');
      setAccMemo(item.memo ?? '');
      setAccLatitude(item.latitude != null ? String(item.latitude) : '');
      setAccLongitude(item.longitude != null ? String(item.longitude) : '');
    } else {
      setEditingAccommodation(null);
      setAccName('');
      setAccCheckIn('');
      setAccCheckOut('');
      setAccAddress('');
      setAccMemo('');
      setAccLatitude('');
      setAccLongitude('');
    }
    setShowAccommodationForm(true);
  };

  const handleCreateAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !accName.trim() || !accCheckIn || !accCheckOut) {
      alert(tt('alert_acc_required'));
      return;
    }
    if (new Date(accCheckOut) < new Date(accCheckIn)) {
      alert(tt('alert_checkout_after_checkin'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/accommodations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          name: accName.trim(),
          check_in_date: accCheckIn,
          check_out_date: accCheckOut,
          address: accAddress.trim() || undefined,
          memo: accMemo.trim() || undefined,
          latitude: accLatitude.trim() ? Number(accLatitude) : undefined,
          longitude: accLongitude.trim() ? Number(accLongitude) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('accommodation_add_failed'));
      await fetchAccommodations(selectedTrip.id);
      await fetchItineraries(selectedTrip.id);
      setShowAccommodationForm(false);
      setEditingAccommodation(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('accommodation_add_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccommodation || !currentGroupId || !accName.trim() || !accCheckIn || !accCheckOut) {
      alert(tt('alert_acc_required'));
      return;
    }
    if (new Date(accCheckOut) < new Date(accCheckIn)) {
      alert(tt('alert_checkout_after_checkin'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/accommodations/${editingAccommodation.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: accName.trim(),
          check_in_date: accCheckIn,
          check_out_date: accCheckOut,
          address: accAddress.trim() || null,
          memo: accMemo.trim() || null,
          latitude: accLatitude.trim() ? Number(accLatitude) : null,
          longitude: accLongitude.trim() ? Number(accLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('accommodation_update_failed'));
      await fetchAccommodations(selectedTrip!.id);
      await fetchItineraries(selectedTrip!.id);
      setShowAccommodationForm(false);
      setEditingAccommodation(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('accommodation_update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccommodation = async (item: TravelAccommodation) => {
    if (!currentGroupId || !selectedTrip || !confirm(`"${item.name}" 숙소를 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/accommodations/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || tt('accommodation_delete_failed'));
      }
      await fetchAccommodations(selectedTrip.id);
      await fetchItineraries(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('accommodation_delete_failed'));
    }
  };

  const openDiningForm = (item: TravelDining | null) => {
    if (item) {
      setEditingDining(item);
      setDiningName(item.name);
      setDiningDayDate(item.day_date);
      setDiningTime(item.time_at ?? '');
      setDiningCategory(item.category ?? '');
      setDiningMemo(item.memo ?? '');
      setDiningAddress(item.address ?? '');
      setDiningLatitude(item.latitude != null ? String(item.latitude) : '');
      setDiningLongitude(item.longitude != null ? String(item.longitude) : '');
    } else {
      setEditingDining(null);
      setDiningName('');
      setDiningDayDate('');
      setDiningTime('');
      setDiningCategory('');
      setDiningMemo('');
      setDiningAddress('');
      setDiningLatitude('');
      setDiningLongitude('');
    }
    setShowDiningForm(true);
  };

  const handleCreateDining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !diningName.trim() || !diningDayDate) {
      alert(tt('alert_dining_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/dining`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          name: diningName.trim(),
          day_date: diningDayDate,
          time_at: diningTime.trim() || undefined,
          category: diningCategory.trim() || undefined,
          memo: diningMemo.trim() || undefined,
          address: diningAddress.trim() || undefined,
          latitude: diningLatitude.trim() ? Number(diningLatitude) : undefined,
          longitude: diningLongitude.trim() ? Number(diningLongitude) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('dining_add_failed'));
      await fetchDining(selectedTrip.id);
      await fetchItineraries(selectedTrip.id);
      setShowDiningForm(false);
      setEditingDining(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('dining_add_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDining || !currentGroupId || !diningName.trim() || !diningDayDate) {
      alert(tt('alert_dining_required'));
      return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/dining/${editingDining.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: diningName.trim(),
          day_date: diningDayDate,
          time_at: diningTime.trim() || null,
          category: diningCategory.trim() || null,
          memo: diningMemo.trim() || null,
          address: diningAddress.trim() || null,
          latitude: diningLatitude.trim() ? Number(diningLatitude) : null,
          longitude: diningLongitude.trim() ? Number(diningLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('dining_update_failed'));
      await fetchDining(selectedTrip!.id);
      await fetchItineraries(selectedTrip!.id);
      setShowDiningForm(false);
      setEditingDining(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('dining_update_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDining = async (item: TravelDining) => {
    if (!currentGroupId || !selectedTrip || !confirm(`"${item.name}" 먹거리를 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/dining/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || tt('dining_delete_failed'));
      }
      await fetchDining(selectedTrip.id);
      await fetchItineraries(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('dining_delete_failed'));
    }
  };

  if (!currentGroupId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <MapPin style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.6 }} />
          <p>{tt('select_group_first')}</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              backgroundColor: '#9333ea',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  const initialBudget = Number(selectedTrip?.budget) || 0;
  const additionSum = expenses.filter((e) => e.entry_type === 'addition').reduce((sum, e) => sum + Number(e.amount), 0);
  const expenseSum = expenses.filter((e) => e.entry_type !== 'addition').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalBudget = initialBudget + additionSum;
  const balance = totalBudget - expenseSum;
  const additionList = expenses.filter((e) => e.entry_type === 'addition');
  const expenseList = expenses.filter((e) => e.entry_type !== 'addition');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            padding: 8,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft style={{ width: 20, height: 20, color: '#475569' }} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{tt('title')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>{currentGroup?.name ?? tt('group_label')}</p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          color: '#991b1b',
        }}>
          {error}
        </div>
      )}

      {selectedTrip ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{selectedTrip.title}</h2>
                  {selectedTrip.destination && (
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin style={{ width: 16, height: 16 }} />
                      {selectedTrip.destination}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                    <Calendar style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                    {selectedTrip.start_date} ~ {selectedTrip.end_date}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    등록: {getDisplayName(selectedTrip.created_by)}
                    {selectedTrip.updated_by != null && ` · 수정: ${getDisplayName(selectedTrip.updated_by)}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormTitle(selectedTrip.title);
                      setFormDestination(selectedTrip.destination ?? '');
                      setFormStartDate(selectedTrip.start_date);
                      setFormEndDate(selectedTrip.end_date);
                      setFormBudget(selectedTrip.budget != null ? String(selectedTrip.budget) : '');
                      setShowTripEditForm(true);
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Pencil style={{ width: 16, height: 16 }} />
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrip(selectedTrip)}
                    style={{
                      padding: '8px 12px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                    삭제
                  </button>
                </div>
              </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet style={{ width: 18, height: 18 }} />
                  경비
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openExpenseForm(null, 'addition')}
                    style={{
                      padding: '6px 10px',
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + 경비추가
                  </button>
                  <button
                    type="button"
                    onClick={() => openExpenseForm(null, 'expense')}
                    style={{
                      padding: '6px 10px',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    - 지출추가
                  </button>
                </div>
                </div>
                <div style={{ marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, color: '#64748b' }}>{tt('total_budget')} <strong style={{ color: '#1e293b' }}>{totalBudget.toLocaleString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US')}{lang === 'ko' ? '원' : lang === 'ja' ? '円' : ''}</strong></span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: balance >= 0 ? '#9333ea' : '#dc2626' }}>
                    잔액 {balance.toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{tt('add_list')}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 16 }}>
                  {additionList.length === 0 ? (
                    <li style={{ padding: 10, color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 6 }}>{tt('no_additions')}</li>
                  ) : (
                    additionList.map((e) => (
                      <li key={e.id} style={{ padding: '8px 12px', marginBottom: 4, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span>{e.category || tt('addition')}</span>
                          <span style={{ fontWeight: 600, marginLeft: 8, color: '#15803d' }}>+{Number(e.amount).toLocaleString('ko-KR')}원</span>
                          {e.expense_date && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{e.expense_date}</span>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => openExpenseForm(e)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}><Pencil style={{ width: 14, height: 14 }} /></button>
                          <button type="button" onClick={() => handleDeleteExpense(e)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}><Trash2 style={{ width: 14, height: 14 }} /></button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{tt('expense_list')}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {expenseList.length === 0 ? (
                    <li style={{ padding: 10, color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 6 }}>{tt('no_expenses')}</li>
                  ) : (
                    expenseList.map((e) => (
                      <li key={e.id} style={{ padding: '8px 12px', marginBottom: 4, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span>{e.category || tt('other')}</span>
                          <span style={{ fontWeight: 600, marginLeft: 8, color: '#b91c1c' }}>-{Number(e.amount).toLocaleString('ko-KR')}원</span>
                          {e.expense_date && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{e.expense_date}</span>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => openExpenseForm(e)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}><Pencil style={{ width: 14, height: 14 }} /></button>
                          <button type="button" onClick={() => handleDeleteExpense(e)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}><Trash2 style={{ width: 14, height: 14 }} /></button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ListOrdered style={{ width: 18, height: 18 }} />
                  일정
                </h3>
                <button
                  type="button"
                  onClick={() => openItineraryForm(null)}
                  style={{ padding: '6px 10px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  + 일정 추가
                </button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {itineraries.length === 0 ? (
                  <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>{tt('no_itinerary')}</li>
                ) : (
                  itineraries.map((i) => (
                    <li
                      key={i.id}
                      style={{
                        padding: '10px 12px',
                        marginBottom: 6,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{i.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {i.day_date}
                          {(i.start_time || i.end_time) && <span style={{ marginLeft: 6 }}>· {(i.start_time || '--')} ~ {(i.end_time || '--')}</span>}
                        </div>
                        {i.description && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{i.description}</div>}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{tt('registered_by')}: {getDisplayName(i.created_by)}{i.updated_by != null && ` · ${tt('updated_by')}: ${getDisplayName(i.updated_by)}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                        {getGoogleMapsUrl(i) && (
                          <a href={getGoogleMapsUrl(i)!} target="_blank" rel="noopener noreferrer" style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title={tt('view_on_map')}><MapPin style={{ width: 14, height: 14 }} /></a>
                        )}
                        <button type="button" onClick={() => openItineraryForm(i)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}><Pencil style={{ width: 14, height: 14 }} /></button>
                        <button type="button" onClick={() => handleDeleteItinerary(i)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}><Trash2 style={{ width: 14, height: 14 }} /></button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Home style={{ width: 18, height: 18 }} />
                  숙소
                </h3>
                  <button
                    type="button"
                    onClick={() => openAccommodationForm(null)}
                    style={{
                      padding: '6px 10px',
                      background: '#9333ea',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + 숙소 추가
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {accommodations.length === 0 ? (
                    <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>{tt('no_accommodation')}</li>
                  ) : (
                    accommodations.map((a) => (
                      <li
                        key={a.id}
                        style={{
                          padding: '10px 12px',
                          marginBottom: 6,
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          fontSize: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{a.check_in_date} ~ {a.check_out_date}</div>
                          {a.address && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{a.address}</div>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            등록: {getDisplayName(a.created_by)}
                            {a.updated_by != null && ` · 수정: ${getDisplayName(a.updated_by)}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                          {getGoogleMapsUrl(a) && (
                            <a href={getGoogleMapsUrl(a)!} target="_blank" rel="noopener noreferrer" style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title={tt('view_on_map')}>
                              <MapPin style={{ width: 14, height: 14 }} />
                            </a>
                          )}
                          <button type="button" onClick={() => openAccommodationForm(a)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}>
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button type="button" onClick={() => handleDeleteAccommodation(a)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
            </div>

            <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UtensilsCrossed style={{ width: 18, height: 18 }} />
                    먹거리
                  </h3>
                  <button
                    type="button"
                    onClick={() => openDiningForm(null)}
                    style={{
                      padding: '6px 10px',
                      background: '#9333ea',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    + 먹거리 추가
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {dining.length === 0 ? (
                    <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>{tt('no_dining')}</li>
                  ) : (
                    dining.map((d) => (
                      <li
                        key={d.id}
                        style={{
                          padding: '10px 12px',
                          marginBottom: 6,
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          fontSize: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{d.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {d.day_date}
                            {d.time_at && <span style={{ marginLeft: 6 }}>{d.time_at}</span>}
                            {d.category && <span style={{ marginLeft: 6, color: '#64748b' }}>{d.category}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            등록: {getDisplayName(d.created_by)}
                            {d.updated_by != null && ` · 수정: ${getDisplayName(d.updated_by)}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                          {getGoogleMapsUrl(d) && (
                            <a href={getGoogleMapsUrl(d)!} target="_blank" rel="noopener noreferrer" style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title={tt('view_on_map')}>
                              <MapPin style={{ width: 14, height: 14 }} />
                            </a>
                          )}
                          <button type="button" onClick={() => openDiningForm(d)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}>
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button type="button" onClick={() => handleDeleteDining(d)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin style={{ width: 18, height: 18 }} />
                  위치 지도 (숙소·먹거리·관광지)
                </h3>
                <div
                  id="travel-planner-map"
                  style={{ width: '100%', height: 320, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' }}
                />
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  숙소·먹거리·일정에 위도/경도를 입력하면 지도에 표시됩니다. 파란색: 숙소, 초록색: 먹거리, 빨간색: 관광지
                </p>
              </div>
            )}

          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            {loading && urlTripId ? (
              <div style={{ color: '#64748b' }}>
                <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                여행 정보를 불러오는 중...
              </div>
            ) : (
              <>
                <MapPin style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.6, color: '#94a3b8' }} />
                <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{tt('select_or_add_trip')}</p>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  style={{
                    marginTop: 16,
                    padding: '10px 20px',
                    backgroundColor: '#9333ea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  대시보드로 이동
                </button>
              </>
            )}
          </div>
        )}

      {showTripForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && router.push('/dashboard')}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{tt('add_trip')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => router.push('/dashboard')}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={handleCreateTrip} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_title')}</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder={tt('placeholder_trip_title')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_destination')}</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                placeholder={tt('placeholder_destination')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_start_date')}</label>
              <div style={{ overflow: 'hidden', borderRadius: 8, marginBottom: 12 }}>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    minHeight: 40,
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_end_date')}</label>
              <div style={{ overflow: 'hidden', borderRadius: 8, marginBottom: 20 }}>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  required
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    minHeight: 40,
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#9333ea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTripEditForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowTripEditForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{tt('edit_trip')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowTripEditForm(false)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={handleUpdateTrip} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_title')}</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder={tt('placeholder_trip_title')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_destination')}</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                placeholder={tt('placeholder_destination')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_start_date')}</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                required
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_end_date')}</label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                required
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_budget')}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder={tt('placeholder_budget')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 20,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTripEditForm(false)}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#9333ea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showItineraryForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowItineraryForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{editingItinerary ? tt('edit_itinerary') : tt('add_itinerary')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowItineraryForm(false)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={editingItinerary ? handleUpdateItinerary : handleCreateItinerary} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_date')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="date"
                  value={itineraryDayDate}
                  onChange={(e) => setItineraryDayDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 40,
                    padding: '10px 12px',
                    border: 'none',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_start_time')}</label>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <input
                      type="time"
                      value={itineraryStartTime}
                      onChange={(e) => setItineraryStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 40,
                        padding: '10px 12px',
                        border: 'none',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_end_time')}</label>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <input
                      type="time"
                      value={itineraryEndTime}
                      onChange={(e) => setItineraryEndTime(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 40,
                        padding: '10px 12px',
                        border: 'none',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_title')}</label>
              <input
                value={itineraryTitle}
                onChange={(e) => setItineraryTitle(e.target.value)}
                required
                placeholder={tt('placeholder_itinerary_title')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_description')}</label>
              <textarea
                value={itineraryDescription}
                onChange={(e) => setItineraryDescription(e.target.value)}
                placeholder={tt('placeholder_optional')}
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_address')}</label>
              <input
                ref={itineraryAddressInputRef}
                value={itineraryAddress}
                onChange={(e) => setItineraryAddress(e.target.value)}
                placeholder={tt('placeholder_search_address')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={itineraryLatitude}
                    onChange={(e) => setItineraryLatitude(e.target.value)}
                    placeholder={tt('placeholder_lat')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={itineraryLongitude}
                    onChange={(e) => setItineraryLongitude(e.target.value)}
                    placeholder={tt('placeholder_lng')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowItineraryForm(false)}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#9333ea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  {editingItinerary ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowExpenseForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{editingExpense ? tt('edit_expense') : tt('add_expense')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowExpenseForm(false)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_category')}</label>
              <input
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                placeholder={tt('placeholder_category')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_amount')}</label>
              <input
                type="number"
                min={0}
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                placeholder="0"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_date')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 40,
                    padding: '10px 12px',
                    border: 'none',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_memo')}</label>
              <input
                value={expenseMemo}
                onChange={(e) => setExpenseMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 20,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 18px',
                    background: '#9333ea',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  {editingExpense ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccommodationForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowAccommodationForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{editingAccommodation ? tt('edit_accommodation') : tt('add_accommodation')}</h3>
              <button type="button" disabled={submitting} onClick={() => setShowAccommodationForm(false)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={editingAccommodation ? handleUpdateAccommodation : handleCreateAccommodation} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_acc_name')}</label>
              <input
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                required
                placeholder={tt('placeholder_acc_name')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_checkin')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="date"
                  value={accCheckIn}
                  onChange={(e) => setAccCheckIn(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: 'none', fontSize: 14, outline: 'none' }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_checkout')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="date"
                  value={accCheckOut}
                  onChange={(e) => setAccCheckOut(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: 'none', fontSize: 14, outline: 'none' }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_address')}</label>
              <input
                ref={accAddressInputRef}
                value={accAddress}
                onChange={(e) => setAccAddress(e.target.value)}
                placeholder={tt('placeholder_search_address')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLatitude}
                    onChange={(e) => setAccLatitude(e.target.value)}
                    placeholder={tt('placeholder_lat')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLongitude}
                    onChange={(e) => setAccLongitude(e.target.value)}
                    placeholder={tt('placeholder_lng')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_memo')}</label>
              <input
                value={accMemo}
                onChange={(e) => setAccMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAccommodationForm(false)} disabled={submitting} style={{ padding: '10px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>{tt('cancel')}</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  {editingAccommodation ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDiningForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowDiningForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{editingDining ? tt('edit_dining') : tt('add_dining')}</h3>
              <button type="button" disabled={submitting} onClick={() => setShowDiningForm(false)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={editingDining ? handleUpdateDining : handleCreateDining} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_name')}</label>
              <input
                value={diningName}
                onChange={(e) => setDiningName(e.target.value)}
                required
                placeholder={tt('placeholder_dining_name')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_date')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="date"
                  value={diningDayDate}
                  onChange={(e) => setDiningDayDate(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: 'none', fontSize: 14, outline: 'none' }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_time')}</label>
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <input
                  type="time"
                  value={diningTime}
                  onChange={(e) => setDiningTime(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: 'none', fontSize: 14, outline: 'none' }}
                />
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_dining_category')}</label>
              <input
                value={diningCategory}
                onChange={(e) => setDiningCategory(e.target.value)}
                placeholder={tt('placeholder_select')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_address')}</label>
              <input
                ref={diningAddressInputRef}
                value={diningAddress}
                onChange={(e) => setDiningAddress(e.target.value)}
                placeholder={tt('placeholder_search_address')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>위도</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLatitude}
                    onChange={(e) => setDiningLatitude(e.target.value)}
                    placeholder={tt('placeholder_lat')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>경도</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLongitude}
                    onChange={(e) => setDiningLongitude(e.target.value)}
                    placeholder={tt('placeholder_lng')}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_memo')}</label>
              <input
                value={diningMemo}
                onChange={(e) => setDiningMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDiningForm(false)} disabled={submitting} style={{ padding: '10px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>{tt('cancel')}</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  {editingDining ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
