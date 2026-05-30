/**
 * 저금통(Piggy Bank) 섹션 컴포넌트
 * Dashboard용 저금통 잔액 요약 뷰
 */

'use client';

import React from 'react';
import type { AccountRequest, PiggyMemberOrAccount, PiggySummary } from '../types';

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
            className="inline-flex cursor-pointer items-center gap-[2cqmin] rounded-lg border-0 bg-[#ef4444] text-white"
            style={{ padding: '2cqmin 3.5cqmin', fontSize: '5cqmin', fontWeight: 700 }}
          >
            <span>🐷</span>
            {buttonText}
          </button>
        )}
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">
            {t.select_group}
          </div>
        ) : (
          <div className="grid" style={{ gap: '2.5cqmin' }}>
            {piggySummaryError && (
              <div className="rounded-lg bg-[#fee2e2] text-[#b91c1c]" style={{ padding: '2cqmin 3cqmin', fontSize: '4cqmin' }}>
                {piggySummaryError}
              </div>
            )}
            {!piggyLoaded ? (
              <div style={{ fontSize: '5cqmin' }} className="text-[#64748b]">{t.loading}</div>
            ) : isAdmin && piggyMemberPiggies !== null ? (
              /* 관리자: 저금통 요청 리스트 + 멤버별 카드 */
              (() => {
                const hasAnyAccount = piggyMemberPiggies.some((p) => !p.noAccount);
                return (
                  <div className="grid" style={{ gap: '3cqmin' }}>
                    {pendingAccountRequests.length > 0 && (
                      <div className="glass-panel-soft rounded-xl" style={{ padding: '3cqmin', marginBottom: '1cqmin' }}>
                        <div className="font-bold text-[#92400e]" style={{ fontSize: '5cqmin', marginBottom: '2cqmin' }}>
                          {t.pending_requests.replace(/\{count\}/g, String(pendingAccountRequests.length))}
                        </div>
                        {pendingAccountRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between border-b border-[#fde68a]"
                            style={{ padding: '2cqmin 0' }}
                          >
                            <span className="text-[#78350f]" style={{ fontSize: '5cqmin' }}>
                              {req.nickname || t.member}
                            </span>
                            <div className="flex" style={{ gap: '1.5cqmin' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRejectRequest(req.id);
                                }}
                                className="cursor-pointer rounded-md border border-solid border-[#e2e8f0] bg-[#f1f5f9] font-semibold text-[#475569]"
                                style={{ padding: '1.5cqmin 2.5cqmin', fontSize: '4cqmin' }}
                              >
                                {t.reject_btn}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApproveRequest(req.id);
                                }}
                                className="cursor-pointer rounded-md border-0 bg-[#22c55e] font-semibold text-white"
                                style={{ padding: '1.5cqmin 2.5cqmin', fontSize: '4cqmin' }}
                              >
                                {t.approve_btn}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasAnyAccount && piggyMemberPiggies.length === 0 && (
                      <div className="text-center text-[#64748b]" style={{ padding: '3cqmin', fontSize: '5cqmin' }}>
                        {t.no_account_holders}
                      </div>
                    )}
                    {piggyMemberPiggies.map((p) =>
                      p.noAccount ? (
                        <div
                          key={p.user_id}
                          className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-white"
                          style={{ gap: '2.5cqmin', padding: '4cqmin' }}
                        >
                          <div>
                            <div className="font-bold text-[#1f2937]" style={{ fontSize: '6cqmin' }}>
                              {p.ownerNickname || t.member}
                            </div>
                            <div className="text-[#64748b]" style={{ marginTop: '1cqmin', fontSize: '5cqmin' }}>
                              {t.member_no_account_line}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPiggy(p.user_id);
                            }}
                            className="cursor-pointer rounded-lg border-0 bg-[#22c55e] font-semibold text-white"
                            style={{ padding: '2cqmin 3.5cqmin', fontSize: '5cqmin' }}
                          >
                            {t.add_account_btn}
                          </button>
                        </div>
                      ) : (
                        <div
                          key={p.id}
                          className="cursor-pointer rounded-xl border border-slate-200 bg-white"
                          style={{ padding: '4cqmin' }}
                          onClick={() => {
                            if (p.user_id) onMemberClick(p.user_id);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between" style={{ marginBottom: '3cqmin', gap: '2cqmin' }}>
                            <h4 className="m-0 font-bold text-[#1f2937]" style={{ fontSize: '6cqmin' }}>
                              {t.card_title.replace(/\{name\}/g, p.ownerNickname?.trim() || 'Ellena')}
                            </h4>
                            <div
                              className="flex items-center"
                              style={{ gap: '2cqmin' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => p.user_id && onDeletePiggy(p.user_id)}
                                className="cursor-pointer rounded-md border border-solid border-[#fecaca] bg-[#fef2f2] font-semibold text-[#b91c1c]"
                                style={{ padding: '1cqmin 2cqmin', fontSize: '4cqmin' }}
                              >
                                {t.delete_account_btn}
                              </button>
                              <span className="text-[#64748b]" style={{ fontSize: '4cqmin' }}>→</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2" style={{ gap: '2.5cqmin' }}>
                            <div className="rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2]" style={{ padding: '2.5cqmin' }}>
                              <div className="text-[#b91c1c]" style={{ marginBottom: '1cqmin', fontSize: '4cqmin' }}>
                                {t.wallet_balance_label}
                              </div>
                              <div className="font-bold text-[#b91c1c]" style={{ fontSize: '6cqmin' }}>
                                {formatAmount(p.walletBalance ?? 0, p.currency)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed]" style={{ padding: '2.5cqmin' }}>
                              <div className="text-[#9a3412]" style={{ marginBottom: '1cqmin', fontSize: '4cqmin' }}>
                                {t.bank_balance_label}
                              </div>
                              <div className="font-bold text-[#9a3412]" style={{ fontSize: '6cqmin' }}>
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
              <div className="grid" style={{ gap: '2.5cqmin' }}>
                <div className="rounded-xl border border-slate-200 bg-white" style={{ padding: '3cqmin' }}>
                  <div className="text-[#b91c1c]" style={{ fontSize: '4.5cqmin' }}>
                    {t.wallet_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="font-bold text-[#b91c1c]" style={{ fontSize: '7cqmin' }}>
                    {formatAmount(piggySummary.walletBalance, piggySummary.currency)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white" style={{ padding: '3cqmin' }}>
                  <div className="text-[#9a3412]" style={{ fontSize: '4.5cqmin' }}>
                    {t.bank_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="font-bold text-[#9a3412]" style={{ fontSize: '7cqmin' }}>
                    {formatAmount(piggySummary.bankBalance, piggySummary.currency)}
                  </div>
                </div>
              </div>
            ) : (
              /* 일반 사용자: 저금통 없음 */
              <div className="text-center" style={{ padding: '4cqmin' }}>
                <div className="text-[#64748b]" style={{ marginBottom: '3cqmin', fontSize: '5cqmin' }}>
                  {t.empty_ask_admin}
                </div>
                <button
                  type="button"
                  onClick={onRequestAccount}
                  className="cursor-pointer rounded-lg border border-solid border-[#94a3b8] bg-[#f1f5f9] font-semibold text-[#475569]"
                  style={{ padding: '2.5cqmin 4cqmin', fontSize: '5cqmin' }}
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
