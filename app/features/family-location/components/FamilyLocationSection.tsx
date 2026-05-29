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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenRequestModal}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            <span>📍</span>
            <span>{t.location_where_btn}</span>
          </button>
        </div>
      </div>
      <div className="section-body">
        {myLocation.address && (lat !== 0 || lng !== 0) && (
          <div className="mb-4">
            <p className="location-text mb-3">
              {t.location_ui_address_prefix} {extractLocationAddress(myLocation.address)}
            </p>
          </div>
        )}

        {!isLocationSharing ? (
          <div
            className="mt-3 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-[linear-gradient(rgba(248,250,252,0.82),rgba(248,250,252,0.82)),url('/images/map-placeholder-bg.png')] bg-cover bg-center p-5 text-slate-500"
          >
            <p className="mb-2 text-[15px] font-semibold text-slate-600">
              {t.location_ui_map_title}
            </p>
            <p className="max-w-80 text-center text-[13px] leading-[1.5]">
              {t.location_ui_map_hint_off}
            </p>
          </div>
        ) : hasGoogleMapsApiKey ? (
          mapError ? (
            <div
              className="mt-3 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
            >
              <div className="max-w-[500px] text-center">
                <p className="mb-3 text-lg font-semibold text-red-600">
                  {t.location_ui_gmaps_error_title}
                </p>
                <p className="mb-4 text-sm leading-[1.6]">{mapError}</p>
                <div
                  className="mb-4 rounded-lg bg-red-100 p-3 text-[13px] leading-[1.6]"
                >
                  <p className="mb-2 font-semibold">{t.location_ui_troubleshoot_title}</p>
                  <ol className="ml-5 leading-[1.8]">
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
                  <p className="mt-2 text-xs text-red-800">{t.location_ui_troubleshoot_note}</p>
                </div>
                {(lat !== 0 || lng !== 0) && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-red-600 underline"
                  >
                    {t.location_ui_open_in_gmaps}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div
              id="map"
              className="mt-3 aspect-[4/3] w-full rounded-xl border border-slate-200"
            />
          )
        ) : null}
        {isLocationSharing && !hasGoogleMapsApiKey ? (
          <div
            className="mt-3 flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-500"
          >
            <div className="max-w-[500px] text-center">
              <p className="mb-3 text-base font-semibold text-slate-800">
                {t.location_ui_api_key_title}
              </p>
              <div
                className="mb-3 rounded-lg border border-slate-200 bg-white p-4 text-left text-[13px]"
              >
                <p className="mb-2 font-semibold">{t.location_ui_api_setup_title}</p>
                <ol className="ml-5 leading-[1.8]">
                  <li>
                    {t.location_ui_api_li1_before}
                    <code
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                    >
                      .env.local
                    </code>
                    {t.location_ui_api_li1_after}
                  </li>
                  <li>
                    {t.location_ui_api_li2_intro}
                    <br />
                    <code
                      className="mt-1 inline-block rounded bg-slate-100 px-2 py-1 text-[11px]"
                    >
                      {t.location_ui_api_env_example}
                    </code>
                  </li>
                  <li>
                    {t.location_ui_api_li3_before}
                    <code
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                    >
                      npm run dev
                    </code>
                    {t.location_ui_api_li3_after}
                  </li>
                </ol>
                <p className="mt-3 text-xs text-slate-500">
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
                <p className="mt-2 text-xs">
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
        ) : null}

        {locationRequests.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-3 text-base font-semibold">{t.location_ui_requests_heading}</h4>
            <div className="flex flex-col gap-2">
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
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        isExpired ? 'border-red-300 bg-red-100' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="mb-1 font-medium">
                          {isRequester ? `→ ${otherUserName}${roleDisplay}` : `← ${otherUserName}${roleDisplay}`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isRequester ? t.piggy_request_sent : t.piggy_request_received}
                          {!isExpired && timeLeft > 0 && (
                            <span className="ml-2">
                              {fillHm(t.location_ui_dot_time_left, Math.floor(timeLeft / 60), timeLeft % 60)}
                            </span>
                          )}
                          {isExpired && (
                            <span className="ml-2 text-red-500">{t.location_ui_expired_suffix}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {isRequester ? (
                          <button
                            type="button"
                            onClick={() => onLocationRequestAction(req.id, 'cancel')}
                            className="cursor-pointer rounded-md border-none bg-red-500 px-3 py-1.5 text-xs text-white"
                          >
                            {cancelLabel}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onLocationRequestAction(req.id, 'accept')}
                              disabled={isExpired}
                              className={`flex items-center gap-1.5 rounded-md border-none px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                                isExpired ? 'bg-slate-300' : 'bg-emerald-500'
                              }`}
                            >
                              <span>📍</span>
                              <span>{t.location_share_btn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onLocationRequestAction(req.id, 'reject')}
                              className="cursor-pointer rounded-md border-none bg-red-500 px-3 py-1.5 text-xs text-white"
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
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        isExpired ? 'border-red-300 bg-red-100' : 'border-emerald-500 bg-emerald-100'
                      }`}
                    >
                      <div>
                        <div className="mb-1 font-medium text-emerald-600">
                          {fillName(t.location_ui_sharing_with, otherUserName + roleDisplay)}
                        </div>
                        <div className="text-xs text-slate-500">
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
                        className="cursor-pointer rounded-md border-none bg-red-500 px-3 py-1.5 text-xs text-white"
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
