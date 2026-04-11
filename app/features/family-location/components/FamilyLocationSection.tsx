/**
 * 가족 위치 섹션 UI — 지도는 `#map` div만 제공하고 초기화·마커 로직은 대시보드에 유지
 */

'use client';

import React from 'react';
import type { DashboardLocationRequestRow } from '../types';
import type { DashboardTranslations } from '@/lib/translations/dashboard';

export type FamilyLocationSectionTranslations = Pick<
  DashboardTranslations,
  | 'section_title_location'
  | 'location_where_btn'
  | 'piggy_request_sent'
  | 'piggy_request_received'
  | 'location_share_btn'
  | 'location_ui_address_prefix'
  | 'location_ui_map_title'
  | 'location_ui_map_hint_off'
  | 'location_ui_gmaps_error_title'
  | 'location_ui_troubleshoot_title'
  | 'location_ui_troubleshoot_1'
  | 'location_ui_troubleshoot_2'
  | 'location_ui_troubleshoot_3'
  | 'location_ui_troubleshoot_4'
  | 'location_ui_troubleshoot_note'
  | 'location_ui_open_in_gmaps'
  | 'location_ui_api_key_title'
  | 'location_ui_api_setup_title'
  | 'location_ui_api_li1_before'
  | 'location_ui_api_li1_after'
  | 'location_ui_api_li2_intro'
  | 'location_ui_api_env_example'
  | 'location_ui_api_li3_before'
  | 'location_ui_api_li3_after'
  | 'location_ui_api_hint_before'
  | 'location_ui_api_hint_after'
  | 'location_ui_or_maps_before'
  | 'location_ui_or_maps_link'
  | 'location_ui_requests_heading'
  | 'location_ui_unknown_user'
  | 'location_ui_dot_time_left'
  | 'location_ui_expired_suffix'
  | 'location_ui_pin_time_left'
  | 'location_ui_pin_expired'
  | 'location_ui_sharing_with'
  | 'location_ui_end_sharing'
>;

