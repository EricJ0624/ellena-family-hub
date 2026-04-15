/**
 * 저금통(Piggy Bank) 섹션 컴포넌트
 * Dashboard용 저금통 잔액 요약 뷰
 */

'use client';

import React from 'react';

interface PiggySummary {
  name: string;
  walletBalance: number;
  bankBalance: number;
  currency: string;
  ownerNickname?: string | null;
}

interface PiggyMember {
  user_id: string;
  ownerNickname: string | null;
  noAccount: true;
}

interface PiggyAccount extends Omit<PiggyMember, 'noAccount'> {
  id: string;
  name: string;
  balance: number;
  walletBalance?: number;
  currency: string;
  noAccount: false;
}

type PiggyMemberOrAccount = PiggyMember | PiggyAccount;

interface AccountRequest {
  id: string;
  user_id: string;
  nickname: string | null;
}

interface PiggyBankSectionProps {
  currentGroupId: string | null;
  isAdmin: boolean;
  piggySummary: PiggySummary | null;
  piggyMemberPiggies: PiggyMemberOrAccount[] | null;
  piggyLoaded: boolean;
  piggySummaryError: string | null;
  pendingAccountRequests: AccountRequest[];
  piggyLabel: string;
  formatAmount: (amount: number, currency?: string | null) => string;
  onGoClick: () => void;
  onManageClick: () => void;
  onAddPiggy: (userId: string) => void;
  onDeletePiggy: (userId: string) => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onRequestAccount: () => void;
  onMemberClick: (userId: string) => void;
  translations: {
    section_title_admin: string;
    section_title_user: string;
    manage_all: string;
    go: string;
    select_group: string;
    loading: string;
    pending_requests: string;
    no_account_holders: string;
    member_no_account_line: string;
    add_account_btn: string;
    delete_account_btn: string;
    reject_btn: string;
    approve_btn: string;
    wallet_balance_label: string;
    bank_balance_label: string;
    wallet_balance_for_name: string;
    bank_balance_for_name: string;
    empty_ask_admin: string;
    request_account_btn: string;
    member: string;
    card_title: string;
  };
}

export function PiggyBankSection({
  currentGroupId,
  isAdmin,
  piggySummary,
  piggyMemberPiggies,
  piggyLoaded,
  piggySummaryError,
  pendingAccountRequests,
  piggyLabel,
  formatAmount,
  onGoClick,
  onManageClick,
  onAddPiggy,
  onDeletePiggy,
  onApproveRequest,
  onRejectRequest,
  onRequestAccount,
  onMemberClick,
  translations: t,
}: PiggyBankSectionProps) {
  const sectionTitle = isAdmin
    ? t.section_title_admin
    : t.section_title_user.replace(/\{name\}/g, piggySummary?.ownerNickname?.trim() || 'Ellena');

  const buttonText = isAdmin ? t.manage_all : t.go;

  return (
    <section className="content-section">
      <div className="section-header">
        <h3 className="section-title">{sectionTitle}</h3>
        {currentGroupId && (
          <button
            onClick={isAdmin ? onManageClick : onGoClick}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <span>🐷</span>
            {buttonText}
          </button>
        )}
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {t.select_group}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {piggySummaryError && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#b91c1c',
                  backgroundColor: '#fee2e2',
                  padding: '8px 10px',
                  borderRadius: '8px',
                }}
              >
                {piggySummaryError}
              </div>
            )}
            {!piggyLoaded ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>{t.loading}</div>
            ) : isAdmin && piggyMemberPiggies !== null ? (
              /* 관리자: 저금통 요청 리스트 + 멤버별 카드 */
              (() => {
                const hasAnyAccount = piggyMemberPiggies.some((p) => !p.noAccount);
                return (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {pendingAccountRequests.length > 0 && (
                      <div
                        style={{
                          backgroundColor: '#fef3c7',
                          borderRadius: '12px',
                          padding: '12px',
                          border: '1px solid #fcd34d',
                          marginBottom: '4px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#92400e',
                            marginBottom: '8px',
                          }}
                        >
                          {t.pending_requests.replace(/\{count\}/g, String(pendingAccountRequests.length))}
                        </div>
                        {pendingAccountRequests.map((req) => (
                          <div
                            key={req.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: '1px solid #fde68a',
                            }}
                          >
                            <span style={{ fontSize: '13px', color: '#78350f' }}>
                              {req.nickname || t.member}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRejectRequest(req.id);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {t.reject_btn}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApproveRequest(req.id);
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#22c55e',
                                  color: '#fff',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {t.approve_btn}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasAnyAccount && piggyMemberPiggies.length === 0 && (
                      <div
                        style={{
                          fontSize: '14px',
                          color: '#64748b',
                          padding: '12px',
                          textAlign: 'center',
                        }}
                      >
                        {t.no_account_holders}
                      </div>
                    )}
                    {piggyMemberPiggies.map((p) =>
                      p.noAccount ? (
                        <div
                          key={p.user_id}
                          style={{
                            backgroundColor: '#f8fafc',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
                              {p.ownerNickname || t.member}
                            </div>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                              {t.member_no_account_line}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPiggy(p.user_id);
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#22c55e',
                              color: '#fff',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {t.add_account_btn}
                          </button>
                        </div>
                      ) : (
                        <div
                          key={p.id}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                          }}
                          onClick={() => {
                            if (p.user_id) onMemberClick(p.user_id);
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '12px',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>
                              {t.card_title.replace(/\{name\}/g, p.ownerNickname?.trim() || 'Ellena')}
                            </h4>
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => p.user_id && onDeletePiggy(p.user_id)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#b91c1c',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {t.delete_account_btn}
                              </button>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>→</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div
                              style={{
                                backgroundColor: '#fef2f2',
                                borderRadius: '8px',
                                padding: '10px',
                                border: '1px solid #fecaca',
                              }}
                            >
                              <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '4px' }}>
                                {t.wallet_balance_label}
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b91c1c' }}>
                                {formatAmount(p.walletBalance ?? 0, p.currency)}
                              </div>
                            </div>
                            <div
                              style={{
                                backgroundColor: '#fff7ed',
                                borderRadius: '8px',
                                padding: '10px',
                                border: '1px solid #fed7aa',
                              }}
                            >
                              <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '4px' }}>
                                {t.bank_balance_label}
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#9a3412' }}>
                                {formatAmount(p.balance ?? 0, p.currency)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })()
            ) : piggySummary ? (
              /* 일반 사용자: 저금통 있음 — 잔고 표시 */
              <div style={{ display: 'grid', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    borderRadius: '12px',
                    padding: '12px',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                    {t.wallet_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>
                    {formatAmount(piggySummary.walletBalance, piggySummary.currency)}
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: '#fff7ed',
                    borderRadius: '12px',
                    padding: '12px',
                    border: '1px solid #fed7aa',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#9a3412' }}>
                    {t.bank_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>
                    {formatAmount(piggySummary.bankBalance, piggySummary.currency)}
                  </div>
                </div>
              </div>
            ) : (
              /* 일반 사용자: 저금통 없음 */
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                  {t.empty_ask_admin}
                </div>
                <button
                  type="button"
                  onClick={onRequestAccount}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.request_account_btn}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
