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
  | 'location_modal_loading_users'
  | 'location_modal_all_users_count'
  | 'location_modal_online'
  | 'location_modal_user_fallback'
  | 'location_modal_id_prefix'
  | 'location_modal_btn_send'
  | 'location_already_approved'
  | 'location_request_pending'
  | 'location_modal_empty'
  | 'location_modal_empty_hint'
  | 'location_modal_refresh'
>;

type Props = {
  open: boolean;
  userId: string;
  loadingUsers: boolean;
  allUsers: LocationModalUserRow[];
  onlineUsers: LocationModalOnlineUser[];
  locationRequests: DashboardLocationRequestRow[];
  onBackdropClose: () => void;
  onSendLocationRequest: (targetUserId: string) => void;
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
  userId,
  loadingUsers,
  allUsers,
  onlineUsers,
  locationRequests,
  onBackdropClose,
  onSendLocationRequest,
  onRefreshUsers,
  t,
  closeLabel,
  familyRoleByUserId,
  getFamilyRoleEmoji,
  getFamilyRoleLabel,
  lang,
}: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onBackdropClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>{t.location_modal_send_title}</h3>
        {loadingUsers ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>{t.location_modal_loading_users}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            {allUsers.length > 0 ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: '#1e293b',
                    marginBottom: '12px',
                    fontWeight: '600',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  {fillN(t.location_modal_all_users_count, allUsers.length)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        style={{
                          padding: '12px',
                          backgroundColor: hasAcceptedRequest ? '#d1fae5' : '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {user.nickname ||
                              user.email ||
                              fillId(t.location_modal_user_fallback, user.id.substring(0, 8))}
                            {familyRoleByUserId[user.id] && (
                              <span style={{ marginLeft: '6px' }}>
                                {getFamilyRoleEmoji(familyRoleByUserId[user.id])} {getFamilyRoleLabel(lang, familyRoleByUserId[user.id])}
                              </span>
                            )}
                            {isOnline && (
                              <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '6px' }}>
                                {t.location_modal_online}
                              </span>
                            )}
                          </div>
                          {user.nickname && user.email && (
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{user.email}</div>
                          )}
                          {!user.nickname && user.email && (
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {t.location_modal_id_prefix} {user.id.substring(0, 8)}...
                            </div>
                          )}
                          {hasAcceptedRequest && (
                            <div style={{ fontSize: '12px', color: '#059669' }}>{t.location_already_approved}</div>
                          )}
                          {hasPendingRequest && (
                            <div style={{ fontSize: '12px', color: '#f59e0b' }}>{t.location_request_pending}</div>
                          )}
                        </div>
                        {!hasAcceptedRequest && !hasPendingRequest && (
                          <button
                            type="button"
                            onClick={() => onSendLocationRequest(user.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {t.location_modal_btn_send}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: '#64748b', margin: 0, marginBottom: '8px' }}>{t.location_modal_empty}</p>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>{t.location_modal_empty_hint}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (process.env.NODE_ENV === 'development') {
                      console.log('사용자 목록 새로고침 (그룹 멤버만)');
                    }
                    onRefreshUsers();
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
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
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px',
            backgroundColor: '#e2e8f0',
            color: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
