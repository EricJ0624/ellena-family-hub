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
  | 'location_come_btn'
  | 'location_got_it_btn'
  | 'location_request_come_label'
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
  onOpenComeHereModal: () => void;
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
  onAcceptComeHereRequest: (requestId: string, destinationLat: number, destinationLng: number) => void;
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
  onOpenComeHereModal,
  myLocation,
  extractLocationAddress,
  isLocationSharing,
  mapError,
  hasGoogleMapsApiKey,
  locationRequests,
  userId,
  onLocationRequestAction,
  onAcceptComeHereRequest,
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
  const hasRequestUi = locationRequests.some(
    (req) => req.status === 'pending' || req.status === 'accepted',
  );

  return (
    <section
      className={`content-section location-widget-section h-full min-h-0${
        hasRequestUi ? ' location-widget-section--compact' : ''
      }`}
    >
      <div className="section-header shrink-0">
        <h3 className="section-title">{t.section_title_location}</h3>
        <div className="location-header-actions">
          <button
            type="button"
            onClick={onOpenRequestModal}
            className="location-action-btn bg-emerald-500 text-white hover:bg-emerald-600"
          >
            <span>📍</span>
            <span>{t.location_where_btn}</span>
          </button>
          <button
            type="button"
            onClick={onOpenComeHereModal}
            className="location-action-btn bg-blue-500 text-white hover:bg-blue-600"
          >
            <span>🚶</span>
            <span>{t.location_come_btn}</span>
          </button>
        </div>
      </div>
      <div
        className={`section-body location-section-body min-h-0${
          hasRequestUi ? ' location-section-body--has-requests' : ''
        }`}
      >
        {myLocation.address && (lat !== 0 || lng !== 0) && (
          <div className="location-address-row shrink-0">
            <p className="location-text">
              {t.location_ui_address_prefix} {extractLocationAddress(myLocation.address)}
            </p>
          </div>
        )}

        <div className="location-map-slot min-h-0 flex-1">
        {!isLocationSharing ? (
          <div
            className="location-map-surface flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-[linear-gradient(rgba(248,250,252,0.82),rgba(248,250,252,0.82)),url('/images/map-placeholder-bg.png')] bg-cover bg-center text-slate-500"
            style={{ padding: hasRequestUi ? '2cqmin' : '5cqmin' }}
          >
            <p className="location-map-placeholder-title font-semibold text-slate-600">
              {t.location_ui_map_title}
            </p>
            <p className="location-map-placeholder-hint text-slate-500">
              {t.location_ui_map_hint_off}
            </p>
          </div>
        ) : hasGoogleMapsApiKey ? (
          mapError ? (
            <div
              className="location-map-surface flex w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-800"
              style={{ padding: '5cqmin' }}
            >
              <div className="text-center" style={{ maxWidth: '80cqmin' }}>
                <p className="font-semibold text-red-600" style={{ marginBottom: '3cqmin', fontSize: '7cqmin' }}>
                  {t.location_ui_gmaps_error_title}
                </p>
                <p style={{ marginBottom: '4cqmin', fontSize: '5cqmin', lineHeight: 1.6 }}>{mapError}</p>
                <div
                  className="rounded-lg bg-red-100"
                  style={{ marginBottom: '4cqmin', padding: '3cqmin', fontSize: '4.5cqmin', lineHeight: 1.6 }}
                >
                  <p className="font-semibold" style={{ marginBottom: '2cqmin' }}>{t.location_ui_troubleshoot_title}</p>
                  <ol className="ml-5" style={{ lineHeight: 1.8 }}>
                    <li>
                      <a
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 underline"
                      >
                        {t.location_ui_troubleshoot_1}
                      </a>
                    </li>
                    <li>{t.location_ui_troubleshoot_2}</li>
                    <li>{t.location_ui_troubleshoot_3}</li>
                    <li>{t.location_ui_troubleshoot_4}</li>
                  </ol>
                  <p className="text-red-800" style={{ marginTop: '2cqmin', fontSize: '3.5cqmin' }}>{t.location_ui_troubleshoot_note}</p>
                </div>
                {(lat !== 0 || lng !== 0) && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-red-600 underline"
                    style={{ fontSize: '5cqmin' }}
                  >
                    {t.location_ui_open_in_gmaps}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div
              id="map"
              className="location-map-canvas h-full min-h-0 w-full flex-1 rounded-xl border border-slate-200"
            />
          )
        ) : (
          <div
            className="location-map-surface flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500"
            style={{ padding: '5cqmin' }}
          >
            <div className="text-center" style={{ maxWidth: '80cqmin' }}>
              <p className="font-semibold text-slate-800" style={{ marginBottom: '3cqmin', fontSize: '6cqmin' }}>
                {t.location_ui_api_key_title}
              </p>
              <div
                className="rounded-lg border border-slate-200 bg-white text-left"
                style={{ marginBottom: '3cqmin', padding: '4cqmin', fontSize: '4.5cqmin' }}
              >
                <p className="font-semibold" style={{ marginBottom: '2cqmin' }}>{t.location_ui_api_setup_title}</p>
                <ol className="ml-5" style={{ lineHeight: 1.8 }}>
                  <li>
                    {t.location_ui_api_li1_before}
                    <code
                      className="rounded bg-slate-100"
                      style={{ padding: '0.5cqmin 1.5cqmin', fontSize: '4cqmin' }}
                    >
                      .env.local
                    </code>
                    {t.location_ui_api_li1_after}
                  </li>
                  <li>
                    {t.location_ui_api_li2_intro}
                    <br />
                    <code
                      className="mt-1 inline-block rounded bg-slate-100"
                      style={{ padding: '1cqmin 2cqmin', fontSize: '3.5cqmin' }}
                    >
                      {t.location_ui_api_env_example}
                    </code>
                  </li>
                  <li>
                    {t.location_ui_api_li3_before}
                    <code
                      className="rounded bg-slate-100"
                      style={{ padding: '0.5cqmin 1.5cqmin', fontSize: '4cqmin' }}
                    >
                      npm run dev
                    </code>
                    {t.location_ui_api_li3_after}
                  </li>
                </ol>
                <p className="text-slate-500" style={{ marginTop: '3cqmin', fontSize: '3.5cqmin' }}>
                  {t.location_ui_api_hint_before}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500"
                  >
                    Google Cloud Console
                  </a>
                  {t.location_ui_api_hint_after}
                </p>
              </div>
              {(lat !== 0 || lng !== 0) && (
                <p style={{ marginTop: '2cqmin', fontSize: '4cqmin' }}>
                  {t.location_ui_or_maps_before}
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    {t.location_ui_or_maps_link}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}
        </div>

        {locationRequests.length > 0 && (
          <div className="location-requests-panel shrink-0">
            <h4 className="location-requests-heading">{t.location_ui_requests_heading}</h4>
            <div className="location-requests-list">
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
                  const isComeHere = req.request_type === 'come_here';
                  const destLat = req.destination_lat;
                  const destLng = req.destination_lng;

                  return (
                    <div
                      key={req.id}
                      className={`location-request-card rounded-lg border ${
                        isExpired ? 'border-red-300 bg-red-100' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="location-request-card-body">
                        <div className="location-request-card-name">
                          {isRequester ? `→ ${otherUserName}${roleDisplay}` : `← ${otherUserName}${roleDisplay}`}
                        </div>
                        <div className="location-request-card-meta">
                          {isRequester ? t.piggy_request_sent : t.piggy_request_received}
                          {isComeHere && (
                            <span className="text-blue-600" style={{ marginLeft: '1cqmin' }}>
                              ({t.location_request_come_label})
                            </span>
                          )}
                          {!isExpired && timeLeft > 0 && (
                            <span style={{ marginLeft: '1cqmin' }}>
                              {fillHm(t.location_ui_dot_time_left, Math.floor(timeLeft / 60), timeLeft % 60)}
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-red-500" style={{ marginLeft: '1cqmin' }}>{t.location_ui_expired_suffix}</span>
                          )}
                        </div>
                      </div>
                      <div className="location-request-card-actions">
                        {isRequester ? (
                          <button
                            type="button"
                            onClick={() => onLocationRequestAction(req.id, 'cancel')}
                            className="location-request-btn location-request-btn--sm bg-red-500 text-white"
                          >
                            {cancelLabel}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  isComeHere &&
                                  destLat != null &&
                                  destLng != null &&
                                  Number.isFinite(destLat) &&
                                  Number.isFinite(destLng)
                                ) {
                                  onAcceptComeHereRequest(req.id, destLat, destLng);
                                } else {
                                  onLocationRequestAction(req.id, 'accept');
                                }
                              }}
                              disabled={isExpired}
                              className={`location-request-btn disabled:cursor-not-allowed disabled:opacity-60 ${
                                isExpired ? 'bg-slate-300 text-white' : isComeHere ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                              }`}
                            >
                              <span>{isComeHere ? '🚶' : '📍'}</span>
                              <span>{isComeHere ? t.location_got_it_btn : t.location_share_btn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onLocationRequestAction(req.id, 'reject')}
                              className="location-request-btn location-request-btn--sm bg-red-500 text-white"
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
                      className={`location-request-card rounded-lg border ${
                        isExpired ? 'border-red-300 bg-red-100' : 'border-emerald-500 bg-emerald-100'
                      }`}
                    >
                      <div className="location-request-card-body">
                        <div className="location-request-card-name text-emerald-600">
                          {fillName(t.location_ui_sharing_with, otherUserName + roleDisplay)}
                        </div>
                        <div className="location-request-card-meta">
                          {!isExpired && timeLeft > 0 ? (
                            <span>
                              {fillHm(t.location_ui_pin_time_left, Math.floor(timeLeft / 60), timeLeft % 60)}
                            </span>
                          ) : (
                            <span className="text-red-500">{t.location_ui_pin_expired}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEndLocationSharing(req.id)}
                        className="location-request-btn location-request-btn--sm bg-red-500 text-white"
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
