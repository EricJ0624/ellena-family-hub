'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useGroup } from '@/app/contexts/GroupContext';
import type { TravelTrip, TravelItinerary, TravelExpense } from '@/lib/modules/travel-planner/types';
import {
  MapPin,
  Plus,
  ChevronLeft,
  Calendar,
  ListOrdered,
  Wallet,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';

const API_BASE = '/api/v1/travel';

export function TravelPlannerContent() {
  const router = useRouter();
  const { currentGroupId, currentGroup } = useGroup();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TravelTrip | null>(null);
  const [itineraries, setItineraries] = useState<TravelItinerary[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTripForm, setShowTripForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  /** userId → 표시명 (nickname || email || '멤버'). 그룹 멤버 + 프로필에서 로드 */
  const [memberDisplayNames, setMemberDisplayNames] = useState<Map<string, string>>(new Map());

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('인증이 필요합니다.');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const fetchTrips = useCallback(async () => {
    if (!currentGroupId) return;
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/trips?groupId=${currentGroupId}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '여행 목록 조회 실패');
      setTrips(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '로드 실패');
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
      if (!res.ok) throw new Error(json.error || '일정 조회 실패');
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
      if (!res.ok) throw new Error(json.error || '경비 조회 실패');
      setExpenses(json.data ?? []);
    } catch {
      setExpenses([]);
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
          const name = (p.nickname && String(p.nickname).trim()) || p.email || '멤버';
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
    } else {
      setItineraries([]);
      setExpenses([]);
    }
  }, [selectedTrip, fetchItineraries, fetchExpenses]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroupId || !formTitle.trim() || !formStartDate || !formEndDate) {
      alert('제목, 출발일, 종료일을 입력해주세요.');
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      alert('종료일은 출발일 이후여야 합니다.');
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
      if (!res.ok) throw new Error(json.error || '여행 생성 실패');
      setFormTitle('');
      setFormDestination('');
      setFormStartDate('');
      setFormEndDate('');
      setShowTripForm(false);
      await fetchTrips();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '생성 실패');
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
      if (!res.ok) throw new Error(json.error || '삭제 실패');
      if (selectedTrip?.id === trip.id) setSelectedTrip(null);
      await fetchTrips();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  if (!currentGroupId) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <MapPin style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.6 }} />
          <p>그룹을 선택한 후 이용해주세요.</p>
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

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b' }}>가족 여행 플래너</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>{currentGroup?.name ?? '그룹'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTripForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9333ea',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Plus style={{ width: 18, height: 18 }} />
          여행 추가
        </button>
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedTrip ? '280px 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: '#475569' }}>여행 목록</h2>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              로딩 중...
            </div>
          ) : trips.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>등록된 여행이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {trips.map((t) => (
                <li
                  key={t.id}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    marginBottom: 6,
                    backgroundColor: selectedTrip?.id === t.id ? '#f3e8ff' : 'transparent',
                    border: selectedTrip?.id === t.id ? '1px solid #e9d5ff' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onClick={() => setSelectedTrip(t)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {t.start_date} ~ {t.end_date}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      등록: {getDisplayName(t.created_by)}
                      {t.updated_by != null && ` · 수정: ${getDisplayName(t.updated_by)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDeleteTrip(t);
                    }}
                    style={{
                      padding: 6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                    }}
                    aria-label="삭제"
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedTrip && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: 20 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ListOrdered style={{ width: 18, height: 18 }} />
                  일정
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {itineraries.length === 0 ? (
                    <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>등록된 일정이 없습니다.</li>
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
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{i.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{i.day_date}</div>
                        {i.description && <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{i.description}</div>}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                          등록: {getDisplayName(i.created_by)}
                          {i.updated_by != null && ` · 수정: ${getDisplayName(i.updated_by)}`}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet style={{ width: 18, height: 18 }} />
                  경비
                </h3>
                <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 700, color: '#9333ea' }}>
                  총 {totalExpense.toLocaleString('ko-KR')}원
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {expenses.length === 0 ? (
                    <li style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>등록된 경비가 없습니다.</li>
                  ) : (
                    expenses.slice(0, 10).map((e) => (
                      <li
                        key={e.id}
                        style={{
                          padding: '8px 12px',
                          marginBottom: 4,
                          background: '#f8fafc',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <span>{e.category || '기타'}</span>
                          <span style={{ fontWeight: 600, marginLeft: 8 }}>{Number(e.amount).toLocaleString('ko-KR')}원</span>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            등록: {getDisplayName(e.created_by)}
                            {e.updated_by != null && ` · 수정: ${getDisplayName(e.updated_by)}`}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                {expenses.length > 10 && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>외 {expenses.length - 10}건</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

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
          }}
          onClick={() => !submitting && setShowTripForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>여행 추가</h3>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowTripForm(false)}
                style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <form onSubmit={handleCreateTrip}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>제목 *</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder="예: 제주도 가족여행"
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>목적지</label>
              <input
                value={formDestination}
                onChange={(e) => setFormDestination(e.target.value)}
                placeholder="예: 제주시"
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>출발일 *</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                required
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#475569', marginBottom: 4 }}>종료일 *</label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                required
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
                  onClick={() => setShowTripForm(false)}
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

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
