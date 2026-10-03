'use client';

/**
 * PlaceAutocompleteInput
 *
 * 캐시 우선 장소 자동완성 컴포넌트.
 *
 * 동작 순서:
 * 1. 사용자가 2자 이상 입력 → /api/place-cache?q=... 로 캐시 검색
 * 2. 캐시 결과 있음 → 캐시 목록만 표시 (Google 호출 없음)
 * 3. 캐시 결과 없음 or 사용자가 "Google에서 더 찾기" 클릭
 *    → Google AutocompleteService 호출 → 예측 목록 표시
 * 4. 캐시 항목 선택 → onSelect (placeId, 주소, 좌표) 세팅, Google 미호출
 * 5. Google 항목 선택 → PlacesService.getDetails → onSelect 세팅 → 캐시 업서트
 * 6. 목록 미선택 → onSelect 없이 사용자가 친 이름 유지 (저장은 상위 폼에서)
 * 7. 캐시 선택 후 "정보가 틀려요" 클릭 → Google 강제 검색
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface PlaceSelectResult {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  placeId: string | null;
}

interface CacheItem {
  place_id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface GooglePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceAutocompleteInputProps {
  /** 입력칸 현재 값 */
  value: string;
  onChange: (value: string) => void;
  /** 목록에서 장소가 선택됐을 때 */
  onSelect: (result: PlaceSelectResult) => void;
  /** 입력 내용이 바뀌어 기존 선택이 무효화될 때 */
  onClear: () => void;
  /** 현재 선택된 place_id (정보가 틀려요 표시 기준) */
  selectedPlaceId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  // ── Google Maps ─────────────────────────────────────────────────
  /** google.maps 네임스페이스를 반환하는 함수 */
  getGoogleMapsNs: () => typeof google.maps | undefined;
  placesApiReady: boolean;
  /** PlacesService 공용 인스턴스 ref (초기화 비용 공유) */
  placesServiceRef: React.MutableRefObject<unknown>;
  /** PlacesService 초기화용 컨테이너 ref */
  placesServiceContainerRef: React.RefObject<HTMLDivElement | null>;
  // ── Auth ────────────────────────────────────────────────────────
  getAuthHeaders: () => Promise<Record<string, string>>;
  // ── 레이블 ──────────────────────────────────────────────────────
  /** "정보가 틀려요" 버튼 텍스트 */
  labelReportWrong?: string;
  /** "Google에서 더 찾기" 링크 텍스트 */
  labelSearchWithGoogle?: string;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 350;
