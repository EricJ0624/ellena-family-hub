/**
 * 가족 위치(Family Location) 섹션 컴포넌트
 * 
 * 주의: Google Maps 로직과 복잡한 상태 관리는 dashboard에 남겨두고,
 * 이 컴포넌트는 UI 렌더링만 담당합니다.
 */

'use client';

import React from 'react';
import type { FamilyLocation, LocationRequest } from '../types';

interface FamilyLocationSectionProps {
  userId: string;
  currentGroupId: string | null;
  familyLocations: FamilyLocation[];
  locationRequests: LocationRequest[];
  isLocationSharing: boolean;
  myLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  onShareLocation: () => void;
  onRequestAction: (requestId: string, action: 'accept' | 'reject' | 'cancel') => void;
  onEndSharing: (requestId: string) => void;
  onOpenRequestModal: () => void;
  extractLocationAddress: (address: string) => string;
  mapError: string | null;
  requestUsers: Array<{
    id: string;
    nickname?: string;
    email?: string;
  }>;
  translations: {
    section_title_location: string;
    location_where_btn: string;
    location_share_btn: string;
    piggy_request_sent: string;
    piggy_request_received: string;
  };
}

export function FamilyLocationSection({
  userId,
  currentGroupId,
  familyLocations,
  locationRequests,
  isLocationSharing,
  myLocation,
  onShareLocation,
  onRequestAction,
  onEndSharing,
  onOpenRequestModal,
  extractLocationAddress,
  mapError,
  requestUsers,
  translations: t,
}: FamilyLocationSectionProps) {
  return (
    <section className="content-section">
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          {t.section_title_location}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentGroupId && (
            <button
              onClick={onOpenRequestModal}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📬</span>
              <span>요청 보내기</span>
            </button>
          )}
          <button
            onClick={onShareLocation}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📍</span>
            <span>{t.location_where_btn}</span>
          </button>
        </div>
      </div>
      <div className="section-body">
        {myLocation.address && (myLocation.latitude !== 0 || myLocation.longitude !== 0) && (
          <div style={{ marginBottom: '16px' }}>
            <p className="location-text" style={{ marginBottom: '12px' }}>
              내 위치: {extractLocationAddress(myLocation.address)}
            </p>
          </div>
        )}

        {/* 지도 영역 - dashboard에서 렌더링 */}
        {!isLocationSharing ? (
          <div
            style={{
              width: '100%',
              height: '400px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage: 'linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.82)), url(/images/map-placeholder-bg.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#64748b',
              padding: '20px',
            }}
          >
            <p style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', color: '#475569' }}>📍 지도</p>
            <p style={{ fontSize: '13px', lineHeight: '1.5', textAlign: 'center', maxWidth: '320px' }}>
              위치 공유를 켜면 지도에서 가족 위치를 볼 수 있습니다.
            </p>
          </div>
        ) : mapError ? (
          <div
            style={{
              width: '100%',
              height: '400px',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              padding: '20px',
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#dc2626' }}>⚠️ Google Maps 오류</p>
              <p style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>{mapError}</p>
              {(myLocation.latitude !== 0 || myLocation.longitude !== 0) && (
                <a
                  href={`https://www.google.com/maps?q=${myLocation.latitude},${myLocation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#dc2626', textDecoration: 'underline', fontSize: '14px', fontWeight: '500' }}
                >
                  Google 지도에서 위치 보기
                </a>
              )}
            </div>
          </div>
        ) : (
          <div id="map" style={{ width: '100%', height: '400px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '12px' }} />
        )}

        {/* 위치 요청 목록 */}
        {locationRequests.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>위치 요청</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Pending 요청 */}
              {locationRequests
                .filter((req) => req.status === 'pending')
                .map((req) => {
                  const isRequester = req.requester_id === userId;
                  const otherUserId = isRequester ? req.target_user_id : req.requester_id;
                  const otherUser = requestUsers.find((u) => u.id === otherUserId);
                  const otherUserName = otherUser?.nickname || otherUser?.email || otherUserId.substring(0, 8) || '알 수 없음';

                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>{isRequester ? `→ ${otherUserName}` : `← ${otherUserName}`}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {isRequester ? t.piggy_request_sent : t.piggy_request_received}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isRequester ? (
                          <button
                            onClick={() => onRequestAction(req.id, 'cancel')}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            취소
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onRequestAction(req.id, 'accept')}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span>📍</span>
                              <span>{t.location_share_btn}</span>
                            </button>
                            <button
                              onClick={() => onRequestAction(req.id, 'reject')}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              거부
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* Accepted 요청 (활성 위치 공유) */}
              {locationRequests
                .filter((req) => req.status === 'accepted')
                .map((req) => {
                  const isRequester = req.requester_id === userId;
                  const otherUserId = isRequester ? req.target_user_id : req.requester_id;
                  const otherUser = requestUsers.find((u) => u.id === otherUserId);
                  const otherUserName = otherUser?.nickname || otherUser?.email || otherUserId.substring(0, 8) || '알 수 없음';

                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: '12px',
                        backgroundColor: '#d1fae5',
                        borderRadius: '8px',
                        border: '1px solid #10b981',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '4px', color: '#059669' }}>✓ {otherUserName}와(과) 위치 공유 중</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>📍 활성</div>
                      </div>
                      <button
                        onClick={() => onEndSharing(req.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        종료
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