type Props = {
  onOpenRequestModal: () => void;
  myLocation: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  extractLocationAddress: (address: string) => string;
  isLocationSharing: boolean;
  mapError: string | null;
  hasGoogleMapsApiKey: boolean;
  locationRequests: DashboardLocationRequestRow[];
  userId: string;
  onLocationRequestAction: (requestId: string, action: 'accept' | 'reject' | 'cancel') => void;
  onEndLocationSharing: (requestId: string) => void;
  translations: FamilyLocationSectionTranslations;
  cancelLabel: string;
  rejectLabel: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (lang: any, role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  lang: any;
};

function fillHm(template: string, h: number, m: number) {
  return template.replace(/\{h\}/g, String(h)).replace(/\{m\}/g, String(m));
}

function fillName(template: string, name: string) {
  return template.replace(/\{name\}/g, name);
}

export function FamilyLocationSection({
  onOpenRequestModal,
  myLocation,
  extractLocationAddress,
  isLocationSharing,
  mapError,
  hasGoogleMapsApiKey,
  locationRequests,
  userId,
  onLocationRequestAction,
  onEndLocationSharing,
  translations: t,
  cancelLabel,
  rejectLabel,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
}: Props) {
  const lat = myLocation.latitude ?? 0;
  const lng = myLocation.longitude ?? 0;

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{t.section_title_location}</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpenRequestModal}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
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
        {myLocation.address && (lat !== 0 || lng !== 0) && (
          <div style={{ marginBottom: '16px' }}>
            <p className="location-text" style={{ marginBottom: '12px' }}>
              {t.location_ui_address_prefix} {extractLocationAddress(myLocation.address)}
            </p>
          </div>
        )}

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
              backgroundImage:
                'linear-gradient(rgba(248, 250, 252, 0.82), rgba(248, 250, 252, 0.82)), url(/images/map-placeholder-bg.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#64748b',
              padding: '20px',
            }}
          >
            <p style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', color: '#475569' }}>
              {t.location_ui_map_title}
            </p>
            <p style={{ fontSize: '13px', lineHeight: '1.5', textAlign: 'center', maxWidth: '320px' }}>
              {t.location_ui_map_hint_off}
            </p>
          </div>
        ) : hasGoogleMapsApiKey ? (
          mapError ? (
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
                <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#dc2626' }}>
                  {t.location_ui_gmaps_error_title}
                </p>
                <p style={{ fontSize: '14px', marginBottom: '16px', lineHeight: '1.6' }}>{mapError}</p>
                <div
                  style={{
                    backgroundColor: '#fee2e2',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                  }}
                >
                  <p style={{ fontWeight: '600', marginBottom: '8px' }}>{t.location_ui_troubleshoot_title}</p>
                  <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                    <li>
                      <a
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#dc2626', textDecoration: 'underline' }}
                      >
                        {t.location_ui_troubleshoot_1}
                      </a>
                    </li>
                    <li>{t.location_ui_troubleshoot_2}</li>
                    <li>{t.location_ui_troubleshoot_3}</li>
                    <li>{t.location_ui_troubleshoot_4}</li>
                  </ol>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#991b1b' }}>{t.location_ui_troubleshoot_note}</p>
                </div>
                {(lat !== 0 || lng !== 0) && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#dc2626',
                      textDecoration: 'underline',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    {t.location_ui_open_in_gmaps}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div
              id="map"
              style={{
                width: '100%',
                height: '400px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginTop: '12px',
              }}
            />
          )
        ) : null}
        {isLocationSharing && !hasGoogleMapsApiKey ? (
          <div
            style={{
              width: '100%',
              height: '400px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              padding: '20px',
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                {t.location_ui_api_key_title}
              </p>
              <div
                style={{
                  fontSize: '13px',
                  textAlign: 'left',
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '12px',
                }}
              >
                <p style={{ marginBottom: '8px', fontWeight: '600' }}>{t.location_ui_api_setup_title}</p>
                <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                  <li>
                    {t.location_ui_api_li1_before}
                    <code
                      style={{
                        backgroundColor: '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      .env.local
                    </code>
                    {t.location_ui_api_li1_after}
                  </li>
                  <li>
                    {t.location_ui_api_li2_intro}
                    <br />
                    <code
                      style={{
                        backgroundColor: '#f1f5f9',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        display: 'inline-block',
                        marginTop: '4px',
                      }}
                    >
                      {t.location_ui_api_env_example}
                    </code>
                  </li>
                  <li>
                    {t.location_ui_api_li3_before}
                    <code
                      style={{
                        backgroundColor: '#f1f5f9',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      npm run dev
                    </code>
                    {t.location_ui_api_li3_after}
                  </li>
                </ol>
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                  {t.location_ui_api_hint_before}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6' }}
                  >
                    Google Cloud Console
                  </a>
                  {t.location_ui_api_hint_after}
                </p>
              </div>
              {(lat !== 0 || lng !== 0) && (
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                  {t.location_ui_or_maps_before}
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'underline' }}
                  >
                    {t.location_ui_or_maps_link}
                  </a>
                </p>
              )}
            </div>
          </div>
        ) : null}

        {locationRequests.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>{t.location_ui_requests_heading}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {locationRequests
                .filter((req) => req.status === 'pending')
                .map((req) => {
                  const isRequester = req.requester_id === userId;
                  const otherUser = isRequester ? req.target : req.requester;
                  const otherUserName =
                    otherUser?.nickname || otherUser?.email || otherUser?.id?.substring(0, 8) || t.location_ui_unknown_user;
                  const otherUserId = otherUser?.id;
                  const otherUserRole = otherUserId && familyRoleByUserId[otherUserId];
                  const roleDisplay = otherUserRole ? ` ${getFamilyRoleEmoji(otherUserRole)} ${getFamilyRoleLabel(lang, otherUserRole)}` : '';
                  const expiresAt = req.expires_at ? new Date(req.expires_at) : null;
                  const now = new Date();
                  const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)) : 0;
                  const isExpired = expiresAt ? expiresAt < now : false;

                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: '12px',
                        backgroundColor: isExpired ? '#fee2e2' : '#f8fafc',
                        borderRadius: '8px',
                        border: `1px solid ${isExpired ? '#fca5a5' : '#e2e8f0'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {isRequester ? `→ ${otherUserName}${roleDisplay}` : `← ${otherUserName}${roleDisplay}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {isRequester ? t.piggy_request_sent : t.piggy_request_received}
                          {!isExpired && timeLeft > 0 && (
                            <span style={{ marginLeft: '8px' }}>
                              {fillHm(t.location_ui_dot_time_left, Math.floor(timeLeft / 60), timeLeft % 60)}
                            </span>
                          )}
                          {isExpired && (
                            <span style={{ marginLeft: '8px', color: '#ef4444' }}>{t.location_ui_expired_suffix}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isRequester ? (
                          <button
                            type="button"
                            onClick={() => onLocationRequestAction(req.id, 'cancel')}
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
                            {cancelLabel}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onLocationRequestAction(req.id, 'accept')}
                              disabled={isExpired}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: isExpired ? '#cbd5e1' : '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: isExpired ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: isExpired ? 0.6 : 1,
                              }}
                            >
                              <span>📍</span>
                              <span>{t.location_share_btn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onLocationRequestAction(req.id, 'reject')}
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
                              {rejectLabel}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

              {locationRequests
                .filter((req) => req.status === 'accepted')
                .map((req) => {
                  const isRequester = req.requester_id === userId;
                  const otherUser = isRequester ? req.target : req.requester;
                  const otherUserName =
                    otherUser?.nickname || otherUser?.email || otherUser?.id?.substring(0, 8) || t.location_ui_unknown_user;
                  const otherUserId = otherUser?.id;
                  const otherUserRole = otherUserId && familyRoleByUserId[otherUserId];
                  const roleDisplay = otherUserRole ? ` ${getFamilyRoleEmoji(otherUserRole)} ${getFamilyRoleLabel(lang, otherUserRole)}` : '';
                  const expiresAt = req.expires_at ? new Date(req.expires_at) : null;
                  const now = new Date();
                  const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)) : 0;
                  const isExpired = expiresAt ? expiresAt < now : false;

                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: '12px',
                        backgroundColor: isExpired ? '#fee2e2' : '#d1fae5',
                        borderRadius: '8px',
                        border: `1px solid ${isExpired ? '#fca5a5' : '#10b981'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '4px', color: '#059669' }}>
                          {fillName(t.location_ui_sharing_with, otherUserName + roleDisplay)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {!isExpired && timeLeft > 0 ? (
                            <span>
                              {fillHm(t.location_ui_pin_time_left, Math.floor(timeLeft / 60), timeLeft % 60)}
                            </span>
                          ) : (
                            <span style={{ color: '#ef4444' }}>{t.location_ui_pin_expired}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEndLocationSharing(req.id)}
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
                        {t.location_ui_end_sharing}
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
