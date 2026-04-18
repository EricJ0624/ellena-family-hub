'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import type { TravelTrip, TravelItinerary, TravelExpense, TravelAccommodation, TravelDining, TravelAttraction, TravelTransport } from '@/lib/modules/travel-planner/types';
import { formatCurrencyOptionLabel, getAllowedCurrencyCodes } from '@/lib/currencies';
import { formatMoneyAmount } from '@/lib/format-currency';
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
  Landmark,
  Car,
  ChevronDown,
  ChevronRight,
  FileDown,
} from 'lucide-react';
import {
  deleteAttachment,
  listAttachments,
  uploadFeatureAttachments,
  validateAttachmentFile,
  type UploadJob,
  type UploadedAttachment,
} from '@/lib/feature-attachments-client';

const API_BASE = '/api/v1/travel';

const TRIP_CURRENCY_OPTIONS = [...getAllowedCurrencyCodes()];

const LOCALE_FOR_MONEY: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
};

export function TravelPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const tt = (key: keyof import('@/lib/translations/travel').TravelTranslations) => getTravelTranslation(lang, key);
  const { currentGroupId, currentGroup, userRole, isOwner } = useGroup();
  const isTripAdmin = userRole === 'ADMIN' || isOwner;
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TravelTrip | null>(null);
  const [itineraries, setItineraries] = useState<TravelItinerary[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [accommodations, setAccommodations] = useState<TravelAccommodation[]>([]);
  const [dining, setDining] = useState<TravelDining[]>([]);
  const [attractions, setAttractions] = useState<TravelAttraction[]>([]);
  const [transports, setTransports] = useState<TravelTransport[]>([]);
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
  const [accPlaceId, setAccPlaceId] = useState<string | null>(null);
  const [accDirectInputMode, setAccDirectInputMode] = useState(false);
  const [showDiningForm, setShowDiningForm] = useState(false);
  /** 일정 추가 시 구분 선택 (숙소/먹거리/관광지/교통/기타) → 해당 폼 열기 */
  const [showScheduleAddTypePicker, setShowScheduleAddTypePicker] = useState(false);
  const [accommodationFormFromSchedule, setAccommodationFormFromSchedule] = useState(false);
  const [diningFormFromSchedule, setDiningFormFromSchedule] = useState(false);
  const [editingDining, setEditingDining] = useState<TravelDining | null>(null);
  const [diningName, setDiningName] = useState('');
  const [diningDayDate, setDiningDayDate] = useState('');
  const [diningTime, setDiningTime] = useState('');
  const [diningCategory, setDiningCategory] = useState('');
  const [diningMemo, setDiningMemo] = useState('');
  const [diningAddress, setDiningAddress] = useState('');
  const [diningLatitude, setDiningLatitude] = useState('');
  const [diningLongitude, setDiningLongitude] = useState('');
  const [diningPlaceId, setDiningPlaceId] = useState<string | null>(null);
  const [diningDirectInputMode, setDiningDirectInputMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [itineraryAddress, setItineraryAddress] = useState('');
  const [itineraryLatitude, setItineraryLatitude] = useState('');
  const [itineraryLongitude, setItineraryLongitude] = useState('');
  /** 선택한 장소명(Place Details Basic) — 구글 검색 링크용 */
  const [accPlaceName, setAccPlaceName] = useState('');
  const [diningPlaceName, setDiningPlaceName] = useState('');
  const [itineraryPlaceName, setItineraryPlaceName] = useState('');
  const [itineraryPlaceType, setItineraryPlaceType] = useState<'' | 'attraction' | 'transport_air' | 'transport_car' | 'transport_bike' | 'other'>('attraction');
  const [sectionOpenAttraction, setSectionOpenAttraction] = useState(false);
  const [sectionOpenDining, setSectionOpenDining] = useState(false);
  const [sectionOpenAccommodation, setSectionOpenAccommodation] = useState(false);
  const [sectionOpenTransport, setSectionOpenTransport] = useState(false);

  const [showAttractionForm, setShowAttractionForm] = useState(false);
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [editingAttraction, setEditingAttraction] = useState<TravelAttraction | null>(null);
  const [editingTransport, setEditingTransport] = useState<TravelTransport | null>(null);
  const [attractionName, setAttractionName] = useState('');
  const [attractionDayDate, setAttractionDayDate] = useState('');
  const [attractionStartTime, setAttractionStartTime] = useState('');
  const [attractionEndTime, setAttractionEndTime] = useState('');
  const [attractionAddress, setAttractionAddress] = useState('');
  const [attractionDescription, setAttractionDescription] = useState('');
  const [attractionLatitude, setAttractionLatitude] = useState('');
  const [attractionLongitude, setAttractionLongitude] = useState('');
  const [attractionPlaceName, setAttractionPlaceName] = useState('');
  const [attractionPlaceId, setAttractionPlaceId] = useState<string | null>(null);
  const [attractionDirectInputMode, setAttractionDirectInputMode] = useState(false);
  const [transportType, setTransportType] = useState<'air' | 'train' | 'car' | 'bike'>('air');
  const [transportDayDate, setTransportDayDate] = useState('');
  const [transportStartTime, setTransportStartTime] = useState('');
  const [transportEndTime, setTransportEndTime] = useState('');
  const [transportDeparture, setTransportDeparture] = useState('');
  const [transportArrival, setTransportArrival] = useState('');
  const [transportDeparturePlaceId, setTransportDeparturePlaceId] = useState<string | null>(null);
  const [transportArrivalPlaceId, setTransportArrivalPlaceId] = useState<string | null>(null);
  const [transportDirectInputMode, setTransportDirectInputMode] = useState(false);
  const [transportDistanceKm, setTransportDistanceKm] = useState('');
  const [transportMemo, setTransportMemo] = useState('');

  const [formTitle, setFormTitle] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formTripCurrency, setFormTripCurrency] = useState('KRW');
  const [travelAttachmentTarget, setTravelAttachmentTarget] = useState<{ entityType: 'travel_trip' | 'travel_expense'; entityId: string } | null>(null);
  const [travelAttachments, setTravelAttachments] = useState<UploadedAttachment[]>([]);
  const [travelAttachmentUploading, setTravelAttachmentUploading] = useState(false);
  const [travelAttachmentJobs, setTravelAttachmentJobs] = useState<UploadJob[]>([]);
  const [travelAttachmentFilter, setTravelAttachmentFilter] = useState('');
  const travelAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const travelAttachmentAbortRef = useRef<AbortController | null>(null);

  /** userId → 표시명 (nickname || email || '멤버'). 그룹 멤버 + 프로필에서 로드 */
  const [memberDisplayNames, setMemberDisplayNames] = useState<Map<string, string>>(new Map());
  /** 지도 사용 시에만 로드 (위치 공유와 동일) */
  const [showTravelMap, setShowTravelMap] = useState(false);

  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const selectedTripIdRef = useRef<string | null>(null);
  selectedTripIdRef.current = selectedTrip?.id ?? null;
  const travelMapRef = useRef<{ setCenter: (c: { lat: number; lng: number }) => void; fitBounds: (b: unknown) => void } | null>(null);
  const travelMapMarkersRef = useRef<unknown[]>([]);
  const travelMapScriptLoadedRef = useRef(false);
  /** 숙소·먹거리·관광지: Places Autocomplete는 이름 입력란에 연결 */
  const accNameInputRef = useRef<HTMLInputElement>(null);
  const diningNameInputRef = useRef<HTMLInputElement>(null);
  const attractionNameInputRef = useRef<HTMLInputElement>(null);
  const itineraryAddressInputRef = useRef<HTMLInputElement>(null);
  const transportDepartureInputRef = useRef<HTMLInputElement>(null);
  const transportArrivalInputRef = useRef<HTMLInputElement>(null);
  const placesServiceContainerRef = useRef<HTMLDivElement>(null);
  const placesServiceRef = useRef<{ getDetails: (req: unknown, cb: (place: unknown, status: string) => void) => void } | null>(null);
  const accSessionTokenRef = useRef<unknown>(null);
  const diningSessionTokenRef = useRef<unknown>(null);
  const itinerarySessionTokenRef = useRef<unknown>(null);
  const attractionSessionTokenRef = useRef<unknown>(null);
  const transportSessionTokenRef = useRef<unknown>(null);
  const [placesApiReady, setPlacesApiReady] = useState(false);
  /** 선택지 A: 이름 blur 시 미선택 입력 정리 (place_changed보다 늦게 실행) */
  const accNameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diningNameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attractionNameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accommodationFormRef = useRef<HTMLFormElement>(null);
  const diningFormRef = useRef<HTMLFormElement>(null);
  const attractionFormRef = useRef<HTMLFormElement>(null);
  const transportFormRef = useRef<HTMLFormElement>(null);

  const BLUR_CONFIRM_MS = 220;

  const clearAccGooglePlaceFields = useCallback(() => {
    setAccPlaceId(null);
    setAccPlaceName('');
    setAccAddress('');
    setAccLatitude('');
    setAccLongitude('');
  }, []);

  const clearDiningGooglePlaceFields = useCallback(() => {
    setDiningPlaceId(null);
    setDiningPlaceName('');
    setDiningAddress('');
    setDiningLatitude('');
    setDiningLongitude('');
  }, []);

  const clearAttractionGooglePlaceFields = useCallback(() => {
    setAttractionPlaceId(null);
    setAttractionPlaceName('');
    setAttractionAddress('');
    setAttractionLatitude('');
    setAttractionLongitude('');
  }, []);

  const cancelAccNameBlurConfirm = useCallback(() => {
    if (accNameBlurTimerRef.current) {
      clearTimeout(accNameBlurTimerRef.current);
      accNameBlurTimerRef.current = null;
    }
  }, []);

  const cancelDiningNameBlurConfirm = useCallback(() => {
    if (diningNameBlurTimerRef.current) {
      clearTimeout(diningNameBlurTimerRef.current);
      diningNameBlurTimerRef.current = null;
    }
  }, []);

  const cancelAttractionNameBlurConfirm = useCallback(() => {
    if (attractionNameBlurTimerRef.current) {
      clearTimeout(attractionNameBlurTimerRef.current);
      attractionNameBlurTimerRef.current = null;
    }
  }, []);

  /** 타이머 실행 시점의 최신 스냅샷 (place_changed 직후 ref가 갱신됨) */
  const accBlurSnapRef = useRef({
    direct: false,
    pid: null as string | null,
    pname: '',
    name: '',
  });
  const diningBlurSnapRef = useRef({
    direct: false,
    pid: null as string | null,
    pname: '',
    name: '',
  });
  const attractionBlurSnapRef = useRef({
    direct: false,
    pid: null as string | null,
    pname: '',
    name: '',
  });
  accBlurSnapRef.current = {
    direct: accDirectInputMode,
    pid: accPlaceId,
    pname: accPlaceName,
    name: accName,
  };
  diningBlurSnapRef.current = {
    direct: diningDirectInputMode,
    pid: diningPlaceId,
    pname: diningPlaceName,
    name: diningName,
  };
  attractionBlurSnapRef.current = {
    direct: attractionDirectInputMode,
    pid: attractionPlaceId,
    pname: attractionPlaceName,
    name: attractionName,
  };

  const scheduleAccNameBlurConfirm = useCallback(() => {
    cancelAccNameBlurConfirm();
    accNameBlurTimerRef.current = setTimeout(() => {
      accNameBlurTimerRef.current = null;
      const { direct, pid, pname, name } = accBlurSnapRef.current;
      if (direct || pid === '__existing__') return;
      const n = name.trim();
      if (!pid) {
        if (n) {
          clearAccGooglePlaceFields();
          setAccName('');
        }
        return;
      }
      if (pname.trim() && n !== pname.trim()) {
        clearAccGooglePlaceFields();
        setAccName('');
      }
    }, BLUR_CONFIRM_MS);
  }, [cancelAccNameBlurConfirm, clearAccGooglePlaceFields]);

  const scheduleDiningNameBlurConfirm = useCallback(() => {
    cancelDiningNameBlurConfirm();
    diningNameBlurTimerRef.current = setTimeout(() => {
      diningNameBlurTimerRef.current = null;
      const { direct, pid, pname, name } = diningBlurSnapRef.current;
      if (direct || pid === '__existing__') return;
      const n = name.trim();
      if (!pid) {
        if (n) {
          clearDiningGooglePlaceFields();
          setDiningName('');
        }
        return;
      }
      if (pname.trim() && n !== pname.trim()) {
        clearDiningGooglePlaceFields();
        setDiningName('');
      }
    }, BLUR_CONFIRM_MS);
  }, [cancelDiningNameBlurConfirm, clearDiningGooglePlaceFields]);

  const scheduleAttractionNameBlurConfirm = useCallback(() => {
    cancelAttractionNameBlurConfirm();
    attractionNameBlurTimerRef.current = setTimeout(() => {
      attractionNameBlurTimerRef.current = null;
      const { direct, pid, pname, name } = attractionBlurSnapRef.current;
      if (direct || pid === '__existing__') return;
      const n = name.trim();
      if (!pid) {
        if (n) {
          clearAttractionGooglePlaceFields();
          setAttractionName('');
        }
        return;
      }
      if (pname.trim() && n !== pname.trim()) {
        clearAttractionGooglePlaceFields();
        setAttractionName('');
      }
    }, BLUR_CONFIRM_MS);
  }, [cancelAttractionNameBlurConfirm, clearAttractionGooglePlaceFields]);

  useEffect(() => () => {
    cancelAccNameBlurConfirm();
    cancelDiningNameBlurConfirm();
    cancelAttractionNameBlurConfirm();
  }, [cancelAccNameBlurConfirm, cancelAttractionNameBlurConfirm, cancelDiningNameBlurConfirm]);

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(tt('auth_required'));
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const tripCurrencyCode = useMemo(
    () => (selectedTrip?.currency || 'KRW').trim().toUpperCase() || 'KRW',
    [selectedTrip?.currency],
  );
  const localeForMoney = LOCALE_FOR_MONEY[lang] || 'en-US';
  const fmtTripMoney = useCallback(
    (n: number) => formatMoneyAmount(n, tripCurrencyCode, localeForMoney),
    [tripCurrencyCode, localeForMoney],
  );

  /**
   * 구글 지도 웹(소비자용) 링크 — Maps Platform API 호출·과금 없음.
   * 업체 시트가 열리도록 place_id 또는 이름+주소 검색을 우선하고, 좌표 URL은 최후 수단.
   */
  const getGoogleMapsUrl = useCallback(
    (item: {
      name?: string | null;
      title?: string | null;
      address?: string | null;
      place_id?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      const pid = typeof item.place_id === 'string' ? item.place_id.trim() : '';
      if (pid) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`place_id:${pid}`)}`;
      }
      const label = (typeof item.name === 'string' ? item.name.trim() : '') || (typeof item.title === 'string' ? item.title.trim() : '');
      const addr = typeof item.address === 'string' ? item.address.trim() : '';
      const textQuery = [label, addr].filter(Boolean).join(' ').trim();
      if (textQuery) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textQuery)}`;
      }
      if (item.latitude != null && item.longitude != null) {
        return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
      }
      return null;
    },
    [],
  );

  /** 목록 행용: 구글 웹검색 URL (Maps Platform 과금 없음). 이름·제목 + 주소 등을 합쳐 쿼리 생성 */
  const buildGoogleWebSearchUrl = useCallback((...parts: (string | null | undefined)[]) => {
    const q = parts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!q) return null;
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }, []);

  const fetchPlaceCache = useCallback(async (placeId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/place-cache?placeId=${encodeURIComponent(placeId)}`, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.cached ? json : null;
  }, [getAuthHeaders]);

  const savePlaceCache = useCallback(async (place: any) => {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/place-cache', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.place_id,
          name: place.name ?? undefined,
          latitude: place.geometry?.location?.lat?.(),
          longitude: place.geometry?.location?.lng?.(),
          formatted_address: place.formatted_address ?? undefined,
        }),
      });
    } catch (_) {}
  }, [getAuthHeaders]);

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

  const fetchAttractions = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/attractions?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_attraction_failed'));
      setAttractions(json.data ?? []);
    } catch {
      setAttractions([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  const fetchTransports = useCallback(async (tripId: string) => {
    if (!currentGroupId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${tripId}/transports?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('load_transport_failed'));
      setTransports(json.data ?? []);
    } catch {
      setTransports([]);
    }
  }, [currentGroupId, getAuthHeaders]);

  const loadTravelAttachments = useCallback(async (entityType: 'travel_trip' | 'travel_expense', entityId: string) => {
    if (!currentGroupId) return;
    const rows = await listAttachments({
      groupId: currentGroupId,
      entityType,
      entityIds: [entityId],
    });
    setTravelAttachments(rows);
  }, [currentGroupId]);

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

  // 자동완성/지도 공용 스크립트: 필요한 시점에만 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY;
    if (!apiKey) return;
    const needPlacesApi =
      showTravelMap ||
      (showAccommodationForm && !accDirectInputMode) ||
      (showDiningForm && !diningDirectInputMode) ||
      showItineraryForm ||
      (showAttractionForm && !attractionDirectInputMode) ||
      (showTransportForm && !transportDirectInputMode);
    if (!needPlacesApi) return;
    if ((window as any).google?.maps?.places?.Autocomplete) {
      setPlacesApiReady(true);
      return;
    }
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      const iv = setInterval(() => {
        if ((window as any).google?.maps?.places?.Autocomplete) {
          clearInterval(iv);
          setPlacesApiReady(true);
        }
      }, 100);
      return () => clearInterval(iv);
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      travelMapScriptLoadedRef.current = true;
      setPlacesApiReady(true);
    };
    document.head.appendChild(script);
  }, [
    showTravelMap,
    showAccommodationForm,
    showDiningForm,
    showItineraryForm,
    showAttractionForm,
    showTransportForm,
    accDirectInputMode,
    diningDirectInputMode,
    attractionDirectInputMode,
    transportDirectInputMode,
  ]);

  // 여행 플래너 지도: 사용할 때만 초기화/표시. 숙소·먹거리·일정(관광지) 위치 표시
  useEffect(() => {
    if (!showTravelMap || typeof window === 'undefined' || !selectedTrip) {
      travelMapMarkersRef.current.forEach((m: any) => m?.setMap?.(null));
      travelMapMarkersRef.current = [];
      travelMapRef.current = null;
      return;
    }
    if (!placesApiReady) return;

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

      // 이모지 마커: 🏨 숙소 🍽️ 식당 🏛️ 관광지 ✈️ 비행기 🚗 자동차 🚲 바이크
      const addMarker = (lat: number, lng: number, title: string, emoji?: string) => {
        const pos = { lat, lng };
        bounds.extend(pos);
        hasAny = true;
        const marker = new g.maps.Marker({
          map,
          position: pos,
          title,
          label: emoji ? { text: emoji, color: '#333', fontSize: '18px' } : undefined,
          icon: emoji ? undefined : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });
        travelMapMarkersRef.current.push(marker);
      };
      accommodations.forEach((a) => {
        if (a.latitude != null && a.longitude != null) addMarker(a.latitude, a.longitude, a.name, '🏨');
      });
      dining.forEach((d) => {
        if (d.latitude != null && d.longitude != null) addMarker(d.latitude, d.longitude, d.name, '🍽️');
      });
      attractions.forEach((a) => {
        if (a.latitude != null && a.longitude != null) addMarker(a.latitude, a.longitude, a.name, '🏛️');
      });
      transports.forEach((t) => {
        let emoji = '🚗';
        if (t.transport_type === 'air') emoji = '✈️';
        else if (t.transport_type === 'train') emoji = '🚂';
        else if (t.transport_type === 'car') emoji = '🚗';
        else if (t.transport_type === 'bike') emoji = '🚲';
        const title = t.departure && t.arrival ? `${t.departure} → ${t.arrival}` : '교통';
        if (t.departure || t.arrival) {
          // 출발지나 도착지 중 하나라도 있으면 지도에 표시 (좌표는 없을 수 있음)
          // 실제로는 departure/arrival에는 좌표가 없으므로 생략
        }
      });
      itineraries.forEach((i) => {
        if (i.latitude != null && i.longitude != null) {
          addMarker(i.latitude, i.longitude, i.title, '📌');
        }
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
    const t = setInterval(() => {
      if ((window as any).google?.maps?.Map) {
        clearInterval(t);
        initMapAndMarkers();
      }
    }, 100);
    return () => clearInterval(t);
  }, [showTravelMap, selectedTrip, accommodations, dining, attractions, transports, itineraries, placesApiReady]);

  const attachPlacesAutocomplete = useCallback((params: {
    enabled: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    sessionTokenRef: React.MutableRefObject<unknown>;
    onSelect: (payload: { placeId: string; address: string; latitude?: number; longitude?: number; placeName: string }) => void;
  }) => {
    if (!params.enabled || !placesApiReady) return () => {};
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return () => {};
    const container = placesServiceContainerRef.current;
    if (!container) return () => {};
    if (!placesServiceRef.current) placesServiceRef.current = new g.maps.places.PlacesService(container);
    const service = placesServiceRef.current;
    const AutocompleteSessionToken = g.maps?.places?.AutocompleteSessionToken;
    if (AutocompleteSessionToken) params.sessionTokenRef.current = new AutocompleteSessionToken();
    const el = params.inputRef.current;
    if (!el) return () => {};
    const opts: { types: string[]; sessionToken?: unknown } = { types: ['establishment', 'geocode'] };
    if (params.sessionTokenRef.current) opts.sessionToken = params.sessionTokenRef.current;
    const autocomplete = new g.maps.places.Autocomplete(el, opts);
    const listener = autocomplete.addListener('place_changed', () => {
      cancelAccNameBlurConfirm();
      cancelDiningNameBlurConfirm();
      cancelAttractionNameBlurConfirm();
      const place = autocomplete.getPlace();
      if (!place?.place_id) return;
      // 자동완성 목록에서 고른 줄과 동일한 표기(입력창 값). place_id는 place에서만 사용.
      const chosenLabel = (params.inputRef.current?.value ?? '').trim();
      const fallbackFromPlace =
        typeof place.name === 'string' && place.name.trim() ? place.name.trim() : '';
      (async () => {
        const cached = await fetchPlaceCache(place.place_id).catch(() => null);
        if (cached) {
          params.onSelect({
            placeId: place.place_id,
            address: cached.formatted_address ?? '',
            latitude: cached.latitude ?? undefined,
            longitude: cached.longitude ?? undefined,
            placeName: chosenLabel || fallbackFromPlace || (cached.name ?? ''),
          });
          if (AutocompleteSessionToken) params.sessionTokenRef.current = new AutocompleteSessionToken();
          return;
        }
        if (!service) return;
        const req: { placeId: string; fields: string[]; sessionToken?: unknown } = {
          placeId: place.place_id,
          fields: ['place_id', 'name', 'geometry', 'formatted_address'],
        };
        if (params.sessionTokenRef.current) req.sessionToken = params.sessionTokenRef.current;
        service.getDetails(req, (placeDetails: any, status: string) => {
          if (status !== 'OK' || !placeDetails) return;
          const placeName =
            chosenLabel ||
            fallbackFromPlace ||
            (typeof placeDetails.name === 'string' ? placeDetails.name : '') ||
            '';
          params.onSelect({
            placeId: placeDetails.place_id,
            address: placeDetails.formatted_address ?? '',
            latitude: placeDetails.geometry?.location?.lat?.(),
            longitude: placeDetails.geometry?.location?.lng?.(),
            placeName,
          });
          if (AutocompleteSessionToken) params.sessionTokenRef.current = new AutocompleteSessionToken();
          savePlaceCache({ ...placeDetails, name: placeName });
        });
      })();
    });
    return () => {
      listener?.remove?.();
      if (AutocompleteSessionToken) params.sessionTokenRef.current = new AutocompleteSessionToken();
    };
  }, [placesApiReady, fetchPlaceCache, savePlaceCache, cancelAccNameBlurConfirm, cancelDiningNameBlurConfirm, cancelAttractionNameBlurConfirm]);

  // Places Autocomplete: 숙소 폼 (layout: 모달 DOM·ref 반영 직후 연결)
  useLayoutEffect(() => attachPlacesAutocomplete({
    enabled: showAccommodationForm && !!selectedTrip && !accDirectInputMode,
    inputRef: accNameInputRef,
    sessionTokenRef: accSessionTokenRef,
    onSelect: ({ placeId, address, latitude, longitude, placeName }) => {
      setAccPlaceId(placeId);
      setAccName(placeName);
      setAccAddress(address);
      setAccLatitude(latitude != null ? String(latitude) : '');
      setAccLongitude(longitude != null ? String(longitude) : '');
      setAccPlaceName(placeName);
    },
  }), [showAccommodationForm, selectedTrip?.id, accDirectInputMode, attachPlacesAutocomplete]);

  // Places Autocomplete: 먹거리 폼
  useLayoutEffect(() => attachPlacesAutocomplete({
    enabled: showDiningForm && !!selectedTrip && !diningDirectInputMode,
    inputRef: diningNameInputRef,
    sessionTokenRef: diningSessionTokenRef,
    onSelect: ({ placeId, address, latitude, longitude, placeName }) => {
      setDiningPlaceId(placeId);
      setDiningName(placeName);
      setDiningAddress(address);
      setDiningLatitude(latitude != null ? String(latitude) : '');
      setDiningLongitude(longitude != null ? String(longitude) : '');
      setDiningPlaceName(placeName);
    },
  }), [showDiningForm, selectedTrip?.id, diningDirectInputMode, attachPlacesAutocomplete]);

  // Places Autocomplete: 일정 폼
  useEffect(() => attachPlacesAutocomplete({
    enabled: showItineraryForm,
    inputRef: itineraryAddressInputRef,
    sessionTokenRef: itinerarySessionTokenRef,
    onSelect: ({ address, latitude, longitude, placeName }) => {
      setItineraryAddress(address);
      setItineraryLatitude(latitude != null ? String(latitude) : '');
      setItineraryLongitude(longitude != null ? String(longitude) : '');
      setItineraryPlaceName(placeName);
    },
  }), [showItineraryForm, attachPlacesAutocomplete]);

  // Places Autocomplete: 관광지 폼 (UI 유지, 핵심 로직만 동일 적용)
  useLayoutEffect(() => attachPlacesAutocomplete({
    enabled: showAttractionForm && !!selectedTrip && !attractionDirectInputMode,
    inputRef: attractionNameInputRef,
    sessionTokenRef: attractionSessionTokenRef,
    onSelect: ({ placeId, address, latitude, longitude, placeName }) => {
      setAttractionPlaceId(placeId);
      setAttractionName(placeName);
      setAttractionAddress(address);
      setAttractionLatitude(latitude != null ? String(latitude) : '');
      setAttractionLongitude(longitude != null ? String(longitude) : '');
      setAttractionPlaceName(placeName);
    },
  }), [showAttractionForm, selectedTrip?.id, attractionDirectInputMode, attachPlacesAutocomplete]);

  // Places Autocomplete: 교통 출발/도착
  useEffect(() => {
    if (!showTransportForm || transportDirectInputMode) return () => {};
    const cleanupDeparture = attachPlacesAutocomplete({
      enabled: true,
      inputRef: transportDepartureInputRef,
      sessionTokenRef: transportSessionTokenRef,
      onSelect: ({ placeId, address }) => {
        setTransportDeparturePlaceId(placeId);
        setTransportDeparture(address);
      },
    });
    const cleanupArrival = attachPlacesAutocomplete({
      enabled: true,
      inputRef: transportArrivalInputRef,
      sessionTokenRef: transportSessionTokenRef,
      onSelect: ({ placeId, address }) => {
        setTransportArrivalPlaceId(placeId);
        setTransportArrival(address);
      },
    });
    return () => {
      cleanupDeparture();
      cleanupArrival();
    };
  }, [showTransportForm, transportDirectInputMode, attachPlacesAutocomplete]);

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
      fetchAttractions(selectedTrip.id);
      fetchTransports(selectedTrip.id);
    } else {
      setItineraries([]);
      setExpenses([]);
      setAccommodations([]);
      setDining([]);
      setAttractions([]);
      setTransports([]);
    }
  }, [selectedTrip, fetchItineraries, fetchExpenses, fetchAccommodations, fetchDining, fetchAttractions, fetchTransports]);

  useEffect(() => {
    if (!travelAttachmentTarget) {
      setTravelAttachments([]);
      return;
    }
    void loadTravelAttachments(travelAttachmentTarget.entityType, travelAttachmentTarget.entityId);
  }, [travelAttachmentTarget, loadTravelAttachments]);

  const handlePickTravelAttachment = async (e: { target: HTMLInputElement }) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !currentGroupId || !travelAttachmentTarget) return;
    for (const file of files) {
      const err = validateAttachmentFile(file);
      if (err) {
        alert(err);
        e.target.value = '';
        return;
      }
    }
    setTravelAttachmentUploading(true);
    const abort = new AbortController();
    travelAttachmentAbortRef.current = abort;
    try {
      await uploadFeatureAttachments({
        groupId: currentGroupId,
        featureType: 'travel',
        entityType: travelAttachmentTarget.entityType,
        entityId: travelAttachmentTarget.entityId,
        files,
        maxConcurrent: 2,
        retryCount: 1,
        signal: abort.signal,
        onJobsChange: setTravelAttachmentJobs,
      });
      await loadTravelAttachments(travelAttachmentTarget.entityType, travelAttachmentTarget.entityId);
    } catch (error) {
      alert(error instanceof Error ? error.message : tt('load_failed'));
    } finally {
      setTravelAttachmentUploading(false);
      travelAttachmentAbortRef.current = null;
      e.target.value = '';
    }
  };

  /** 실시간 반영: 테이블당 채널 1개만 사용 (한 채널에 여러 postgres_changes 시 server/client bindings mismatch) */
  useEffect(() => {
    if (!currentGroupId) return;

    const groupId = currentGroupId;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    const chTrips = supabase
      .channel(`travel_trips:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_trips', filter: `group_id=eq.${groupId}` }, (payload: { eventType?: string; type?: string; old?: { id?: string }; new?: unknown }) => {
        fetchTrips();
        const isDelete = payload?.eventType === 'DELETE' || payload?.type === 'DELETE' || (payload?.old?.id != null && payload?.new == null);
        if (isDelete && payload?.old?.id === selectedTripIdRef.current) setSelectedTrip(null);
      })
      .subscribe();
    channels.push(chTrips);

    const chItineraries = supabase
      .channel(`travel_itineraries:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_itineraries', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchItineraries(tripId);
      })
      .subscribe();
    channels.push(chItineraries);

    const chExpenses = supabase
      .channel(`travel_expenses:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_expenses', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchExpenses(tripId);
      })
      .subscribe();
    channels.push(chExpenses);

    const chAccommodations = supabase
      .channel(`travel_accommodations:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_accommodations', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchAccommodations(tripId);
      })
      .subscribe();
    channels.push(chAccommodations);

    const chDining = supabase
      .channel(`travel_dining:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_dining', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchDining(tripId);
      })
      .subscribe();
    channels.push(chDining);

    const chAttractions = supabase
      .channel(`travel_attractions:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_attractions', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchAttractions(tripId);
      })
      .subscribe();
    channels.push(chAttractions);

    const chTransports = supabase
      .channel(`travel_transports:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'travel_transports', filter: `group_id=eq.${groupId}` }, () => {
        const tripId = selectedTripIdRef.current;
        if (tripId) fetchTransports(tripId);
      })
      .subscribe();
    channels.push(chTransports);

    channelsRef.current = channels;

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [currentGroupId, fetchTrips, fetchItineraries, fetchExpenses, fetchAccommodations, fetchDining, fetchAttractions, fetchTransports]);

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
          ...(isTripAdmin ? { currency: formTripCurrency.trim().toUpperCase() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('create_failed'));
      setFormTitle('');
      setFormDestination('');
      setFormStartDate('');
      setFormEndDate('');
      setFormTripCurrency('KRW');
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
    const prevCur = (selectedTrip.currency || 'KRW').trim().toUpperCase() || 'KRW';
    const nextCur = formTripCurrency.trim().toUpperCase() || 'KRW';
    if (isTripAdmin && nextCur !== prevCur) {
      if (!confirm(tt('trip_currency_change_confirm'))) return;
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        groupId: currentGroupId,
        title: formTitle.trim(),
        destination: formDestination.trim() || null,
        start_date: formStartDate,
        end_date: formEndDate,
        budget: formBudget.trim() ? Number(formBudget) : null,
      };
      if (isTripAdmin) {
        body.currency = nextCur;
      }
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('update_failed'));
      if (json.data) setSelectedTrip(json.data);
      await fetchTrips();
      await fetchExpenses(selectedTrip.id);
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

  type ItineraryPlaceTypeOption = 'attraction' | 'transport_air' | 'transport_car' | 'transport_bike' | 'other';
  const openItineraryForm = (item: TravelItinerary | null, defaultPlaceType?: ItineraryPlaceTypeOption) => {
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
      setItineraryPlaceName('');
      setItineraryPlaceType((item.place_type as '' | ItineraryPlaceTypeOption) || 'attraction');
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
      setItineraryPlaceName('');
      setItineraryPlaceType(defaultPlaceType ?? 'attraction');
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
          place_type: itineraryPlaceType || undefined,
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
          place_type: itineraryPlaceType || null,
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

  const handleRemoveFromItinerary = async (item: typeof sortedItineraries[0]) => {
    if (!currentGroupId || !selectedTrip || !confirm(`"${item.title}" 항목을 일정에서 제거할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      let res: Response;
      
      if (item.type === 'accommodation') {
        res = await fetch(`${API_BASE}/accommodations/${item.id}?groupId=${currentGroupId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ show_in_itinerary: false }),
        });
        if (res.ok) await fetchAccommodations(selectedTrip.id);
      } else if (item.type === 'dining') {
        res = await fetch(`${API_BASE}/dining/${item.id}?groupId=${currentGroupId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ show_in_itinerary: false }),
        });
        if (res.ok) await fetchDining(selectedTrip.id);
      } else if (item.type === 'attraction') {
        res = await fetch(`${API_BASE}/attractions/${item.id}?groupId=${currentGroupId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ show_in_itinerary: false }),
        });
        if (res.ok) await fetchAttractions(selectedTrip.id);
      } else if (item.type === 'transport') {
        res = await fetch(`${API_BASE}/transports/${item.id}?groupId=${currentGroupId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ show_in_itinerary: false }),
        });
        if (res.ok) await fetchTransports(selectedTrip.id);
      } else {
        res = await fetch(`${API_BASE}/itineraries/${item.id}?groupId=${currentGroupId}`, {
          method: 'DELETE',
          headers,
        });
        if (res.ok) await fetchItineraries(selectedTrip.id);
      }
      
      if (!res!.ok) {
        const json = await res!.json();
        throw new Error(json.error || '일정에서 제거하는데 실패했습니다.');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '일정에서 제거하는데 실패했습니다.');
    }
  };

  const handleEditFromItinerary = (item: typeof sortedItineraries[0]) => {
    if (!selectedTrip) return;
    if (item.type === 'accommodation') {
      const acc = accommodations.find((a) => a.id === item.id);
      if (acc) openAccommodationForm(acc);
    } else if (item.type === 'dining') {
      const d = dining.find((x) => x.id === item.id);
      if (d) openDiningForm(d);
    } else if (item.type === 'attraction') {
      const a = attractions.find((x) => x.id === item.id);
      if (a) openAttractionForm(a);
    } else if (item.type === 'transport') {
      const t = transports.find((x) => x.id === item.id);
      if (t) openTransportForm(t);
    } else {
      const it = itineraries.find((x) => x.id === item.id);
      if (it) openItineraryForm(it, (it.place_type as ItineraryPlaceTypeOption | null) ?? 'other');
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
      {
        const pid = item.place_id?.trim() || null;
        if (pid) {
          setAccPlaceId(pid);
          setAccPlaceName(item.name);
        } else if (item.address?.trim()) {
          setAccPlaceId('__existing__');
          setAccPlaceName('');
        } else {
          setAccPlaceId(null);
          setAccPlaceName('');
        }
      }
      setAccDirectInputMode(false);
    } else {
      setEditingAccommodation(null);
      setAccName('');
      setAccCheckIn('');
      setAccCheckOut('');
      setAccAddress('');
      setAccMemo('');
      setAccLatitude('');
      setAccLongitude('');
      setAccPlaceName('');
      setAccPlaceId(null);
      setAccDirectInputMode(false);
    }
    setAccommodationFormFromSchedule(false);
    setShowAccommodationForm(true);
  };

  const handleCreateAccommodation = async (e: React.FormEvent, showInItinerary: boolean) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !accName.trim() || !accCheckIn || !accCheckOut) {
      alert(tt('alert_acc_required'));
      return;
    }
    if (!accDirectInputMode && accName.trim()) {
      if (!accPlaceId) {
        alert('숙소명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (accPlaceId !== '__existing__' && (!accPlaceName.trim() || accName.trim() !== accPlaceName.trim())) {
        alert('숙소명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
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
          place_id: accDirectInputMode ? undefined : (accPlaceId ?? undefined),
          latitude: accLatitude.trim() ? Number(accLatitude) : undefined,
          longitude: accLongitude.trim() ? Number(accLongitude) : undefined,
          show_in_itinerary: showInItinerary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('accommodation_add_failed'));
      await fetchAccommodations(selectedTrip.id);
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
    if (!accDirectInputMode && accName.trim()) {
      if (!accPlaceId) {
        alert('숙소명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (accPlaceId !== '__existing__' && (!accPlaceName.trim() || accName.trim() !== accPlaceName.trim())) {
        alert('숙소명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
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
          place_id: accDirectInputMode ? null : accPlaceId,
          latitude: accLatitude.trim() ? Number(accLatitude) : null,
          longitude: accLongitude.trim() ? Number(accLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('accommodation_update_failed'));
      await fetchAccommodations(selectedTrip!.id);
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
      {
        const pid = item.place_id?.trim() || null;
        if (pid) {
          setDiningPlaceId(pid);
          setDiningPlaceName(item.name);
        } else if (item.address?.trim()) {
          setDiningPlaceId('__existing__');
          setDiningPlaceName('');
        } else {
          setDiningPlaceId(null);
          setDiningPlaceName('');
        }
      }
      setDiningDirectInputMode(false);
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
      setDiningPlaceName('');
      setDiningPlaceId(null);
      setDiningDirectInputMode(false);
    }
    setDiningFormFromSchedule(false);
    setShowDiningForm(true);
  };

  const handleCreateDining = async (e: React.FormEvent, showInItinerary: boolean) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !diningName.trim() || !diningDayDate) {
      alert(tt('alert_dining_required'));
      return;
    }
    if (!diningDirectInputMode && diningName.trim()) {
      if (!diningPlaceId) {
        alert('먹거리 이름은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (diningPlaceId !== '__existing__' && (!diningPlaceName.trim() || diningName.trim() !== diningPlaceName.trim())) {
        alert('먹거리 이름은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
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
          place_id: diningDirectInputMode ? undefined : (diningPlaceId ?? undefined),
          latitude: diningLatitude.trim() ? Number(diningLatitude) : undefined,
          longitude: diningLongitude.trim() ? Number(diningLongitude) : undefined,
          show_in_itinerary: showInItinerary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('dining_add_failed'));
      await fetchDining(selectedTrip.id);
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
    if (!diningDirectInputMode && diningName.trim()) {
      if (!diningPlaceId) {
        alert('먹거리 이름은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (diningPlaceId !== '__existing__' && (!diningPlaceName.trim() || diningName.trim() !== diningPlaceName.trim())) {
        alert('먹거리 이름은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
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
          place_id: diningDirectInputMode ? null : diningPlaceId,
          latitude: diningLatitude.trim() ? Number(diningLatitude) : null,
          longitude: diningLongitude.trim() ? Number(diningLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || tt('dining_update_failed'));
      await fetchDining(selectedTrip!.id);
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
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : tt('dining_delete_failed'));
    }
  };

  const openAttractionForm = (item: TravelAttraction | null, showInItinerary = false) => {
    if (item) {
      setEditingAttraction(item);
      setAttractionName(item.name);
      setAttractionDayDate(item.day_date);
      setAttractionStartTime(item.start_time ?? '');
      setAttractionEndTime(item.end_time ?? '');
      setAttractionAddress(item.address ?? '');
      setAttractionDescription(item.description ?? '');
      setAttractionLatitude(item.latitude != null ? String(item.latitude) : '');
      setAttractionLongitude(item.longitude != null ? String(item.longitude) : '');
      {
        const pid = item.place_id?.trim() || null;
        if (pid) {
          setAttractionPlaceId(pid);
          setAttractionPlaceName(item.name);
        } else if (item.address?.trim()) {
          setAttractionPlaceId('__existing__');
          setAttractionPlaceName('');
        } else {
          setAttractionPlaceId(null);
          setAttractionPlaceName('');
        }
      }
      setAttractionDirectInputMode(false);
    } else {
      setEditingAttraction(null);
      setAttractionName('');
      setAttractionDayDate('');
      setAttractionStartTime('');
      setAttractionEndTime('');
      setAttractionAddress('');
      setAttractionDescription('');
      setAttractionLatitude('');
      setAttractionLongitude('');
      setAttractionPlaceName('');
      setAttractionPlaceId(null);
      setAttractionDirectInputMode(false);
    }
    setShowAttractionForm(true);
  };

  const handleCreateAttraction = async (e: React.FormEvent, showInItinerary: boolean) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !attractionName.trim() || !attractionDayDate) {
      alert('관광지명과 날짜는 필수입니다.');
      return;
    }
    if (!attractionDirectInputMode && attractionName.trim()) {
      if (!attractionPlaceId) {
        alert('관광지명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (attractionPlaceId !== '__existing__' && (!attractionPlaceName.trim() || attractionName.trim() !== attractionPlaceName.trim())) {
        alert('관광지명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/attractions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          name: attractionName.trim(),
          day_date: attractionDayDate,
          start_time: attractionStartTime.trim() || undefined,
          end_time: attractionEndTime.trim() || undefined,
          address: attractionAddress.trim() || undefined,
          place_id: attractionDirectInputMode ? undefined : (attractionPlaceId ?? undefined),
          description: attractionDescription.trim() || undefined,
          latitude: attractionLatitude.trim() ? Number(attractionLatitude) : undefined,
          longitude: attractionLongitude.trim() ? Number(attractionLongitude) : undefined,
          show_in_itinerary: showInItinerary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '관광지 추가에 실패했습니다.');
      await fetchAttractions(selectedTrip.id);
      setShowAttractionForm(false);
      setEditingAttraction(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '관광지 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttraction || !currentGroupId || !attractionName.trim() || !attractionDayDate) {
      alert('관광지명과 날짜는 필수입니다.');
      return;
    }
    if (!attractionDirectInputMode && attractionName.trim()) {
      if (!attractionPlaceId) {
        alert('관광지명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
      if (attractionPlaceId !== '__existing__' && (!attractionPlaceName.trim() || attractionName.trim() !== attractionPlaceName.trim())) {
        alert('관광지명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.');
        return;
      }
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/attractions/${editingAttraction.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: attractionName.trim(),
          day_date: attractionDayDate,
          start_time: attractionStartTime.trim() || null,
          end_time: attractionEndTime.trim() || null,
          address: attractionAddress.trim() || null,
          place_id: attractionDirectInputMode ? null : attractionPlaceId,
          description: attractionDescription.trim() || null,
          latitude: attractionLatitude.trim() ? Number(attractionLatitude) : null,
          longitude: attractionLongitude.trim() ? Number(attractionLongitude) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '관광지 수정에 실패했습니다.');
      await fetchAttractions(selectedTrip!.id);
      setShowAttractionForm(false);
      setEditingAttraction(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '관광지 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttraction = async (item: TravelAttraction) => {
    if (!currentGroupId || !selectedTrip || !confirm(`"${item.name}" 관광지를 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/attractions/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '관광지 삭제에 실패했습니다.');
      }
      await fetchAttractions(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '관광지 삭제에 실패했습니다.');
    }
  };

  const openTransportForm = (item: TravelTransport | null, type: 'air' | 'train' | 'car' | 'bike' = 'air', showInItinerary = false) => {
    if (item) {
      setEditingTransport(item);
      setTransportType(item.transport_type);
      setTransportDayDate(item.day_date);
      setTransportStartTime(item.start_time ?? '');
      setTransportEndTime(item.end_time ?? '');
      setTransportDeparture(item.departure ?? '');
      setTransportArrival(item.arrival ?? '');
      setTransportDeparturePlaceId(item.departure_place_id ?? (item.departure ? '__existing__' : null));
      setTransportArrivalPlaceId(item.arrival_place_id ?? (item.arrival ? '__existing__' : null));
      setTransportDistanceKm(item.distance_km != null ? String(item.distance_km) : '');
      setTransportMemo(item.memo ?? '');
      setTransportDirectInputMode(
        (!!item.departure && !item.departure_place_id) || (!!item.arrival && !item.arrival_place_id)
      );
    } else {
      setEditingTransport(null);
      setTransportType(type);
      setTransportDayDate('');
      setTransportStartTime('');
      setTransportEndTime('');
      setTransportDeparture('');
      setTransportArrival('');
      setTransportDeparturePlaceId(null);
      setTransportArrivalPlaceId(null);
      setTransportDistanceKm('');
      setTransportMemo('');
      setTransportDirectInputMode(false);
    }
    setShowTransportForm(true);
  };

  const handleCreateTransport = async (e: React.FormEvent, showInItinerary: boolean) => {
    e.preventDefault();
    if (!currentGroupId || !selectedTrip || !transportDayDate) {
      alert('날짜는 필수입니다.');
      return;
    }
    if (!transportDirectInputMode) {
      if (transportDeparture.trim() && !transportDeparturePlaceId) {
        alert('출발지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.');
        return;
      }
      if (transportArrival.trim() && !transportArrivalPlaceId) {
        alert('도착지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.');
        return;
      }
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips/${selectedTrip.id}/transports`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          groupId: currentGroupId,
          transport_type: transportType,
          day_date: transportDayDate,
          start_time: transportStartTime.trim() || undefined,
          end_time: transportEndTime.trim() || undefined,
          departure: transportDeparture.trim() || undefined,
          arrival: transportArrival.trim() || undefined,
          departure_place_id: transportDirectInputMode ? null : transportDeparturePlaceId,
          arrival_place_id: transportDirectInputMode ? null : transportArrivalPlaceId,
          distance_km: transportDistanceKm.trim() ? Number(transportDistanceKm) : undefined,
          memo: transportMemo.trim() || undefined,
          show_in_itinerary: showInItinerary,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '교통 추가에 실패했습니다.');
      await fetchTransports(selectedTrip.id);
      setShowTransportForm(false);
      setEditingTransport(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '교통 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransport || !currentGroupId || !transportDayDate) {
      alert('날짜는 필수입니다.');
      return;
    }
    if (!transportDirectInputMode) {
      if (transportDeparture.trim() && !transportDeparturePlaceId) {
        alert('출발지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.');
        return;
      }
      if (transportArrival.trim() && !transportArrivalPlaceId) {
        alert('도착지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.');
        return;
      }
    }
    try {
      setSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/transports/${editingTransport.id}?groupId=${currentGroupId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          transport_type: transportType,
          day_date: transportDayDate,
          start_time: transportStartTime.trim() || null,
          end_time: transportEndTime.trim() || null,
          departure: transportDeparture.trim() || null,
          arrival: transportArrival.trim() || null,
          departure_place_id: transportDirectInputMode ? null : transportDeparturePlaceId,
          arrival_place_id: transportDirectInputMode ? null : transportArrivalPlaceId,
          distance_km: transportDistanceKm.trim() ? Number(transportDistanceKm) : null,
          memo: transportMemo.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '교통 수정에 실패했습니다.');
      await fetchTransports(selectedTrip!.id);
      setShowTransportForm(false);
      setEditingTransport(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '교통 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransport = async (item: TravelTransport) => {
    if (!currentGroupId || !selectedTrip || !confirm(`이 교통수단을 삭제할까요?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/transports/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '교통 삭제에 실패했습니다.');
      }
      await fetchTransports(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '교통 삭제에 실패했습니다.');
    }
  };

  const sortedItineraries = useMemo(() => {
    const allItems: Array<{
      id: string;
      type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
      day_date: string;
      start_time?: string | null;
      end_time?: string | null;
      title: string;
      description?: string | null;
      address?: string | null;
      place_id?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      category?: string | null;
      departure?: string | null;
      arrival?: string | null;
      distance_km?: number | null;
      transport_type?: 'air' | 'train' | 'car' | 'bike';
    }> = [];

    accommodations.filter(a => a.show_in_itinerary).forEach(a => {
      allItems.push({
        id: a.id,
        type: 'accommodation',
        day_date: a.check_in_date,
        start_time: null,
        end_time: null,
        title: a.name,
        description: a.memo,
        address: a.address,
        place_id: a.place_id ?? null,
        latitude: a.latitude,
        longitude: a.longitude,
      });
    });

    dining.filter(d => d.show_in_itinerary).forEach(d => {
      allItems.push({
        id: d.id,
        type: 'dining',
        day_date: d.day_date,
        start_time: d.time_at,
        end_time: null,
        title: d.name,
        description: d.memo,
        address: d.address,
        place_id: d.place_id ?? null,
        latitude: d.latitude,
        longitude: d.longitude,
        category: d.category,
      });
    });

    attractions.filter(a => a.show_in_itinerary).forEach(a => {
      allItems.push({
        id: a.id,
        type: 'attraction',
        day_date: a.day_date,
        start_time: a.start_time,
        end_time: a.end_time,
        title: a.name,
        description: a.description,
        address: a.address,
        place_id: a.place_id ?? null,
        latitude: a.latitude,
        longitude: a.longitude,
      });
    });

    transports.filter(t => t.show_in_itinerary).forEach(t => {
      allItems.push({
        id: t.id,
        type: 'transport',
        day_date: t.day_date,
        start_time: t.start_time,
        end_time: t.end_time,
        title: `${t.departure || ''} → ${t.arrival || ''}`,
        description: t.memo,
        departure: t.departure,
        arrival: t.arrival,
        distance_km: t.distance_km,
        transport_type: t.transport_type,
      });
    });

    itineraries.forEach(i => {
      allItems.push({
        id: i.id,
        type: 'other',
        day_date: i.day_date,
        start_time: i.start_time,
        end_time: i.end_time,
        title: i.title,
        description: i.description,
        address: i.address,
        latitude: i.latitude,
        longitude: i.longitude,
      });
    });

    return allItems.sort((a, b) => {
      if (a.day_date !== b.day_date) return a.day_date.localeCompare(b.day_date);
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [accommodations, dining, attractions, transports, itineraries]);

  const getItineraryTypeLabel = (type: string, transport_type?: 'air' | 'train' | 'car' | 'bike') => {
    if (type === 'accommodation') return '숙소';
    if (type === 'dining') return '식당';
    if (type === 'attraction') return '관광지';
    if (type === 'transport') {
      if (transport_type === 'air') return '비행기';
      if (transport_type === 'train') return '기차';
      if (transport_type === 'car') return '자동차';
      if (transport_type === 'bike') return '바이크';
      return '교통';
    }
    return '기타';
  };

  const downloadItineraryPdf = useCallback(() => {
    if (!selectedTrip) return;
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      const margin = 20;
      const pageW = doc.internal.pageSize.getWidth();
      const lineH = 6;
      let y = 24;

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(selectedTrip.title, margin, y);
      y += lineH + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      if (selectedTrip.destination) {
        doc.text(selectedTrip.destination, margin, y);
        y += lineH;
      }
      doc.text(`${selectedTrip.start_date} ~ ${selectedTrip.end_date}`, margin, y);
      y += lineH + 10;

      if (sortedItineraries.length === 0) {
        doc.setFontSize(10);
        doc.text('등록된 일정이 없습니다.', margin, y);
        doc.save(`itinerary-${selectedTrip.title.replace(/[^\w\u3131-\uD7A3]/g, '-')}.pdf`);
        return;
      }

      type ItineraryItem = typeof sortedItineraries[0];
      const byDay = new Map<string, ItineraryItem[]>();
      for (const i of sortedItineraries) {
        const day = i.day_date || '';
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(i);
      }
      const days = Array.from(byDay.keys()).sort();

      for (let idx = 0; idx < days.length; idx++) {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }
        const day = days[idx];
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, y - 4, pageW - margin, y - 4);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Day ${idx + 1}  ·  ${day}`, margin, y);
        y += lineH + 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        for (const i of byDay.get(day)!) {
          if (y > 272) {
            doc.addPage();
            y = 20;
          }
          const label = getItineraryTypeLabel(i.type, i.transport_type);
          const timeStr = (i.start_time || i.end_time) ? `  ${i.start_time || '--'} ~ ${i.end_time || '--'}` : '';
          doc.text(`[${label}] ${i.title}${timeStr}`, margin, y);
          y += lineH;
          if (i.description && i.description.trim()) {
            const lines = doc.splitTextToSize(i.description.trim(), pageW - margin * 2 - 8);
            doc.setFontSize(9);
            for (const line of lines) {
              if (y > 272) {
                doc.addPage();
                y = 20;
              }
              doc.text(line, margin + 6, y);
              y += 5;
            }
            doc.setFontSize(10);
            y += 2;
          }
          y += 2;
        }
        y += 6;
      }
      doc.save(`itinerary-${selectedTrip.title.replace(/[^\w\u3131-\uD7A3]/g, '-')}.pdf`);
    });
  }, [selectedTrip, sortedItineraries]);

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
      <div ref={placesServiceContainerRef} style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} aria-hidden="true" />
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
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                    {tt('label_trip_currency')}: <strong style={{ color: '#334155' }}>{tripCurrencyCode}</strong>
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    등록: {getDisplayName(selectedTrip.created_by)}
                    {selectedTrip.updated_by != null && ` · 수정: ${getDisplayName(selectedTrip.updated_by)}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setTravelAttachmentTarget({ entityType: 'travel_trip', entityId: selectedTrip.id })}
                    style={{
                      padding: '8px 12px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    사진
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormTitle(selectedTrip.title);
                      setFormDestination(selectedTrip.destination ?? '');
                      setFormStartDate(selectedTrip.start_date);
                      setFormEndDate(selectedTrip.end_date);
                      setFormBudget(selectedTrip.budget != null ? String(selectedTrip.budget) : '');
                      setFormTripCurrency((selectedTrip.currency || 'KRW').trim().toUpperCase() || 'KRW');
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

            {travelAttachmentTarget && (
              <div style={{ marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>첨부 사진</strong>
                  <button type="button" onClick={() => setTravelAttachmentTarget(null)} style={{ border: 'none', background: '#e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>닫기</button>
                </div>
                <input
                  ref={travelAttachmentInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  capture="environment"
                  onChange={handlePickTravelAttachment}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => travelAttachmentInputRef.current?.click()}
                  disabled={travelAttachmentUploading}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  {travelAttachmentUploading ? '업로드 중…' : '사진 추가'}
                </button>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>자동 최적화 업로드</span>
                {travelAttachmentUploading && (
                  <button
                    type="button"
                    onClick={() => travelAttachmentAbortRef.current?.abort()}
                    style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    취소
                  </button>
                )}
                <input
                  value={travelAttachmentFilter}
                  onChange={(e) => setTravelAttachmentFilter(e.target.value)}
                  placeholder="파일명 필터"
                  style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 120 }}
                />
                {travelAttachmentJobs.length > 0 && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 4, width: '100%' }}>
                    {travelAttachmentJobs.map((job) => (
                      <div key={job.id} style={{ fontSize: 12, color: '#475569' }}>
                        {job.fileName} · {job.status}{job.status === 'uploading' ? ` ${Math.round(job.progress)}%` : ''}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                  {travelAttachments
                    .filter((att) => !travelAttachmentFilter || att.original_filename.toLowerCase().includes(travelAttachmentFilter.toLowerCase()))
                    .map((att) => (
                    <div key={att.id} style={{ position: 'relative' }}>
                      <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={att.thumbnail_url || att.image_url} alt={att.original_filename} style={{ width: '100%', height: 78, objectFit: 'cover', borderRadius: 6 }} />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentGroupId) return;
                          void (async () => {
                            try {
                              await deleteAttachment(currentGroupId, att.id);
                              if (travelAttachmentTarget) {
                                await loadTravelAttachments(travelAttachmentTarget.entityType, travelAttachmentTarget.entityId);
                              }
                            } catch (e) {
                              alert(e instanceof Error ? e.message : tt('load_failed'));
                            }
                          })();
                        }}
                        style={{ position: 'absolute', top: 4, right: 4, border: 'none', borderRadius: '999px', width: 18, height: 18, background: 'rgba(239,68,68,0.95)', color: '#fff', cursor: 'pointer' }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <span style={{ fontSize: 15, color: '#64748b' }}>
                    {tt('total_budget')}{' '}
                    <strong style={{ color: '#1e293b' }}>{fmtTripMoney(totalBudget)}</strong>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: balance >= 0 ? '#9333ea' : '#dc2626' }}>
                    잔액 {fmtTripMoney(balance)}
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
                          <span style={{ fontWeight: 600, marginLeft: 8, color: '#15803d' }}>+{fmtTripMoney(Number(e.amount))}</span>
                          {e.expense_date && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{e.expense_date}</span>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => setTravelAttachmentTarget({ entityType: 'travel_expense', entityId: e.id })} style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#1d4ed8' }} title="사진">📷</button>
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
                          <span style={{ fontWeight: 600, marginLeft: 8, color: '#b91c1c' }}>-{fmtTripMoney(Number(e.amount))}</span>
                          {e.expense_date && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>{e.expense_date}</span>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button type="button" onClick={() => setTravelAttachmentTarget({ entityType: 'travel_expense', entityId: e.id })} style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#1d4ed8' }} title="사진">📷</button>
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
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={downloadItineraryPdf}
                    style={{ padding: '6px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <FileDown style={{ width: 14, height: 14 }} />
                    {tt('view_itinerary_pdf')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleAddTypePicker(true)}
                    style={{ padding: '6px 10px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + 일정 추가
                  </button>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sortedItineraries.length === 0 ? (
                  <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>{tt('no_itinerary')}</li>
                ) : (
                  sortedItineraries.map((i) => (
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
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          <span style={{ marginRight: 6 }}>
                            {i.type === 'accommodation' ? '🏨' : 
                             i.type === 'dining' ? '🍽️' : 
                             i.type === 'attraction' ? '🏛️' : 
                             i.type === 'transport' ? 
                               (i.transport_type === 'air' ? '✈️' : 
                                i.transport_type === 'train' ? '🚂' : 
                                i.transport_type === 'car' ? '🚗' : 
                                i.transport_type === 'bike' ? '🚲' : '🚗') : 
                             '📌'}
                          </span>
                          {i.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          {i.day_date}
                          {(i.start_time || i.end_time) && <span style={{ marginLeft: 6 }}>· {(i.start_time || '--')} ~ {(i.end_time || '--')}</span>}
                        </div>
                        {i.description && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{i.description}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {getGoogleMapsUrl(i) && (
                            <a
                              href={getGoogleMapsUrl(i)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                              title={tt('view_on_map')}
                            >
                              <MapPin style={{ width: 14, height: 14 }} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditFromItinerary(i)}
                            style={{ padding: 6, background: '#e0f2fe', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#0369a1' }}
                            title={tt('edit_itinerary')}
                          >
                            <Pencil style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromItinerary(i)}
                            style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }}
                            title={tt('remove_from_itinerary')}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                        {buildGoogleWebSearchUrl(i.title, i.address) && (
                          <a href={buildGoogleWebSearchUrl(i.title, i.address)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                            {tt('link_google_search')}
                          </a>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setSectionOpenAttraction((v) => !v)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sectionOpenAttraction ? <ChevronDown style={{ width: 18, height: 18 }} /> : <ChevronRight style={{ width: 18, height: 18 }} />}
                  <Landmark style={{ width: 18, height: 18 }} />
                  관광지 ({attractions.filter(a => !a.show_in_itinerary).length})
                </span>
              </button>
              {sectionOpenAttraction && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => openAttractionForm(null, false)}
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
                      + 관광지 추가
                    </button>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {attractions.filter(a => !a.show_in_itinerary).length === 0 ? (
                      <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>등록된 관광지가 없습니다.</li>
                    ) : (
                      attractions.filter(a => !a.show_in_itinerary).map((a) => (
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
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              <span style={{ marginRight: 6 }}>🏛️</span>
                              {a.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                              {a.day_date}
                              {(a.start_time || a.end_time) && <span style={{ marginLeft: 6 }}>· {(a.start_time || '--')} ~ {(a.end_time || '--')}</span>}
                            </div>
                            {a.description && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{a.description}</div>}
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{tt('registered_by')}: {getDisplayName(a.created_by)}{a.updated_by != null && ` · ${tt('updated_by')}: ${getDisplayName(a.updated_by)}`}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {getGoogleMapsUrl(a) && (
                                <a href={getGoogleMapsUrl(a)!} target="_blank" rel="noopener noreferrer" style={{ padding: 6, background: '#eff6ff', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title={tt('view_on_map')}><MapPin style={{ width: 14, height: 14 }} /></a>
                              )}
                              <button type="button" onClick={() => openAttractionForm(a)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}><Pencil style={{ width: 14, height: 14 }} /></button>
                              <button type="button" onClick={() => handleDeleteAttraction(a)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}><Trash2 style={{ width: 14, height: 14 }} /></button>
                            </div>
                            {buildGoogleWebSearchUrl(a.name, a.address) && (
                              <a href={buildGoogleWebSearchUrl(a.name, a.address)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                                {tt('link_google_search')}
                              </a>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setSectionOpenDining((v) => !v)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sectionOpenDining ? <ChevronDown style={{ width: 18, height: 18 }} /> : <ChevronRight style={{ width: 18, height: 18 }} />}
                  <UtensilsCrossed style={{ width: 18, height: 18 }} />
                  먹거리 ({dining.length})
                </span>
              </button>
              {sectionOpenDining && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
                            {buildGoogleWebSearchUrl(d.name, d.address) && (
                              <a href={buildGoogleWebSearchUrl(d.name, d.address)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                                {tt('link_google_search')}
                              </a>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setSectionOpenAccommodation((v) => !v)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sectionOpenAccommodation ? <ChevronDown style={{ width: 18, height: 18 }} /> : <ChevronRight style={{ width: 18, height: 18 }} />}
                  <Home style={{ width: 18, height: 18 }} />
                  숙소 ({accommodations.length})
                </span>
              </button>
              {sectionOpenAccommodation && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
                            {buildGoogleWebSearchUrl(a.name, a.address) && (
                              <a href={buildGoogleWebSearchUrl(a.name, a.address)!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                                {tt('link_google_search')}
                              </a>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setSectionOpenTransport((v) => !v)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sectionOpenTransport ? <ChevronDown style={{ width: 18, height: 18 }} /> : <ChevronRight style={{ width: 18, height: 18 }} />}
                  <Car style={{ width: 18, height: 18 }} />
                  교통 ({transports.filter(t => !t.show_in_itinerary).length})
                </span>
              </button>
              {sectionOpenTransport && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'air', false)}
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
                      + 비행기
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'train', false)}
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
                      + 기차
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'car', false)}
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
                      + 자동차
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'bike', false)}
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
                      + 바이크
                    </button>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {transports.filter(t => !t.show_in_itinerary).length === 0 ? (
                      <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>등록된 교통편이 없습니다.</li>
                    ) : (
                      transports.filter(t => !t.show_in_itinerary).map((t) => (
                        <li
                          key={t.id}
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
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              <span style={{ marginRight: 6 }}>{t.transport_type === 'air' ? '✈️' : t.transport_type === 'train' ? '🚆' : t.transport_type === 'car' ? '🚗' : '🚲'}</span>
                              {t.departure || ''} → {t.arrival || ''}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                              {t.day_date}
                              {(t.start_time || t.end_time) && <span style={{ marginLeft: 6 }}>· {(t.start_time || '--')} ~ {(t.end_time || '--')}</span>}
                              {t.distance_km && <span style={{ marginLeft: 6 }}>· {t.distance_km}km</span>}
                            </div>
                            {t.memo && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{t.memo}</div>}
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{tt('registered_by')}: {getDisplayName(t.created_by)}{t.updated_by != null && ` · ${tt('updated_by')}: ${getDisplayName(t.updated_by)}`}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                            <button type="button" onClick={() => openTransportForm(t)} style={{ padding: 6, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#475569' }} title={tt('edit')}><Pencil style={{ width: 14, height: 14 }} /></button>
                            <button type="button" onClick={() => handleDeleteTransport(t)} style={{ padding: 6, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }} title={tt('delete')}><Trash2 style={{ width: 14, height: 14 }} /></button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
            </div>

            {process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin style={{ width: 18, height: 18 }} />
                  위치 지도 (숙소·먹거리·관광지)
                </h3>
                {!showTravelMap ? (
                  <div
                    style={{
                      width: '100%',
                      height: 320,
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundImage: 'linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.82)), url(/images/map-placeholder-bg.png)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      color: '#64748b',
                      padding: 20,
                    }}
                  >
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
                      📍 지도
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, textAlign: 'center', maxWidth: 320, marginBottom: 16 }}>
                      {tt('map_placeholder_desc')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTravelMap(true)}
                      style={{
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
                      {tt('show_map_btn')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      id="travel-planner-map"
                      style={{ width: '100%', height: 320, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f1f5f9' }}
                    />
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tt('map_hint')}
                      <button
                        type="button"
                        onClick={() => setShowTravelMap(false)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {tt('hide_map_btn')}
                      </button>
                    </p>
                  </>
                )}
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
              {isTripAdmin && (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_trip_currency')}</label>
                  <select
                    value={formTripCurrency}
                    onChange={(e) => setFormTripCurrency(e.target.value)}
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
                  >
                    {TRIP_CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {formatCurrencyOptionLabel(c, localeForMoney)}
                      </option>
                    ))}
                  </select>
                </>
              )}
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
                  marginBottom: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
              {isTripAdmin && (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_trip_currency')}</label>
                  <select
                    value={formTripCurrency}
                    onChange={(e) => setFormTripCurrency(e.target.value)}
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
                  >
                    {TRIP_CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {formatCurrencyOptionLabel(c, localeForMoney)}
                      </option>
                    ))}
                  </select>
                </>
              )}
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

      {showScheduleAddTypePicker && selectedTrip && (
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
          onClick={() => setShowScheduleAddTypePicker(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 380,
              minWidth: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{tt('schedule_add_type_prompt')}</h3>
              <button type="button" onClick={() => setShowScheduleAddTypePicker(false)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleAddTypePicker(false);
                  setAccommodationFormFromSchedule(true);
                  setShowAccommodationForm(true);
                }}
                style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                🏨 {tt('add_accommodation')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleAddTypePicker(false);
                  setDiningFormFromSchedule(true);
                  setShowDiningForm(true);
                }}
                style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                🍽️ {tt('add_dining')}
              </button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'attraction'); }} style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>🏛️ {tt('place_type_attraction')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_air'); }} style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>✈️ {tt('place_type_transport_air')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_car'); }} style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>🚗 {tt('place_type_transport_car')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_bike'); }} style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>🚲 {tt('place_type_transport_bike')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'other'); }} style={{ padding: '12px 16px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>📌 {tt('place_type_other')}</button>
            </div>
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_place_type')}</label>
              <select
                value={itineraryPlaceType}
                onChange={(e) => setItineraryPlaceType(e.target.value as '' | 'attraction' | 'transport_air' | 'transport_car' | 'transport_bike' | 'other')}
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
              >
                <option value="attraction">{tt('place_type_attraction')} 🏛️</option>
                <option value="transport_air">{tt('place_type_transport_air')} ✈️</option>
                <option value="transport_car">{tt('place_type_transport_car')} 🚗</option>
                <option value="transport_bike">{tt('place_type_transport_bike')} 🚲</option>
                <option value="other">{tt('place_type_other')} 📌</option>
              </select>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_address')}</label>
              <input
                ref={itineraryAddressInputRef}
                value={itineraryAddress}
                onChange={(e) => setItineraryAddress(e.target.value)}
                placeholder={tt('placeholder_search_address')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 4, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              {itineraryPlaceName && (
                <div style={{ marginBottom: 12 }}>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(itineraryPlaceName)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details style={{ marginBottom: 20 }}>
                <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>좌표 입력 (고급)</summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
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
              </details>
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
            <form ref={accommodationFormRef} onSubmit={(e) => { e.preventDefault(); if (editingAccommodation) handleUpdateAccommodation(e); }} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_acc_name')}</label>
              <input
                ref={accNameInputRef}
                value={accName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!accDirectInputMode && accPlaceId !== '__existing__') {
                    if (accPlaceId && accPlaceName && v.trim() !== accPlaceName.trim()) {
                      clearAccGooglePlaceFields();
                    }
                    if (!v.trim()) clearAccGooglePlaceFields();
                  }
                  setAccName(v);
                }}
                onFocus={cancelAccNameBlurConfirm}
                onBlur={scheduleAccNameBlurConfirm}
                required
                placeholder={tt('placeholder_acc_name')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={accDirectInputMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAccDirectInputMode(checked);
                    if (checked) {
                      setAccPlaceId(null);
                      setAccPlaceName('');
                    }
                  }}
                />
                직접 입력 모드 (Google 자동완성 호출 안 함)
              </label>
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
                value={accAddress}
                readOnly={!accDirectInputMode}
                onChange={(e) => {
                  if (accDirectInputMode) setAccAddress(e.target.value);
                }}
                placeholder={
                  accDirectInputMode
                    ? tt('placeholder_search_address')
                    : '이름에서 장소를 선택하면 주소·좌표가 채워집니다'
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 4,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                  backgroundColor: accDirectInputMode ? '#fff' : '#f8fafc',
                }}
              />
              {accPlaceName && (
                <div style={{ marginBottom: 12 }}>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(accPlaceName)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>좌표 입력 (고급)</summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLatitude}
                    readOnly={!accDirectInputMode}
                    onChange={(e) => {
                      if (accDirectInputMode) setAccLatitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lat')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 40,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 14,
                      backgroundColor: accDirectInputMode ? '#fff' : '#f8fafc',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLongitude}
                    readOnly={!accDirectInputMode}
                    onChange={(e) => {
                      if (accDirectInputMode) setAccLongitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lng')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 40,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 14,
                      backgroundColor: accDirectInputMode ? '#fff' : '#f8fafc',
                    }}
                  />
                </div>
                </div>
              </details>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_memo')}</label>
              <input
                value={accMemo}
                onChange={(e) => setAccMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowAccommodationForm(false)} disabled={submitting} style={{ padding: '10px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>{tt('cancel')}</button>
                {editingAccommodation ? (
                  <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    {tt('save')}
                  </button>
                ) : accommodationFormFromSchedule ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={(e) => {
                      handleCreateAccommodation(e, true);
                      setAccommodationFormFromSchedule(false);
                    }}
                    style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    {tt('add')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAccommodation(e, false)} style={{ padding: '10px 18px', background: '#64748b', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAccommodation(e, true)} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      {tt('save_and_add_to_itinerary')}
                    </button>
                  </>
                )}
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
            <form ref={diningFormRef} onSubmit={(e) => { e.preventDefault(); if (editingDining) handleUpdateDining(e); }} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_name')}</label>
              <input
                ref={diningNameInputRef}
                value={diningName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!diningDirectInputMode && diningPlaceId !== '__existing__') {
                    if (diningPlaceId && diningPlaceName && v.trim() !== diningPlaceName.trim()) {
                      clearDiningGooglePlaceFields();
                    }
                    if (!v.trim()) clearDiningGooglePlaceFields();
                  }
                  setDiningName(v);
                }}
                onFocus={cancelDiningNameBlurConfirm}
                onBlur={scheduleDiningNameBlurConfirm}
                required
                placeholder={tt('placeholder_dining_name')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={diningDirectInputMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDiningDirectInputMode(checked);
                    if (checked) {
                      setDiningPlaceId(null);
                      setDiningPlaceName('');
                    }
                  }}
                />
                직접 입력 모드 (Google 자동완성 호출 안 함)
              </label>
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
                value={diningAddress}
                readOnly={!diningDirectInputMode}
                onChange={(e) => {
                  if (diningDirectInputMode) setDiningAddress(e.target.value);
                }}
                placeholder={
                  diningDirectInputMode
                    ? tt('placeholder_search_address')
                    : '이름에서 장소를 선택하면 주소·좌표가 채워집니다'
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  padding: '10px 12px',
                  marginBottom: 4,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 14,
                  backgroundColor: diningDirectInputMode ? '#fff' : '#f8fafc',
                }}
              />
              {diningPlaceName && (
                <div style={{ marginBottom: 12 }}>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(diningPlaceName)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1' }}>
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>좌표 입력 (고급)</summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLatitude}
                    readOnly={!diningDirectInputMode}
                    onChange={(e) => {
                      if (diningDirectInputMode) setDiningLatitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lat')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 40,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 14,
                      backgroundColor: diningDirectInputMode ? '#fff' : '#f8fafc',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLongitude}
                    readOnly={!diningDirectInputMode}
                    onChange={(e) => {
                      if (diningDirectInputMode) setDiningLongitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lng')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 40,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 14,
                      backgroundColor: diningDirectInputMode ? '#fff' : '#f8fafc',
                    }}
                  />
                </div>
                </div>
              </details>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>{tt('label_memo')}</label>
              <input
                value={diningMemo}
                onChange={(e) => setDiningMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '10px 12px', marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowDiningForm(false)} disabled={submitting} style={{ padding: '10px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>{tt('cancel')}</button>
                {editingDining ? (
                  <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    {tt('save')}
                  </button>
                ) : diningFormFromSchedule ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={(e) => {
                      handleCreateDining(e, true);
                      setDiningFormFromSchedule(false);
                    }}
                    style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    {tt('add')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateDining(e, false)} style={{ padding: '10px 18px', background: '#64748b', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateDining(e, true)} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      {tt('save_and_add_to_itinerary')}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showAttractionForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '0 16px',
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowAttractionForm(false)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{editingAttraction ? '관광지 수정' : '관광지 추가'}</h3>
              <button
                type="button"
                onClick={() => !submitting && setShowAttractionForm(false)}
                style={{ background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', padding: 4, color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form ref={attractionFormRef} onSubmit={(e) => { e.preventDefault(); if (editingAttraction) handleUpdateAttraction(e); }} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>관광지명</label>
              <input
                type="text"
                ref={attractionNameInputRef}
                value={attractionName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!attractionDirectInputMode && attractionPlaceId !== '__existing__') {
                    if (attractionPlaceId && attractionPlaceName && v.trim() !== attractionPlaceName.trim()) {
                      clearAttractionGooglePlaceFields();
                    }
                    if (!v.trim()) clearAttractionGooglePlaceFields();
                  }
                  setAttractionName(v);
                }}
                onFocus={cancelAttractionNameBlurConfirm}
                onBlur={scheduleAttractionNameBlurConfirm}
                disabled={submitting}
                placeholder={tt('placeholder_attraction_name')}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' }}
                required
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={attractionDirectInputMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAttractionDirectInputMode(checked);
                    if (checked) {
                      setAttractionPlaceId(null);
                      setAttractionPlaceName('');
                    }
                  }}
                  disabled={submitting}
                />
                직접 입력 모드 (Google 자동완성 호출 안 함)
              </label>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>날짜</label>
              <input
                type="date"
                value={attractionDayDate}
                onChange={(e) => setAttractionDayDate(e.target.value)}
                disabled={submitting}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>시작 시간</label>
                  <input
                    type="time"
                    value={attractionStartTime}
                    onChange={(e) => setAttractionStartTime(e.target.value)}
                    disabled={submitting}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>종료 시간</label>
                  <input
                    type="time"
                    value={attractionEndTime}
                    onChange={(e) => setAttractionEndTime(e.target.value)}
                    disabled={submitting}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>주소</label>
              <input
                type="text"
                value={attractionAddress}
                readOnly={!attractionDirectInputMode}
                onChange={(e) => {
                  if (attractionDirectInputMode) setAttractionAddress(e.target.value);
                }}
                disabled={submitting}
                placeholder={
                  attractionDirectInputMode ? tt('placeholder_address') : '이름에서 장소를 선택하면 주소·좌표가 채워집니다'
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 14,
                  marginBottom: 12,
                  boxSizing: 'border-box',
                  backgroundColor: attractionDirectInputMode ? '#fff' : '#f8fafc',
                }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>설명</label>
              <textarea
                value={attractionDescription}
                onChange={(e) => setAttractionDescription(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_description')}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {editingAttraction ? (
                  <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    저장
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAttraction(e, false)} style={{ padding: '10px 18px', background: '#64748b', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      저장만
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAttraction(e, true)} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      일정에 추가
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransportForm && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '0 16px',
            boxSizing: 'border-box',
          }}
          onClick={() => !submitting && setShowTransportForm(false)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{editingTransport ? '교통 수정' : '교통 추가'}</h3>
              <button
                type="button"
                onClick={() => !submitting && setShowTransportForm(false)}
                style={{ background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', padding: 4, color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form ref={transportFormRef} onSubmit={(e) => { e.preventDefault(); if (editingTransport) handleUpdateTransport(e); }} style={{ overflow: 'hidden', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>교통수단</label>
              <select
                value={transportType}
                onChange={(e) => setTransportType(e.target.value as 'air' | 'train' | 'car' | 'bike')}
                disabled={submitting}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              >
                <option value="air">비행기</option>
                <option value="train">기차</option>
                <option value="car">자동차</option>
                <option value="bike">바이크</option>
              </select>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>날짜</label>
              <input
                type="date"
                value={transportDayDate}
                onChange={(e) => setTransportDayDate(e.target.value)}
                disabled={submitting}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>시작 시간</label>
                  <input
                    type="time"
                    value={transportStartTime}
                    onChange={(e) => setTransportStartTime(e.target.value)}
                    disabled={submitting}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>종료 시간</label>
                  <input
                    type="time"
                    value={transportEndTime}
                    onChange={(e) => setTransportEndTime(e.target.value)}
                    disabled={submitting}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>출발지</label>
              <input
                type="text"
                ref={transportDepartureInputRef}
                value={transportDeparture}
                onChange={(e) => {
                  setTransportDeparture(e.target.value);
                  if (!transportDirectInputMode) setTransportDeparturePlaceId(null);
                }}
                disabled={submitting}
                placeholder={tt('placeholder_departure')}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>도착지</label>
              <input
                type="text"
                ref={transportArrivalInputRef}
                value={transportArrival}
                onChange={(e) => {
                  setTransportArrival(e.target.value);
                  if (!transportDirectInputMode) setTransportArrivalPlaceId(null);
                }}
                disabled={submitting}
                placeholder={tt('placeholder_arrival')}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={transportDirectInputMode}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTransportDirectInputMode(checked);
                    if (checked) {
                      setTransportDeparturePlaceId(null);
                      setTransportArrivalPlaceId(null);
                    }
                  }}
                  disabled={submitting}
                />
                직접 입력 모드 (Google 자동완성 호출 안 함)
              </label>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>거리 (km)</label>
              <input
                type="number"
                value={transportDistanceKm}
                onChange={(e) => setTransportDistanceKm(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_distance_km')}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>메모</label>
              <textarea
                value={transportMemo}
                onChange={(e) => setTransportMemo(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_memo')}
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {editingTransport ? (
                  <button type="submit" disabled={submitting} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    저장
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateTransport(e, false)} style={{ padding: '10px 18px', background: '#64748b', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      저장만
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateTransport(e, true)} style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {submitting && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                      일정에 추가
                    </button>
                  </>
                )}
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