const MIN_LEN = 2;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function PlaceAutocompleteInput({
  value,
  onChange,
  onSelect,
  onClear,
  selectedPlaceId,
  placeholder,
  disabled,
  required,
  className = '',
  getGoogleMapsNs,
  placesApiReady,
  placesServiceRef,
  placesServiceContainerRef,
  getAuthHeaders,
  labelReportWrong = '정보가 틀려요',
  labelSearchWithGoogle = 'Google에서 더 찾기',
}: PlaceAutocompleteInputProps) {
  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [googlePredictions, setGooglePredictions] = useState<GooglePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [loadingCache, setLoadingCache] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Google AutocompleteService 초기화 ─────────────────────────────────────
  useEffect(() => {
    if (!placesApiReady) return;
    const g = getGoogleMapsNs();
    if (!g?.places) return;
    if (g.places.AutocompleteService && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new g.places.AutocompleteService();
    }
    if (g.places.AutocompleteSessionToken && !sessionTokenRef.current) {
      sessionTokenRef.current = new g.places.AutocompleteSessionToken();
    }
  }, [placesApiReady, getGoogleMapsNs]);

  // ── 외부 클릭 시 드롭다운 닫기 ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowGoogle(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // ── Google 예측 목록 가져오기 ─────────────────────────────────────────────
  const fetchGooglePredictions = useCallback((q: string) => {
    const g = getGoogleMapsNs();

    // 서비스가 아직 초기화 안 됐으면 on-demand 초기화 시도
    if (!autocompleteServiceRef.current && g?.places?.AutocompleteService) {
      autocompleteServiceRef.current = new g.places.AutocompleteService();
    }
    if (!sessionTokenRef.current && g?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new g.places.AutocompleteSessionToken();
    }

    const svc = autocompleteServiceRef.current;
    if (!svc) {
      // Google Maps Places API 미준비 — 사용자에게 알림
      setGooglePredictions([]);
      setLoadingGoogle(false);
      return;
    }

    setLoadingGoogle(true);
    svc.getPlacePredictions(
      { input: q, sessionToken: sessionTokenRef.current ?? undefined },
      (results, status) => {
        setLoadingGoogle(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          setGooglePredictions([]);
          return;
        }
        setGooglePredictions(
          results.map((r) => ({
            placeId: r.place_id ?? '',
            description: r.description,
            mainText: r.structured_formatting?.main_text ?? r.description,
            secondaryText: r.structured_formatting?.secondary_text ?? '',
          }))
        );
      }
    );
  }, [getGoogleMapsNs]);

  // ── 캐시 검색 → 없으면 Google 자동 트리거 ─────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    setLoadingCache(true);
    let items: CacheItem[] = [];
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/place-cache?q=${encodeURIComponent(q)}`, { headers });
      if (res.ok) {
        const j = await res.json();
        items = (j.results ?? []) as CacheItem[];
      }
    } catch {
      /* 네트워크 오류는 무시 */
    }
    setCacheItems(items);
    setLoadingCache(false);
    if (items.length === 0) {
      // 캐시에 없으면 Google 자동 표시
      setShowGoogle(true);
      fetchGooglePredictions(q);
    }
  }, [getAuthHeaders, fetchGooglePredictions]);

  // ── 입력 변경 핸들러 ───────────────────────────────────────────────────────
  const handleChange = useCallback((v: string) => {
    onChange(v);
    onClear();
    setCacheItems([]);
    setGooglePredictions([]);
    setShowGoogle(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < MIN_LEN) {
      setOpen(false);
      return;
    }
    setOpen(true);
    debounceRef.current = setTimeout(() => runSearch(v.trim()), DEBOUNCE_MS);
  }, [onChange, onClear, runSearch]);

  // ── "Google에서 더 찾기" 클릭 ─────────────────────────────────────────────
  const handleShowGoogle = useCallback(() => {
    setShowGoogle(true);
    setOpen(true);
    setGooglePredictions([]);
    if (value.trim().length >= MIN_LEN) fetchGooglePredictions(value.trim());
    // 버튼 클릭 후 input으로 포커스 복귀 (드롭다운 유지)
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [value, fetchGooglePredictions]);

  // ── 캐시 항목 선택 ────────────────────────────────────────────────────────
  const handleCacheSelect = useCallback((item: CacheItem) => {
    onChange(item.name);
    onSelect({
      name: item.name,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.place_id,
    });
    setOpen(false);
    setCacheItems([]);
    setGooglePredictions([]);
    setShowGoogle(false);
  }, [onChange, onSelect]);

  // ── Google 항목 선택 → PlacesService.getDetails ───────────────────────────
  const handleGoogleSelect = useCallback((pred: GooglePrediction) => {
    const g = getGoogleMapsNs();
    const container = placesServiceContainerRef.current;
    if (!g?.places || !container) return;

    // PlacesService 공용 인스턴스 (없으면 생성)
    if (!placesServiceRef.current && g.places.PlacesService) {
      placesServiceRef.current = new g.places.PlacesService(container);
    }
    const svc = placesServiceRef.current as google.maps.places.PlacesService | null;
    if (!svc) return;

    setLoadingDetails(true);
    setOpen(false);

    svc.getDetails(
      {
        placeId: pred.placeId,
        fields: ['place_id', 'name', 'geometry', 'formatted_address'],
        sessionToken: sessionTokenRef.current ?? undefined,
      },
      async (place, status) => {
        setLoadingDetails(false);

        // 세션 토큰 갱신
        if (g.places?.AutocompleteSessionToken) {
          sessionTokenRef.current = new g.places.AutocompleteSessionToken();
        } else {
          sessionTokenRef.current = null;
        }

        const name =
          pred.mainText ||
          (place && typeof place.name === 'string' ? place.name : '') ||
          pred.description;
        const address = (place?.formatted_address) ?? pred.description;
        const lat = place?.geometry?.location?.lat?.();
        const lng = place?.geometry?.location?.lng?.();
        const placeId = (place?.place_id) ?? pred.placeId;

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          // 상세 조회 실패 시에도 예측 텍스트로 선택 처리
          onChange(name);
          onSelect({ name, address, placeId: pred.placeId });
          setCacheItems([]);
          setGooglePredictions([]);
          setShowGoogle(false);
          return;
        }

        onChange(name);
        onSelect({ name, address, latitude: lat, longitude: lng, placeId });
        setCacheItems([]);
        setGooglePredictions([]);
        setShowGoogle(false);

        // 캐시 업서트 (항상 최신 주소·좌표로 덮어씀)
        try {
          const headers = await getAuthHeaders();
          await fetch('/api/place-cache', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              place_id: placeId,
              name,
              latitude: lat,
              longitude: lng,
              formatted_address: address,
            }),
          });
        } catch {
          /* 캐시 저장 실패는 무시 */
        }
      }
    );
  }, [getGoogleMapsNs, placesServiceRef, placesServiceContainerRef, onChange, onSelect, getAuthHeaders]);

  // ── "정보가 틀려요" 클릭 → 캐시 건너뛰고 Google 강제 검색 ─────────────────
  const handleReportWrong = useCallback(() => {
    onClear();
    setShowGoogle(true);
    setOpen(true);
    setCacheItems([]);
    setGooglePredictions([]);
    if (value.trim().length >= MIN_LEN) fetchGooglePredictions(value.trim());
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onClear, value, fetchGooglePredictions]);

  const isSelected = !!selectedPlaceId;
  const hasDropdownContent =
    loadingCache ||
    cacheItems.length > 0 ||
    (showGoogle && (loadingGoogle || googlePredictions.length > 0));

  return (
    <div ref={wrapperRef} className="relative">
      {/* ── 입력칸 ── */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length >= MIN_LEN && hasDropdownContent) setOpen(true);
          }}
          disabled={disabled || loadingDetails}
          required={required}
          placeholder={placeholder}
          className={`${className} ${loadingDetails ? 'opacity-60' : ''}`}
        />
        {loadingDetails && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </span>
        )}
      </div>

      {/* ── "정보가 틀려요" 버튼 (캐시로 선택된 상태일 때) ── */}
      {isSelected && !open && (
        <button
          type="button"
          onClick={handleReportWrong}
          className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700"
        >
          <AlertCircle className="h-3 w-3" />
          {labelReportWrong}
        </button>
      )}

      {/* ── 드롭다운 ── */}
      {open && (
        <div className="absolute left-0 right-0 z-[200] mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
          {/* 캐시 로딩 */}
          {loadingCache && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              검색 중…
            </div>
          )}

          {/* 캐시 결과 */}
          {cacheItems.length > 0 && (
            <>
              <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                저장된 장소
              </p>
              {cacheItems.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCacheSelect(item);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className="block font-medium text-slate-800">{item.name}</span>
                  {item.address && (
                    <span className="block truncate text-xs text-slate-500">{item.address}</span>
                  )}
                </button>
              ))}
              {/* 캐시 결과가 있지만 Google도 보고 싶을 때 */}
              {!showGoogle && (
                <button
                  type="button"
                  onClick={handleShowGoogle}
                  className="block w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-indigo-500 hover:bg-indigo-50"
                >
                  {labelSearchWithGoogle}
                </button>
              )}
            </>
          )}

          {/* Google 결과 */}
          {showGoogle && (
            <>
              {cacheItems.length > 0 && (
                <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Google
                </p>
              )}
              {loadingGoogle && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Google 검색 중…
                </div>
              )}
              {!loadingGoogle && googlePredictions.length === 0 && !loadingCache && (
                <p className="px-3 py-2 text-xs text-slate-400">결과가 없습니다</p>
              )}
              {googlePredictions.map((pred) => (
                <button
                  key={pred.placeId}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleGoogleSelect(pred);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  <span className="block font-medium text-slate-800">{pred.mainText}</span>
                  {pred.secondaryText && (
                    <span className="block truncate text-xs text-slate-500">
                      {pred.secondaryText}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
