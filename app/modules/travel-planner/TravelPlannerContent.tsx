'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { getTravelTranslation } from '@/lib/translations/travel';
import type { TravelTrip, TravelItinerary, TravelExpense, TravelAccommodation, TravelDining, TravelAttraction, TravelTransport } from '@/lib/modules/travel-planner/types';
import { shortItineraryTitle } from '@/lib/modules/travel-planner/short-itinerary-title';
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
  const uiText = useMemo(() => {
    if (lang === 'ko') {
      return {
        transportShort: '교통',
        confirmDeleteTrip: (title: string) => `"${title}" 여행을 삭제할까요?`,
        confirmDeleteItinerary: (title: string) => `"${title}" 일정을 삭제할까요?`,
        confirmRemoveFromItinerary: (title: string) => `"${title}" 항목을 일정에서 제거할까요?`,
        removeFromItineraryFailed: '일정에서 제거하는데 실패했습니다.',
        confirmDeleteExpense: '이 경비 항목을 삭제할까요?',
        placeSelectAccommodation: '숙소명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.',
        placeSelectDining: '먹거리 이름은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.',
        placeSelectAttraction: '관광지명은 Google 장소 목록에서 선택해 주세요. 직접 입력하려면「직접 입력 모드」를 켜 주세요.',
        attractionRequired: '관광지명과 날짜는 필수입니다.',
        attractionAddFailed: '관광지 추가에 실패했습니다.',
        attractionUpdateFailed: '관광지 수정에 실패했습니다.',
        attractionDeleteFailed: '관광지 삭제에 실패했습니다.',
        dateRequired: '날짜는 필수입니다.',
        departureSelectRequired: '출발지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.',
        arrivalSelectRequired: '도착지는 자동완성 목록에서 선택해주세요. 직접 입력하려면 직접 입력 모드를 켜주세요.',
        transportAddFailed: '교통 추가에 실패했습니다.',
        transportUpdateFailed: '교통 수정에 실패했습니다.',
        transportDeleteFailed: '교통 삭제에 실패했습니다.',
        confirmDeleteAccommodation: (name: string) => `"${name}" 숙소를 삭제할까요?`,
        confirmDeleteDining: (name: string) => `"${name}" 먹거리를 삭제할까요?`,
        confirmDeleteAttraction: (name: string) => `"${name}" 관광지를 삭제할까요?`,
        confirmDeleteTransport: '이 교통수단을 삭제할까요?',
        itineraryEmptyForPdf: '등록된 일정이 없습니다.',
        goToDashboard: '대시보드로 이동',
        createdLabel: '등록',
        updatedLabel: '수정',
        photo: '사진',
        attachmentPhotos: '첨부 사진',
        close: '닫기',
        uploading: '업로드 중…',
        addPhoto: '사진 추가',
        autoOptimizedUpload: '자동 최적화 업로드',
        filenameFilter: '파일명 필터',
        expenseSection: '경비',
        addBudget: '+ 경비추가',
        addExpense: '- 지출추가',
        balance: '잔액',
        directInputMode: '직접 입력 모드 (Google 자동완성 호출 안 함)',
        placeFillHint: '이름에서 장소를 선택하면 주소·좌표가 채워집니다',
        coordInputAdvanced: '좌표 입력 (고급)',
        diningSection: '먹거리',
        addDining: '+ 먹거리 추가',
        accommodationSection: '숙소',
        addAccommodation: '+ 숙소 추가',
        transportSection: '교통',
        itinerarySection: '일정',
        mapSectionTitle: '위치 지도 (숙소·먹거리·관광지)',
        attractionTitle: (editing: boolean) => (editing ? '관광지 수정' : '관광지 추가'),
        transportTitle: (editing: boolean) => (editing ? '교통 수정' : '교통 추가'),
      };
    }
    return {
      transportShort: 'Transport',
      confirmDeleteTrip: (title: string) => `Delete trip "${title}"?`,
      confirmDeleteItinerary: (title: string) => `Delete itinerary "${title}"?`,
      confirmRemoveFromItinerary: (title: string) => `Remove "${title}" from itinerary?`,
      removeFromItineraryFailed: 'Failed to remove from itinerary.',
      confirmDeleteExpense: 'Delete this expense item?',
      placeSelectAccommodation: 'Please select accommodation from Google Places. Enable direct input mode to type manually.',
      placeSelectDining: 'Please select dining place from Google Places. Enable direct input mode to type manually.',
      placeSelectAttraction: 'Please select attraction from Google Places. Enable direct input mode to type manually.',
      attractionRequired: 'Attraction name and date are required.',
      attractionAddFailed: 'Failed to add attraction.',
      attractionUpdateFailed: 'Failed to update attraction.',
      attractionDeleteFailed: 'Failed to delete attraction.',
      dateRequired: 'Date is required.',
      departureSelectRequired: 'Please select departure from autocomplete list. Enable direct input mode to type manually.',
      arrivalSelectRequired: 'Please select arrival from autocomplete list. Enable direct input mode to type manually.',
      transportAddFailed: 'Failed to add transportation.',
      transportUpdateFailed: 'Failed to update transportation.',
      transportDeleteFailed: 'Failed to delete transportation.',
      confirmDeleteAccommodation: (name: string) => `Delete accommodation "${name}"?`,
      confirmDeleteDining: (name: string) => `Delete dining "${name}"?`,
      confirmDeleteAttraction: (name: string) => `Delete attraction "${name}"?`,
      confirmDeleteTransport: 'Delete this transport item?',
      itineraryEmptyForPdf: 'No itinerary available.',
      goToDashboard: 'Go to dashboard',
      createdLabel: 'Created',
      updatedLabel: 'Updated',
      photo: 'Photo',
      attachmentPhotos: 'Attachments',
      close: 'Close',
      uploading: 'Uploading…',
      addPhoto: 'Add photo',
      autoOptimizedUpload: 'Auto-optimized upload',
      filenameFilter: 'Filename filter',
      expenseSection: 'Budget',
      addBudget: '+ Add budget',
      addExpense: '- Add expense',
      balance: 'Balance',
      directInputMode: 'Direct input mode (disable Google autocomplete)',
      placeFillHint: 'Selecting a place name fills address and coordinates',
      coordInputAdvanced: 'Coordinate input (advanced)',
      diningSection: 'Dining',
      addDining: '+ Add dining',
      accommodationSection: 'Accommodation',
      addAccommodation: '+ Add accommodation',
      transportSection: 'Transportation',
      itinerarySection: 'Itinerary',
      mapSectionTitle: 'Location map (accommodation, dining, attractions)',
      attractionTitle: (editing: boolean) => (editing ? 'Edit attraction' : 'Add attraction'),
      transportTitle: (editing: boolean) => (editing ? 'Edit transportation' : 'Add transportation'),
    };
  }, [lang]);
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
  const expenseAmountLabel = useMemo(() => {
    const translated = tt('label_amount');
    const hasRequiredMark = /\*\s*$/.test(translated);
    const base = translated
      .replace(/\s*\*\s*$/, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    return `${base} (${tripCurrencyCode})${hasRequiredMark ? ' *' : ''}`;
  }, [tripCurrencyCode, tt]);
  const expenseRequiredAlertMessage = useMemo(
    () => `${tt('alert_expense_required')} (${tripCurrencyCode})`,
    [tripCurrencyCode, tt],
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
      const label = (typeof item.name === 'string' ? item.name.trim() : '') || (typeof item.title === 'string' ? item.title.trim() : '');
      const addr = typeof item.address === 'string' ? item.address.trim() : '';
      const textQuery = [label, addr].filter(Boolean).join(' ').trim();
      const coordQuery =
        item.latitude != null && item.longitude != null ? `${item.latitude},${item.longitude}` : '';

      // Maps URLs: search에는 query가 필수이며 query_place_id와 병행 시 정확히 해당 장소로 연결됨
      // (query=place_id:... 단독은 웹에서 검색어로 처리되어 "찾을 수 없음"이 자주 남)
      if (pid) {
        const query = textQuery || coordQuery || pid;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(pid)}`;
      }
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
    const waitForPlacesAutocomplete = () => {
      const iv = setInterval(() => {
        if ((window as any).google?.maps?.places?.Autocomplete) {
          clearInterval(iv);
          setPlacesApiReady(true);
        }
      }, 100);
      return () => clearInterval(iv);
    };
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      return waitForPlacesAutocomplete();
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      travelMapScriptLoadedRef.current = true;
      // onload 직후에도 places 네임스페이스 초기화가 늦는 경우가 있어 실제 객체 확인 후 ready 처리
      waitForPlacesAutocomplete();
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
        if (a.latitude != null && a.longitude != null) {
          addMarker(a.latitude, a.longitude, shortItineraryTitle('accommodation', a.name, a.address), '🏨');
        }
      });
      dining.forEach((d) => {
        if (d.latitude != null && d.longitude != null) {
          addMarker(d.latitude, d.longitude, shortItineraryTitle('dining', d.name, d.address), '🍽️');
        }
      });
      attractions.forEach((a) => {
        if (a.latitude != null && a.longitude != null) {
          addMarker(a.latitude, a.longitude, shortItineraryTitle('attraction', a.name, a.address), '🏛️');
        }
      });
      transports.forEach((t) => {
        let emoji = '🚗';
        if (t.transport_type === 'air') emoji = '✈️';
        else if (t.transport_type === 'train') emoji = '🚂';
        else if (t.transport_type === 'car') emoji = '🚗';
        else if (t.transport_type === 'bike') emoji = '🚲';
        const title = t.departure && t.arrival ? `${t.departure} → ${t.arrival}` : uiText.transportShort;
        if (t.departure || t.arrival) {
          // 출발지나 도착지 중 하나라도 있으면 지도에 표시 (좌표는 없을 수 있음)
          // 실제로는 departure/arrival에는 좌표가 없으므로 생략
        }
      });
      itineraries.forEach((i) => {
        if (i.latitude != null && i.longitude != null) {
          addMarker(i.latitude, i.longitude, shortItineraryTitle('other', i.title, i.address), '📌');
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
    if (!currentGroupId || !confirm(uiText.confirmDeleteTrip(trip.title))) return;
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
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteItinerary(item.title))) return;
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
    const displayTitle = shortItineraryTitle(item.type, item.title, item.address);
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmRemoveFromItinerary(displayTitle))) return;
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
        throw new Error(json.error || uiText.removeFromItineraryFailed);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.removeFromItineraryFailed);
    }
  };

  /** 일정에만 안 넣어 둔 기존 항목을 통합 일정에 표시 */
  const handleAddToItinerary = useCallback(
    async (type: 'accommodation' | 'dining' | 'attraction' | 'transport', id: string) => {
      if (!currentGroupId || !selectedTrip) return;
      const fail =
        type === 'accommodation'
          ? tt('accommodation_update_failed')
          : type === 'dining'
            ? tt('dining_update_failed')
            : type === 'attraction'
              ? tt('attraction_update_failed')
              : tt('transport_update_failed');
      try {
        const headers = await getAuthHeaders();
        const path =
          type === 'accommodation'
            ? `${API_BASE}/accommodations/${id}`
            : type === 'dining'
              ? `${API_BASE}/dining/${id}`
              : type === 'attraction'
                ? `${API_BASE}/attractions/${id}`
                : `${API_BASE}/transports/${id}`;
        const res = await fetch(`${path}?groupId=${currentGroupId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ show_in_itinerary: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || fail);
        if (type === 'accommodation') await fetchAccommodations(selectedTrip.id);
        else if (type === 'dining') await fetchDining(selectedTrip.id);
        else if (type === 'attraction') await fetchAttractions(selectedTrip.id);
        else await fetchTransports(selectedTrip.id);
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : fail);
      }
    },
    [
      currentGroupId,
      selectedTrip,
      getAuthHeaders,
      fetchAccommodations,
      fetchDining,
      fetchAttractions,
      fetchTransports,
      tt,
    ],
  );

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
      alert(expenseRequiredAlertMessage);
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
      alert(expenseRequiredAlertMessage);
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
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteExpense)) return;
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
        alert(uiText.placeSelectAccommodation);
        return;
      }
      if (accPlaceId !== '__existing__' && (!accPlaceName.trim() || accName.trim() !== accPlaceName.trim())) {
        alert(uiText.placeSelectAccommodation);
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
        alert(uiText.placeSelectAccommodation);
        return;
      }
      if (accPlaceId !== '__existing__' && (!accPlaceName.trim() || accName.trim() !== accPlaceName.trim())) {
        alert(uiText.placeSelectAccommodation);
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
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteAccommodation(item.name))) return;
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
        alert(uiText.placeSelectDining);
        return;
      }
      if (diningPlaceId !== '__existing__' && (!diningPlaceName.trim() || diningName.trim() !== diningPlaceName.trim())) {
        alert(uiText.placeSelectDining);
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
        alert(uiText.placeSelectDining);
        return;
      }
      if (diningPlaceId !== '__existing__' && (!diningPlaceName.trim() || diningName.trim() !== diningPlaceName.trim())) {
        alert(uiText.placeSelectDining);
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
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteDining(item.name))) return;
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
      alert(uiText.attractionRequired);
      return;
    }
    if (!attractionDirectInputMode && attractionName.trim()) {
      if (!attractionPlaceId) {
        alert(uiText.placeSelectAttraction);
        return;
      }
      if (attractionPlaceId !== '__existing__' && (!attractionPlaceName.trim() || attractionName.trim() !== attractionPlaceName.trim())) {
        alert(uiText.placeSelectAttraction);
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
      if (!res.ok) throw new Error(json.error || uiText.attractionAddFailed);
      await fetchAttractions(selectedTrip.id);
      setShowAttractionForm(false);
      setEditingAttraction(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.attractionAddFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAttraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttraction || !currentGroupId || !attractionName.trim() || !attractionDayDate) {
      alert(uiText.attractionRequired);
      return;
    }
    if (!attractionDirectInputMode && attractionName.trim()) {
      if (!attractionPlaceId) {
        alert(uiText.placeSelectAttraction);
        return;
      }
      if (attractionPlaceId !== '__existing__' && (!attractionPlaceName.trim() || attractionName.trim() !== attractionPlaceName.trim())) {
        alert(uiText.placeSelectAttraction);
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
      if (!res.ok) throw new Error(json.error || uiText.attractionUpdateFailed);
      await fetchAttractions(selectedTrip!.id);
      setShowAttractionForm(false);
      setEditingAttraction(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.attractionUpdateFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttraction = async (item: TravelAttraction) => {
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteAttraction(item.name))) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/attractions/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || uiText.attractionDeleteFailed);
      }
      await fetchAttractions(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.attractionDeleteFailed);
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
      alert(uiText.dateRequired);
      return;
    }
    if (!transportDirectInputMode) {
      if (transportDeparture.trim() && !transportDeparturePlaceId) {
        alert(uiText.departureSelectRequired);
        return;
      }
      if (transportArrival.trim() && !transportArrivalPlaceId) {
        alert(uiText.arrivalSelectRequired);
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
      if (!res.ok) throw new Error(json.error || uiText.transportAddFailed);
      await fetchTransports(selectedTrip.id);
      setShowTransportForm(false);
      setEditingTransport(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.transportAddFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransport || !currentGroupId || !transportDayDate) {
      alert(uiText.dateRequired);
      return;
    }
    if (!transportDirectInputMode) {
      if (transportDeparture.trim() && !transportDeparturePlaceId) {
        alert(uiText.departureSelectRequired);
        return;
      }
      if (transportArrival.trim() && !transportArrivalPlaceId) {
        alert(uiText.arrivalSelectRequired);
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
      if (!res.ok) throw new Error(json.error || uiText.transportUpdateFailed);
      await fetchTransports(selectedTrip!.id);
      setShowTransportForm(false);
      setEditingTransport(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.transportUpdateFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransport = async (item: TravelTransport) => {
    if (!currentGroupId || !selectedTrip || !confirm(uiText.confirmDeleteTransport)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/transports/${item.id}?groupId=${currentGroupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || uiText.transportDeleteFailed);
      }
      await fetchTransports(selectedTrip.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : uiText.transportDeleteFailed);
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
    if (type === 'accommodation') return uiText.accommodationSection;
    if (type === 'dining') return uiText.diningSection;
    if (type === 'attraction') return tt('add_attraction');
    if (type === 'transport') {
      if (transport_type === 'air') return tt('transport_type_air');
      if (transport_type === 'train') return tt('transport_type_train');
      if (transport_type === 'car') return tt('transport_type_car');
      if (transport_type === 'bike') return tt('transport_type_bike');
      return tt('section_transport');
    }
    return tt('other');
  };

  const downloadItineraryPdf = useCallback(() => {
    if (!selectedTrip) return;
    void import('@/lib/modules/travel-planner/itinerary-pdf').then(({ buildAndSaveTravelItineraryPdf }) =>
      buildAndSaveTravelItineraryPdf({
        trip: {
          title: selectedTrip.title,
          destination: selectedTrip.destination,
          start_date: selectedTrip.start_date,
          end_date: selectedTrip.end_date,
        },
        items: sortedItineraries,
        getTypeLabel: (type, transport_type) => getItineraryTypeLabel(type, transport_type),
        emptyItineraryMessage: uiText.itineraryEmptyForPdf,
      }),
    );
  }, [selectedTrip, sortedItineraries, uiText, tt]);

  if (!currentGroupId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="text-center text-slate-500">
          <MapPin className="mx-auto mb-4 h-12 w-12 opacity-60" />
          <p>{tt('select_group_first')}</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-4 cursor-pointer rounded-lg border-0 bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {uiText.goToDashboard}
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
    <div className="min-h-screen bg-slate-50 p-5">
      <div ref={placesServiceContainerRef} className="absolute left-[-9999px] h-px w-px" aria-hidden="true" />
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white p-2"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="m-0 text-[22px] font-bold text-slate-800">{tt('title')}</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">{currentGroup?.name ?? tt('group_label')}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-100 p-3 text-red-800">
          {error}
        </div>
      )}

      {selectedTrip ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <div className="mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 text-[20px] font-bold text-slate-800">{selectedTrip.title}</h2>
                  {selectedTrip.destination && (
                    <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" />
                      {selectedTrip.destination}
                    </p>
                  )}
                  <p className="m-0 mt-1 text-[13px] text-slate-400">
                    <Calendar className="mr-1 inline h-[14px] w-[14px]" />
                    {selectedTrip.start_date} ~ {selectedTrip.end_date}
                  </p>
                  <p className="m-0 mt-1 text-xs text-slate-500">
                    {tt('label_trip_currency')}: <strong className="text-slate-700">{tripCurrencyCode}</strong>
                  </p>
                  <p className="m-0 mt-1 text-xs text-slate-400">
                    {uiText.createdLabel}: {getDisplayName(selectedTrip.created_by)}
                    {selectedTrip.updated_by != null && ` · ${uiText.updatedLabel}: ${getDisplayName(selectedTrip.updated_by)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setTravelAttachmentTarget({ entityType: 'travel_trip', entityId: selectedTrip.id })}
                    className="cursor-pointer rounded-lg border-0 bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-700"
                  >
                    {uiText.photo}
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
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                    {tt('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTrip(selectedTrip)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-red-100 px-3 py-2 text-[13px] font-semibold text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    {tt('delete')}
                  </button>
                </div>
              </div>

            {travelAttachmentTarget && (
              <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <strong className="text-[13px] text-slate-700">{uiText.attachmentPhotos}</strong>
                  <button type="button" onClick={() => setTravelAttachmentTarget(null)} className="cursor-pointer rounded-md border-0 bg-slate-200 px-2 py-1">{uiText.close}</button>
                </div>
                <input
                  ref={travelAttachmentInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  capture="environment"
                  onChange={handlePickTravelAttachment}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => travelAttachmentInputRef.current?.click()}
                  disabled={travelAttachmentUploading}
                  className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                >
                  {travelAttachmentUploading ? uiText.uploading : uiText.addPhoto}
                </button>
                <span className="ml-2 text-xs text-slate-500">{uiText.autoOptimizedUpload}</span>
                {travelAttachmentUploading && (
                  <button
                    type="button"
                    onClick={() => travelAttachmentAbortRef.current?.abort()}
                    className="ml-2 cursor-pointer rounded-md border-0 bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                  >
                    {tt('cancel')}
                  </button>
                )}
                <input
                  value={travelAttachmentFilter}
                  onChange={(e) => setTravelAttachmentFilter(e.target.value)}
                  placeholder={uiText.filenameFilter}
                  className="ml-2 min-w-[120px] rounded-md border border-slate-300 px-2 py-1.5"
                />
                {travelAttachmentJobs.length > 0 && (
                  <div className="mt-2 grid w-full gap-1">
                    {travelAttachmentJobs.map((job) => (
                      <div key={job.id} className="text-xs text-slate-600">
                        {job.fileName} · {job.status}{job.status === 'uploading' ? ` ${Math.round(job.progress)}%` : ''}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2">
                  {travelAttachments
                    .filter((att) => !travelAttachmentFilter || att.original_filename.toLowerCase().includes(travelAttachmentFilter.toLowerCase()))
                    .map((att) => (
                    <div key={att.id} className="relative">
                      <a href={att.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={att.thumbnail_url || att.image_url} alt={att.original_filename} className="h-[78px] w-full rounded-md object-cover" />
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
                        className="absolute right-1 top-1 h-[18px] w-[18px] cursor-pointer rounded-full border-0 bg-[rgba(239,68,68,0.95)] text-white"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="m-0 flex items-center gap-1.5 text-[15px] font-semibold text-slate-600">
                  <Wallet className="h-[18px] w-[18px]" />
                  {uiText.expenseSection}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openExpenseForm(null, 'addition')}
                    className="cursor-pointer rounded-md border-0 bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {uiText.addBudget}
                  </button>
                  <button
                    type="button"
                    onClick={() => openExpenseForm(null, 'expense')}
                    className="cursor-pointer rounded-md border-0 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {uiText.addExpense}
                  </button>
                </div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-4">
                  <span className="text-[15px] text-slate-500">
                    {tt('total_budget')}{' '}
                    <strong className="text-slate-800">{fmtTripMoney(totalBudget)}</strong>
                  </span>
                  <span className={`text-lg font-bold ${balance >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    {uiText.balance} {fmtTripMoney(balance)}
                  </span>
                </div>
                <div className="mb-1.5 text-[13px] font-semibold text-slate-600">{tt('add_list')}</div>
                <ul className="mb-4 m-0 list-none p-0">
                  {additionList.length === 0 ? (
                    <li className="rounded-md bg-slate-50 p-2.5 text-[13px] text-slate-400">{tt('no_additions')}</li>
                  ) : (
                    additionList.map((e) => (
                      <li key={e.id} className="mb-1 flex items-start justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px]">
                        <div className="min-w-0 flex-1">
                          <span>{e.category || tt('addition')}</span>
                          <span className="ml-2 font-semibold text-green-700">+{fmtTripMoney(Number(e.amount))}</span>
                          {e.expense_date && <span className="ml-2 text-xs text-slate-500">{e.expense_date}</span>}
                          <div className="mt-0.5 text-[11px] text-slate-400">{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => setTravelAttachmentTarget({ entityType: 'travel_expense', entityId: e.id })} className="cursor-pointer rounded-md border-0 bg-blue-50 p-1.5 text-blue-700" title={uiText.photo}>📷</button>
                          <button type="button" onClick={() => openExpenseForm(e)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}><Pencil className="h-[14px] w-[14px]" /></button>
                          <button type="button" onClick={() => handleDeleteExpense(e)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}><Trash2 className="h-[14px] w-[14px]" /></button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mb-1.5 text-[13px] font-semibold text-slate-600">{tt('expense_list')}</div>
                <ul className="m-0 list-none p-0">
                  {expenseList.length === 0 ? (
                    <li className="rounded-md bg-slate-50 p-2.5 text-[13px] text-slate-400">{tt('no_expenses')}</li>
                  ) : (
                    expenseList.map((e) => (
                      <li key={e.id} className="mb-1 flex items-start justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px]">
                        <div className="min-w-0 flex-1">
                          <span>{e.category || tt('other')}</span>
                          <span className="ml-2 font-semibold text-red-700">-{fmtTripMoney(Number(e.amount))}</span>
                          {e.expense_date && <span className="ml-2 text-xs text-slate-500">{e.expense_date}</span>}
                          <div className="mt-0.5 text-[11px] text-slate-400">{tt('registered_by')}: {getDisplayName(e.created_by)}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => setTravelAttachmentTarget({ entityType: 'travel_expense', entityId: e.id })} className="cursor-pointer rounded-md border-0 bg-blue-50 p-1.5 text-blue-700" title={uiText.photo}>📷</button>
                          <button type="button" onClick={() => openExpenseForm(e)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}><Pencil className="h-[14px] w-[14px]" /></button>
                          <button type="button" onClick={() => handleDeleteExpense(e)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}><Trash2 className="h-[14px] w-[14px]" /></button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="m-0 flex items-center gap-1.5 text-[15px] font-semibold text-slate-600">
                  <ListOrdered className="h-[18px] w-[18px]" />
                  {uiText.itinerarySection}
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadItineraryPdf}
                    className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    <FileDown className="h-[14px] w-[14px]" />
                    {tt('view_itinerary_pdf')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleAddTypePicker(true)}
                    className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    + {tt('add_itinerary')}
                  </button>
                </div>
              </div>
              <ul className="m-0 list-none p-0">
                {sortedItineraries.length === 0 ? (
                  <li className="p-3 text-[13px] text-slate-400">{tt('no_itinerary')}</li>
                ) : (
                  sortedItineraries.map((i) => (
                    <li
                      key={i.id}
                      className="mb-1.5 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800">
                          <span className="mr-1.5">
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
                          {shortItineraryTitle(i.type, i.title, i.address)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {i.day_date}
                          {(i.start_time || i.end_time) && <span className="ml-1.5">· {(i.start_time || '--')} ~ {(i.end_time || '--')}</span>}
                        </div>
                        {i.description && <div className="mt-1 text-[13px] text-slate-600">{i.description}</div>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1">
                          {getGoogleMapsUrl(i) && (
                            <a
                              href={getGoogleMapsUrl(i)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-blue-50 p-1.5 text-blue-600 no-underline"
                              title={tt('view_on_map')}
                            >
                              <MapPin className="h-[14px] w-[14px]" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditFromItinerary(i)}
                            className="cursor-pointer rounded-md border-0 bg-sky-100 p-1.5 text-sky-700"
                            title={tt('edit_itinerary')}
                          >
                            <Pencil className="h-[14px] w-[14px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromItinerary(i)}
                            className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800"
                            title={tt('remove_from_itinerary')}
                          >
                            <Trash2 className="h-[14px] w-[14px]" />
                          </button>
                        </div>
                        {buildGoogleWebSearchUrl(shortItineraryTitle(i.type, i.title, i.address)) && (
                          <a href={buildGoogleWebSearchUrl(shortItineraryTitle(i.type, i.title, i.address))!} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                            {tt('link_google_search')}
                          </a>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="mt-5 overflow-hidden rounded-[10px] border border-slate-200">
              <button
                type="button"
                onClick={() => setSectionOpenAttraction((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-600"
              >
                <span className="flex items-center gap-2">
                  {sectionOpenAttraction ? <ChevronDown className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
                  <Landmark className="h-[18px] w-[18px]" />
                  {tt('section_attraction')} ({attractions.length})
                </span>
              </button>
              {sectionOpenAttraction && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openAttractionForm(null, false)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      + {tt('add_attraction')}
                    </button>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {attractions.length === 0 ? (
                      <li className="p-3 text-[13px] text-slate-400">{tt('no_attraction')}</li>
                    ) : (
                      attractions.map((a) => (
                        <li
                          key={a.id}
                          className="mb-1.5 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800">
                              <span className="mr-1.5">🏛️</span>
                              {a.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {a.day_date}
                              {(a.start_time || a.end_time) && <span className="ml-1.5">· {(a.start_time || '--')} ~ {(a.end_time || '--')}</span>}
                            </div>
                            {a.description && <div className="mt-1 text-[13px] text-slate-600">{a.description}</div>}
                            <div className="mt-1 text-[11px] text-slate-400">{tt('registered_by')}: {getDisplayName(a.created_by)}{a.updated_by != null && ` · ${tt('updated_by')}: ${getDisplayName(a.updated_by)}`}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1">
                              {getGoogleMapsUrl(a) && (
                                <a href={getGoogleMapsUrl(a)!} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-blue-50 p-1.5 text-blue-600 no-underline" title={tt('view_on_map')}><MapPin className="h-[14px] w-[14px]" /></a>
                              )}
                              <button type="button" onClick={() => openAttractionForm(a)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}><Pencil className="h-[14px] w-[14px]" /></button>
                              <button type="button" onClick={() => handleDeleteAttraction(a)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}><Trash2 className="h-[14px] w-[14px]" /></button>
                            </div>
                            {buildGoogleWebSearchUrl(a.name) && (
                              <a href={buildGoogleWebSearchUrl(a.name)!} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                                {tt('link_google_search')}
                              </a>
                            )}
                            {!a.show_in_itinerary && (
                              <button
                                type="button"
                                onClick={() => void handleAddToItinerary('attraction', a.id)}
                                className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"
                              >
                                {tt('save_and_add_to_itinerary')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-[10px] border border-slate-200">
              <button
                type="button"
                onClick={() => setSectionOpenDining((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-600"
              >
                <span className="flex items-center gap-2">
                  {sectionOpenDining ? <ChevronDown className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
                  <UtensilsCrossed className="h-[18px] w-[18px]" />
                  {uiText.diningSection} ({dining.length})
                </span>
              </button>
              {sectionOpenDining && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openDiningForm(null)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {uiText.addDining}
                    </button>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {dining.length === 0 ? (
                      <li className="p-3 text-[13px] text-slate-400">{tt('no_dining')}</li>
                    ) : (
                      dining.map((d) => (
                        <li
                          key={d.id}
                          className="mb-1.5 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800">{d.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {d.day_date}
                              {d.time_at && <span className="ml-1.5">{d.time_at}</span>}
                              {d.category && <span className="ml-1.5 text-slate-500">{d.category}</span>}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {uiText.createdLabel}: {getDisplayName(d.created_by)}
                              {d.updated_by != null && ` · ${uiText.updatedLabel}: ${getDisplayName(d.updated_by)}`}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1">
                              {getGoogleMapsUrl(d) && (
                                <a href={getGoogleMapsUrl(d)!} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-blue-50 p-1.5 text-blue-600 no-underline" title={tt('view_on_map')}>
                                  <MapPin className="h-[14px] w-[14px]" />
                                </a>
                              )}
                              <button type="button" onClick={() => openDiningForm(d)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}>
                                <Pencil className="h-[14px] w-[14px]" />
                              </button>
                              <button type="button" onClick={() => handleDeleteDining(d)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}>
                                <Trash2 className="h-[14px] w-[14px]" />
                              </button>
                            </div>
                            {buildGoogleWebSearchUrl(d.name) && (
                              <a href={buildGoogleWebSearchUrl(d.name)!} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                                {tt('link_google_search')}
                              </a>
                            )}
                            {!d.show_in_itinerary && (
                              <button
                                type="button"
                                onClick={() => void handleAddToItinerary('dining', d.id)}
                                className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"
                              >
                                {tt('save_and_add_to_itinerary')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-[10px] border border-slate-200">
              <button
                type="button"
                onClick={() => setSectionOpenAccommodation((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-600"
              >
                <span className="flex items-center gap-2">
                  {sectionOpenAccommodation ? <ChevronDown className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
                  <Home className="h-[18px] w-[18px]" />
                  {uiText.accommodationSection} ({accommodations.length})
                </span>
              </button>
              {sectionOpenAccommodation && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openAccommodationForm(null)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {uiText.addAccommodation}
                    </button>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {accommodations.length === 0 ? (
                      <li className="p-3 text-[13px] text-slate-400">{tt('no_accommodation')}</li>
                    ) : (
                      accommodations.map((a) => (
                        <li
                          key={a.id}
                          className="mb-1.5 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800">{a.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{a.check_in_date} ~ {a.check_out_date}</div>
                            {a.address && <div className="mt-1 text-[13px] text-slate-600">{a.address}</div>}
                            <div className="mt-1 text-[11px] text-slate-400">
                              {uiText.createdLabel}: {getDisplayName(a.created_by)}
                              {a.updated_by != null && ` · ${uiText.updatedLabel}: ${getDisplayName(a.updated_by)}`}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1">
                              {getGoogleMapsUrl(a) && (
                                <a href={getGoogleMapsUrl(a)!} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-blue-50 p-1.5 text-blue-600 no-underline" title={tt('view_on_map')}>
                                  <MapPin className="h-[14px] w-[14px]" />
                                </a>
                              )}
                              <button type="button" onClick={() => openAccommodationForm(a)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}>
                                <Pencil className="h-[14px] w-[14px]" />
                              </button>
                              <button type="button" onClick={() => handleDeleteAccommodation(a)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}>
                                <Trash2 className="h-[14px] w-[14px]" />
                              </button>
                            </div>
                            {buildGoogleWebSearchUrl(a.name) && (
                              <a href={buildGoogleWebSearchUrl(a.name)!} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                                {tt('link_google_search')}
                              </a>
                            )}
                            {!a.show_in_itinerary && (
                              <button
                                type="button"
                                onClick={() => void handleAddToItinerary('accommodation', a.id)}
                                className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"
                              >
                                {tt('save_and_add_to_itinerary')}
                              </button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-[10px] border border-slate-200">
              <button
                type="button"
                onClick={() => setSectionOpenTransport((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-600"
              >
                <span className="flex items-center gap-2">
                  {sectionOpenTransport ? <ChevronDown className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
                  <Car className="h-[18px] w-[18px]" />
                  {uiText.transportSection} ({transports.length})
                </span>
              </button>
              {sectionOpenTransport && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="mb-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'air', false)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      + {tt('transport_type_air')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'train', false)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      + {tt('transport_type_train')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'car', false)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      + {tt('transport_type_car')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTransportForm(null, 'bike', false)}
                      className="cursor-pointer rounded-md border-0 bg-purple-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      + {tt('transport_type_bike')}
                    </button>
                  </div>
                  <ul className="m-0 list-none p-0">
                    {transports.length === 0 ? (
                      <li className="p-3 text-[13px] text-slate-400">{tt('no_transport')}</li>
                    ) : (
                      transports.map((t) => (
                        <li
                          key={t.id}
                          className="mb-1.5 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800">
                              <span className="mr-1.5">{t.transport_type === 'air' ? '✈️' : t.transport_type === 'train' ? '🚆' : t.transport_type === 'car' ? '🚗' : '🚲'}</span>
                              {t.departure || ''} → {t.arrival || ''}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t.day_date}
                              {(t.start_time || t.end_time) && <span className="ml-1.5">· {(t.start_time || '--')} ~ {(t.end_time || '--')}</span>}
                              {t.distance_km && <span className="ml-1.5">· {t.distance_km}km</span>}
                            </div>
                            {t.memo && <div className="mt-1 text-[13px] text-slate-600">{t.memo}</div>}
                            <div className="mt-1 text-[11px] text-slate-400">{tt('registered_by')}: {getDisplayName(t.created_by)}{t.updated_by != null && ` · ${tt('updated_by')}: ${getDisplayName(t.updated_by)}`}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => openTransportForm(t)} className="cursor-pointer rounded-md border-0 bg-slate-100 p-1.5 text-slate-600" title={tt('edit')}><Pencil className="h-[14px] w-[14px]" /></button>
                              <button type="button" onClick={() => handleDeleteTransport(t)} className="cursor-pointer rounded-md border-0 bg-red-100 p-1.5 text-red-800" title={tt('delete')}><Trash2 className="h-[14px] w-[14px]" /></button>
                            </div>
                            {!t.show_in_itinerary && (
                              <button
                                type="button"
                                onClick={() => void handleAddToItinerary('transport', t.id)}
                                className="cursor-pointer rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"
                              >
                                {tt('save_and_add_to_itinerary')}
                              </button>
                            )}
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
              <div className="mt-6">
                <h3 className="m-0 mb-3 flex items-center gap-1.5 text-[15px] font-semibold text-slate-600">
                  <MapPin className="h-[18px] w-[18px]" />
                  {uiText.mapSectionTitle}
                </h3>
                {!showTravelMap ? (
                  <div
                    className="flex h-80 w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 bg-cover bg-center p-5 text-slate-500"
                    style={{ backgroundImage: 'linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.82)), url(/images/map-placeholder-bg.png)' }}
                  >
                    <p className="mb-2 text-[15px] font-semibold text-slate-600">
                      📍 {tt('show_map_btn')}
                    </p>
                    <p className="mb-4 max-w-80 text-center text-[13px] leading-[1.5]">
                      {tt('map_placeholder_desc')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTravelMap(true)}
                      className="cursor-pointer rounded-lg border-0 bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      {tt('show_map_btn')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      id="travel-planner-map"
                      className="h-80 w-full rounded-xl border border-slate-200 bg-slate-100"
                    />
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      {tt('map_hint')}
                      <button
                        type="button"
                        onClick={() => setShowTravelMap(false)}
                        className="ml-auto cursor-pointer border-0 bg-transparent text-xs text-slate-400 underline"
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            {loading && urlTripId ? (
              <div className="text-slate-500">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                {tt('dashboard_trips_loading')}
              </div>
            ) : (
              <>
                <MapPin className="mx-auto mb-4 h-12 w-12 text-slate-400 opacity-60" />
                <p className="m-0 text-sm text-slate-500">{tt('select_or_add_trip')}</p>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="mt-4 cursor-pointer rounded-lg border-0 bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  {uiText.goToDashboard}
                </button>
              </>
            )}
          </div>
        )}

      {showTripForm && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && router.push('/dashboard')}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{tt('add_trip')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => router.push('/dashboard')}
                className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTrip} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_title')}</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder={tt('placeholder_trip_title')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_destination')}</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                placeholder={tt('placeholder_destination')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_start_date')}</label>
              <div className="mb-3 overflow-hidden rounded-lg">
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required
                  className="block box-border min-h-10 w-full min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_end_date')}</label>
              <div className="mb-5 overflow-hidden rounded-lg">
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  required
                  className="block box-border min-h-10 w-full min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
              {isTripAdmin && (
                <>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_trip_currency')}</label>
                  <select
                    value={formTripCurrency}
                    onChange={(e) => setFormTripCurrency(e.target.value)}
                    className="mb-5 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {TRIP_CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {formatCurrencyOptionLabel(c, localeForMoney)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  disabled={submitting}
                  className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${
                    submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'
                  }`}
                >
                  {tt('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${
                    submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTripEditForm && selectedTrip && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setShowTripEditForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{tt('edit_trip')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowTripEditForm(false)}
                className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateTrip} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_title')}</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder={tt('placeholder_trip_title')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_destination')}</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                placeholder={tt('placeholder_destination')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_start_date')}</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                required
                className="mb-3 block box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_end_date')}</label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                required
                className="mb-3 block box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_budget')}</label>
              <input
                type="number"
                min={0}
                step={1}
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder={tt('placeholder_budget')}
                className="mb-3 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              {isTripAdmin && (
                <>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_trip_currency')}</label>
                  <select
                    value={formTripCurrency}
                    onChange={(e) => setFormTripCurrency(e.target.value)}
                    className="mb-5 box-border min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {TRIP_CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {formatCurrencyOptionLabel(c, localeForMoney)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTripEditForm(false)}
                  disabled={submitting}
                  className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${
                    submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'
                  }`}
                >
                  {tt('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${
                    submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tt('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScheduleAddTypePicker && selectedTrip && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowScheduleAddTypePicker(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[380px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{tt('schedule_add_type_prompt')}</h3>
              <button type="button" onClick={() => setShowScheduleAddTypePicker(false)} className="cursor-pointer border-0 bg-transparent p-1 text-slate-500"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleAddTypePicker(false);
                  setAccommodationFormFromSchedule(true);
                  setShowAccommodationForm(true);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm"
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
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm"
              >
                🍽️ {tt('add_dining')}
              </button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'attraction'); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm">🏛️ {tt('place_type_attraction')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_air'); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm">✈️ {tt('place_type_transport_air')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_car'); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm">🚗 {tt('place_type_transport_car')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'transport_bike'); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm">🚲 {tt('place_type_transport_bike')}</button>
              <button type="button" onClick={() => { setShowScheduleAddTypePicker(false); openItineraryForm(null, 'other'); }} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm">📌 {tt('place_type_other')}</button>
            </div>
          </div>
        </div>
      )}

      {showItineraryForm && selectedTrip && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setShowItineraryForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{editingItinerary ? tt('edit_itinerary') : tt('add_itinerary')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowItineraryForm(false)}
                className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingItinerary ? handleUpdateItinerary : handleCreateItinerary} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_date')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="date"
                  value={itineraryDayDate}
                  onChange={(e) => setItineraryDayDate(e.target.value)}
                  required
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="mb-3 flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_start_time')}</label>
                  <div className="overflow-hidden rounded-[10px] border border-slate-200">
                    <input
                      type="time"
                      value={itineraryStartTime}
                      onChange={(e) => setItineraryStartTime(e.target.value)}
                      className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_end_time')}</label>
                  <div className="overflow-hidden rounded-[10px] border border-slate-200">
                    <input
                      type="time"
                      value={itineraryEndTime}
                      onChange={(e) => setItineraryEndTime(e.target.value)}
                      className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_title')}</label>
              <input
                value={itineraryTitle}
                onChange={(e) => setItineraryTitle(e.target.value)}
                required
                placeholder={tt('placeholder_itinerary_title')}
                className="mb-3 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_description')}</label>
              <textarea
                value={itineraryDescription}
                onChange={(e) => setItineraryDescription(e.target.value)}
                placeholder={tt('placeholder_optional')}
                rows={3}
                className="mb-3 w-full resize-y box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_place_type')}</label>
              <select
                value={itineraryPlaceType}
                onChange={(e) => setItineraryPlaceType(e.target.value as '' | 'attraction' | 'transport_air' | 'transport_car' | 'transport_bike' | 'other')}
                className="mb-3 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="attraction">{tt('place_type_attraction')} 🏛️</option>
                <option value="transport_air">{tt('place_type_transport_air')} ✈️</option>
                <option value="transport_car">{tt('place_type_transport_car')} 🚗</option>
                <option value="transport_bike">{tt('place_type_transport_bike')} 🚲</option>
                <option value="other">{tt('place_type_other')} 📌</option>
              </select>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_address')}</label>
              <input
                ref={itineraryAddressInputRef}
                value={itineraryAddress}
                onChange={(e) => setItineraryAddress(e.target.value)}
                placeholder={tt('placeholder_search_address')}
                className="mb-1 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              {itineraryPlaceName && (
                <div className="mb-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(itineraryPlaceName)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details className="mb-5">
                <summary className="cursor-pointer text-xs text-slate-500">{uiText.coordInputAdvanced}</summary>
                <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={itineraryLatitude}
                    onChange={(e) => setItineraryLatitude(e.target.value)}
                    placeholder={tt('placeholder_lat')}
                    className="min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={itineraryLongitude}
                    onChange={(e) => setItineraryLongitude(e.target.value)}
                    placeholder={tt('placeholder_lng')}
                    className="min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>
                </div>
              </details>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItineraryForm(false)}
                  disabled={submitting}
                  className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${
                    submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'
                  }`}
                >
                  {tt('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${
                    submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingItinerary ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseForm && selectedTrip && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setShowExpenseForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{editingExpense ? tt('edit_expense') : tt('add_expense')}</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowExpenseForm(false)}
                className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_category')}</label>
              <input
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                placeholder={tt('placeholder_category')}
                className="mb-3 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{expenseAmountLabel}</label>
              <input
                type="number"
                min={0}
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                placeholder="0"
                className="mb-3 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_date')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_memo')}</label>
              <input
                value={expenseMemo}
                onChange={(e) => setExpenseMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                className="mb-5 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  disabled={submitting}
                  className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${
                    submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'
                  }`}
                >
                  {tt('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${
                    submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingExpense ? tt('save') : tt('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccommodationForm && selectedTrip && (
        <div
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setShowAccommodationForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{editingAccommodation ? tt('edit_accommodation') : tt('add_accommodation')}</h3>
              <button type="button" disabled={submitting} onClick={() => setShowAccommodationForm(false)} className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form ref={accommodationFormRef} onSubmit={(e) => { e.preventDefault(); if (editingAccommodation) handleUpdateAccommodation(e); }} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_acc_name')}</label>
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
                className="mb-2 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
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
                {uiText.directInputMode}
              </label>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_checkin')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="date"
                  value={accCheckIn}
                  onChange={(e) => setAccCheckIn(e.target.value)}
                  required
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_checkout')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="date"
                  value={accCheckOut}
                  onChange={(e) => setAccCheckOut(e.target.value)}
                  required
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_address')}</label>
              <input
                value={accAddress}
                readOnly={!accDirectInputMode}
                onChange={(e) => {
                  if (accDirectInputMode) setAccAddress(e.target.value);
                }}
                placeholder={
                  accDirectInputMode
                    ? tt('placeholder_search_address')
                    : uiText.placeFillHint
                }
                className={`mb-1 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                  accDirectInputMode ? 'bg-white' : 'bg-slate-50'
                }`}
              />
              {accPlaceName && (
                <div className="mb-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(accPlaceName)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details className="mb-3">
                <summary className="cursor-pointer text-xs text-slate-500">{uiText.coordInputAdvanced}</summary>
                <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLatitude}
                    readOnly={!accDirectInputMode}
                    onChange={(e) => {
                      if (accDirectInputMode) setAccLatitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lat')}
                    className={`min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                      accDirectInputMode ? 'bg-white' : 'bg-slate-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={accLongitude}
                    readOnly={!accDirectInputMode}
                    onChange={(e) => {
                      if (accDirectInputMode) setAccLongitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lng')}
                    className={`min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                      accDirectInputMode ? 'bg-white' : 'bg-slate-50'
                    }`}
                  />
                </div>
                </div>
              </details>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_memo')}</label>
              <input
                value={accMemo}
                onChange={(e) => setAccMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                className="mb-5 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setShowAccommodationForm(false)} disabled={submitting} className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'}`}>{tt('cancel')}</button>
                {editingAccommodation ? (
                  <button type="submit" disabled={submitting} className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
                    className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tt('add')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAccommodation(e, false)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-slate-500 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAccommodation(e, true)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-purple-600 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setShowDiningForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold text-slate-800">{editingDining ? tt('edit_dining') : tt('add_dining')}</h3>
              <button type="button" disabled={submitting} onClick={() => setShowDiningForm(false)} className="cursor-pointer border-0 bg-transparent p-1 text-slate-500 disabled:cursor-not-allowed">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form ref={diningFormRef} onSubmit={(e) => { e.preventDefault(); if (editingDining) handleUpdateDining(e); }} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_name')}</label>
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
                className="mb-2 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
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
                {uiText.directInputMode}
              </label>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_date')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="date"
                  value={diningDayDate}
                  onChange={(e) => setDiningDayDate(e.target.value)}
                  required
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_time')}</label>
              <div className="mb-3 overflow-hidden rounded-[10px] border border-slate-200">
                <input
                  type="time"
                  value={diningTime}
                  onChange={(e) => setDiningTime(e.target.value)}
                  className="min-h-10 w-full box-border border-0 px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_dining_category')}</label>
              <input
                value={diningCategory}
                onChange={(e) => setDiningCategory(e.target.value)}
                placeholder={tt('placeholder_select')}
                className="mb-3 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_address')}</label>
              <input
                value={diningAddress}
                readOnly={!diningDirectInputMode}
                onChange={(e) => {
                  if (diningDirectInputMode) setDiningAddress(e.target.value);
                }}
                placeholder={
                  diningDirectInputMode
                    ? tt('placeholder_search_address')
                    : uiText.placeFillHint
                }
                className={`mb-1 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                  diningDirectInputMode ? 'bg-white' : 'bg-slate-50'
                }`}
              />
              {diningPlaceName && (
                <div className="mb-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(diningPlaceName)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <details className="mb-3">
                <summary className="cursor-pointer text-xs text-slate-500">{uiText.coordInputAdvanced}</summary>
                <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lat_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLatitude}
                    readOnly={!diningDirectInputMode}
                    onChange={(e) => {
                      if (diningDirectInputMode) setDiningLatitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lat')}
                    className={`min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                      diningDirectInputMode ? 'bg-white' : 'bg-slate-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_lng_map')}</label>
                  <input
                    type="number"
                    step="any"
                    value={diningLongitude}
                    readOnly={!diningDirectInputMode}
                    onChange={(e) => {
                      if (diningDirectInputMode) setDiningLongitude(e.target.value);
                    }}
                    placeholder={tt('placeholder_lng')}
                    className={`min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${
                      diningDirectInputMode ? 'bg-white' : 'bg-slate-50'
                    }`}
                  />
                </div>
                </div>
              </details>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_memo')}</label>
              <input
                value={diningMemo}
                onChange={(e) => setDiningMemo(e.target.value)}
                placeholder={tt('placeholder_optional')}
                className="mb-5 min-h-10 w-full box-border rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setShowDiningForm(false)} disabled={submitting} className={`rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold ${submitting ? 'cursor-not-allowed bg-slate-100 text-slate-600' : 'cursor-pointer bg-slate-100 text-slate-600'}`}>{tt('cancel')}</button>
                {editingDining ? (
                  <button type="submit" disabled={submitting} className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
                    className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tt('add')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateDining(e, false)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-slate-500 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateDining(e, true)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-purple-600 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 px-4"
          onClick={() => !submitting && setShowAttractionForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-lg font-bold text-slate-800">{uiText.attractionTitle(!!editingAttraction)}</h3>
              <button
                type="button"
                onClick={() => !submitting && setShowAttractionForm(false)}
                className={`border-0 bg-transparent p-1 text-slate-500 ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form ref={attractionFormRef} onSubmit={(e) => { e.preventDefault(); if (editingAttraction) handleUpdateAttraction(e); }} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_name')}</label>
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
                className="mb-2 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                required
              />
              <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
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
                {uiText.directInputMode}
              </label>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_date')}</label>
              <input
                type="date"
                value={attractionDayDate}
                onChange={(e) => setAttractionDayDate(e.target.value)}
                disabled={submitting}
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                required
              />
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_start_time')}</label>
                  <input
                    type="time"
                    value={attractionStartTime}
                    onChange={(e) => setAttractionStartTime(e.target.value)}
                    disabled={submitting}
                    className="w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_end_time')}</label>
                  <input
                    type="time"
                    value={attractionEndTime}
                    onChange={(e) => setAttractionEndTime(e.target.value)}
                    disabled={submitting}
                    className="w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_address')}</label>
              <input
                type="text"
                value={attractionAddress}
                readOnly={!attractionDirectInputMode}
                onChange={(e) => {
                  if (attractionDirectInputMode) setAttractionAddress(e.target.value);
                }}
                disabled={submitting}
                placeholder={
                  attractionDirectInputMode ? tt('placeholder_address') : uiText.placeFillHint
                }
                className={`mb-1 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm ${
                  attractionDirectInputMode ? 'bg-white' : 'bg-slate-50'
                }`}
              />
              {attractionPlaceName && (
                <div className="mb-3">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(attractionPlaceName)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500">
                    {tt('link_google_search')}
                  </a>
                </div>
              )}
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_description')}</label>
              <textarea
                value={attractionDescription}
                onChange={(e) => setAttractionDescription(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_description')}
                rows={3}
                className="mb-3 w-full resize-y box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <div className="flex justify-end gap-2">
                {editingAttraction ? (
                  <button type="submit" disabled={submitting} className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tt('save')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAttraction(e, false)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-slate-500 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateAttraction(e, true)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-purple-600 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_and_add_to_itinerary')}
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
          className="fixed inset-0 z-50 box-border flex items-center justify-center bg-black/50 px-4"
          onClick={() => !submitting && setShowTransportForm(false)}
        >
          <div
            className="w-[90%] min-w-0 max-w-[400px] overflow-hidden rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-lg font-bold text-slate-800">{uiText.transportTitle(!!editingTransport)}</h3>
              <button
                type="button"
                onClick={() => !submitting && setShowTransportForm(false)}
                className={`border-0 bg-transparent p-1 text-slate-500 ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form ref={transportFormRef} onSubmit={(e) => { e.preventDefault(); if (editingTransport) handleUpdateTransport(e); }} className="min-w-0 overflow-hidden">
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_transport_type')}</label>
              <select
                value={transportType}
                onChange={(e) => setTransportType(e.target.value as 'air' | 'train' | 'car' | 'bike')}
                disabled={submitting}
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="air">{tt('transport_type_air')}</option>
                <option value="train">{tt('transport_type_train')}</option>
                <option value="car">{tt('transport_type_car')}</option>
                <option value="bike">{tt('transport_type_bike')}</option>
              </select>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_date')}</label>
              <input
                type="date"
                value={transportDayDate}
                onChange={(e) => setTransportDayDate(e.target.value)}
                disabled={submitting}
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                required
              />
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_start_time')}</label>
                  <input
                    type="time"
                    value={transportStartTime}
                    onChange={(e) => setTransportStartTime(e.target.value)}
                    disabled={submitting}
                    className="w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_end_time')}</label>
                  <input
                    type="time"
                    value={transportEndTime}
                    onChange={(e) => setTransportEndTime(e.target.value)}
                    disabled={submitting}
                    className="w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_departure')}</label>
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
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_arrival')}</label>
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
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
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
                {uiText.directInputMode}
              </label>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_distance_km')}</label>
              <input
                type="number"
                value={transportDistanceKm}
                onChange={(e) => setTransportDistanceKm(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_distance_km')}
                className="mb-3 w-full box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="mb-1 block text-[13px] font-medium text-slate-600">{tt('label_memo')}</label>
              <textarea
                value={transportMemo}
                onChange={(e) => setTransportMemo(e.target.value)}
                disabled={submitting}
                placeholder={tt('placeholder_memo')}
                rows={2}
                className="mb-3 w-full resize-y box-border rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
              <div className="flex justify-end gap-2">
                {editingTransport ? (
                  <button type="submit" disabled={submitting} className={`inline-flex items-center gap-1.5 rounded-lg border-0 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed bg-purple-600' : 'cursor-pointer bg-purple-600'}`}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tt('save')}
                  </button>
                ) : (
                  <>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateTransport(e, false)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-slate-500 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_only')}
                    </button>
                    <button type="button" disabled={submitting} onClick={(e) => handleCreateTransport(e, true)} className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-purple-600 px-[18px] py-2.5 text-sm font-semibold text-white ${submitting ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {tt('save_and_add_to_itinerary')}
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
