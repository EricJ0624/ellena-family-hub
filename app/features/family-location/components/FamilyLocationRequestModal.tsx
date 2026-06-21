/**
 * 위치 공유 요청 모달 — 대시보드와 동일한 동작·표시 (상태/로드는 부모에서 전달)
 */

'use client';

import React from 'react';
import type { DashboardLocationRequestRow, LocationModalOnlineUser, LocationModalUserRow } from '../types';
import type { DashboardTranslations } from '@/lib/translations/dashboard';

export type FamilyLocationRequestModalTranslations = Pick<
  DashboardTranslations,
  | 'location_modal_send_title'
  | 'location_modal_come_title'
  | 'location_modal_loading_users'
  | 'location_modal_all_users_count'
  | 'location_modal_online'
  | 'location_modal_user_fallback'
  | 'location_modal_id_prefix'
  | 'location_modal_btn_send'
  | 'location_modal_btn_come_send'
  | 'location_already_approved'
  | 'location_request_pending'
  | 'location_modal_empty'
  | 'location_modal_empty_hint'
  | 'location_modal_refresh'
>;

type Props = {
  open: boolean;
  mode: 'where' | 'come_here';
  userId: string;
  loadingUsers: boolean;
  allUsers: LocationModalUserRow[];
  onlineUsers: LocationModalOnlineUser[];
  locationRequests: DashboardLocationRequestRow[];
  onBackdropClose: () => void;
  onSendLocationRequest: (targetUserId: string) => void;
  onSendComeHereRequest: (targetUserId: string) => void;
  onRefreshUsers: () => void;
  t: FamilyLocationRequestModalTranslations;
  closeLabel: string;
  familyRoleByUserId: Record<string, 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null>;
  getFamilyRoleEmoji: (role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  getFamilyRoleLabel: (lang: any, role: 'mom' | 'dad' | 'son' | 'daughter' | 'grandpa' | 'grandma' | 'other' | null) => string;
  lang: any;
};

function fillN(s: string, n: number) {
  return s.replace(/\{n\}/g, String(n));
}

function fillId(s: string, idShort: string) {
  return s.replace(/\{id\}/g, idShort);
}

export function FamilyLocationRequestModal({
  open,
  mode,
  userId,
  loadingUsers,
  allUsers,
  onlineUsers,
  locationRequests,
  onBackdropClose,
  onSendLocationRequest,
  onSendComeHereRequest,
  onRefreshUsers,
  t,
  closeLabel,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
}: Props) {
  if (!open) return null;

  const isComeHere = mode === 'come_here';
  const modalTitle = isComeHere ? t.location_modal_come_title : t.location_modal_send_title;
  const sendLabel = isComeHere ? t.location_modal_btn_come_send : t.location_modal_btn_send;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onBackdropClose}
    >
      <div
        className="max-h-[80vh] w-[90%] max-w-[500px] overflow-auto rounded-xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold">{modalTitle}</h3>
        {loadingUsers ? (
          <div className="p-10 text-center text-[#64748b]">{t.location_modal_loading_users}</div>
        ) : (
          <div className="flex max-h-[400px] flex-col gap-3 overflow-y-auto">
            {allUsers.length > 0 ? (
              <div className="rounded-lg border border-solid border-[#e2e8f0] bg-[#f8fafc] p-4">
                <div className="mb-3 border-b border-[#e2e8f0] pb-2 text-sm font-semibold text-[#1e293b]">
                  {fillN(t.location_modal_all_users_count, allUsers.length)}
                </div>
                <div className="flex flex-col gap-2">
                  {allUsers.map((user) => {
                    const isOnline = onlineUsers.some((onlineUser) => onlineUser.id === user.id);
                    const hasAcceptedRequest = locationRequests.some(
                      (req) =>
                        ((req.requester_id === userId && req.target_id === user.id) ||
                          (req.requester_id === user.id && req.target_id === userId)) &&
                        req.status === 'accepted'
                    );
                    const hasPendingRequest = locationRequests.some(
                      (req) =>
                        ((req.requester_id === userId && req.target_id === user.id) ||
                          (req.requester_id === user.id && req.target_id === userId)) &&
                        req.status === 'pending'
                    );

                    return (
                      <div
                        key={user.id}
                        className={`mb-2 flex items-center justify-between rounded-lg border border-solid border-[#e2e8f0] p-3 ${
                          hasAcceptedRequest ? 'bg-[#d1fae5]' : 'bg-[#f8fafc]'
                        }`}
                      >
                        <div>
                          <div className="font-medium">
                            {user.nickname ||
                              user.email ||
                              fillId(t.location_modal_user_fallback, user.id.substring(0, 8))}
                            {familyRoleByUserId[user.id] && (
                              <span className="ml-1.5">
                                {getFamilyRoleEmoji(familyRoleByUserId[user.id])} {getFamilyRoleLabel(lang, familyRoleByUserId[user.id])}
                              </span>
                            )}
                            {isOnline && (
                              <span className="ml-1.5 text-[10px] text-[#10b981]">
                                {t.location_modal_online}
                              </span>
                            )}
                          </div>
                          {user.nickname && user.email && (
                            <div className="text-[11px] text-[#94a3b8]">{user.email}</div>
                          )}
                          {!user.nickname && user.email && (
                            <div className="text-[11px] text-[#94a3b8]">
                              {t.location_modal_id_prefix} {user.id.substring(0, 8)}...
                            </div>
                          )}
                          {hasAcceptedRequest && (
                            <div className="text-xs text-[#059669]">{t.location_already_approved}</div>
                          )}
                          {hasPendingRequest && (
                            <div className="text-xs text-[#f59e0b]">{t.location_request_pending}</div>
                          )}
                        </div>
                        {!hasAcceptedRequest && !hasPendingRequest && (
                          <button
                            type="button"
                            onClick={() =>
                              isComeHere
                                ? onSendComeHereRequest(user.id)
                                : onSendLocationRequest(user.id)
                            }
                            className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-xs text-white ${
                              isComeHere ? 'bg-blue-500' : 'bg-[#3b82f6]'
                            }`}
                          >
                            {sendLabel}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-solid border-[#e2e8f0] bg-[#f8fafc] p-5 text-center">
                <p className="m-0 mb-2 text-[#64748b]">{t.location_modal_empty}</p>
                <p className="m-0 text-xs text-[#94a3b8]">{t.location_modal_empty_hint}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (process.env.NODE_ENV === 'development') {
                      console.log('사용자 목록 새로고침 (그룹 멤버만)');
                    }
                    onRefreshUsers();
                  }}
                  className="mt-3 cursor-pointer rounded-md border-0 bg-[#3b82f6] px-3 py-1.5 text-xs text-white"
                >
                  {t.location_modal_refresh}
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onBackdropClose}
          className="mt-4 w-full cursor-pointer rounded-lg border-0 bg-[#e2e8f0] p-2.5 text-sm font-medium text-[#1e293b]"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
