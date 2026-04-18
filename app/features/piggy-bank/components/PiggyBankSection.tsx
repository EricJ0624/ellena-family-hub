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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#ef4444] px-3 py-2 font-bold text-white"
          >
            <span>🐷</span>
            {buttonText}
          </button>
        )}
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div className="text-[13px] text-[#64748b]">
            {t.select_group}
          </div>
        ) : (
          <div className="grid gap-2.5">
            {piggySummaryError && (
              <div className="rounded-lg bg-[#fee2e2] px-2.5 py-2 text-xs text-[#b91c1c]">
                {piggySummaryError}
              </div>
            )}
            {!piggyLoaded ? (
              <div className="text-[13px] text-[#64748b]">{t.loading}</div>
            ) : isAdmin && piggyMemberPiggies !== null ? (
              /* 관리자: 저금통 요청 리스트 + 멤버별 카드 */
              (() => {
                const hasAnyAccount = piggyMemberPiggies.some((p) => !p.noAccount);
                return (
                  <div className="grid gap-3">
                    {pendingAccountRequests.length > 0 && (
                      <div className="mb-1 rounded-xl border border-[#fcd34d] bg-[#fef3c7] p-3">
                        <div className="mb-2 text-[13px] font-bold text-[#92400e]">
                          {t.pending_requests.replace(/\{count\}/g, String(pendingAccountRequests.length))}
                        </div>
                        {pendingAccountRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between border-b border-[#fde68a] py-2"
                          >
                            <span className="text-[13px] text-[#78350f]">
                              {req.nickname || t.member}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRejectRequest(req.id);
                                }}
                                className="cursor-pointer rounded-md border border-solid border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-1 text-xs font-semibold text-[#475569]"
                              >
                                {t.reject_btn}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApproveRequest(req.id);
                                }}
                                className="cursor-pointer rounded-md border-0 bg-[#22c55e] px-2.5 py-1 text-xs font-semibold text-white"
                              >
                                {t.approve_btn}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasAnyAccount && piggyMemberPiggies.length === 0 && (
                      <div className="p-3 text-center text-sm text-[#64748b]">
                        {t.no_account_holders}
                      </div>
                    )}
                    {piggyMemberPiggies.map((p) =>
                      p.noAccount ? (
                        <div
                          key={p.user_id}
                          className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-solid border-[#e2e8f0] bg-[#f8fafc] p-4"
                        >
                          <div>
                            <div className="text-base font-bold text-[#1f2937]">
                              {p.ownerNickname || t.member}
                            </div>
                            <div className="mt-1 text-[13px] text-[#64748b]">
                              {t.member_no_account_line}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPiggy(p.user_id);
                            }}
                            className="cursor-pointer rounded-lg border-0 bg-[#22c55e] px-3.5 py-2 font-semibold text-white"
                          >
                            {t.add_account_btn}
                          </button>
                        </div>
                      ) : (
                        <div
                          key={p.id}
                          className="cursor-pointer rounded-xl border border-solid border-[#e2e8f0] bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.05)] transition-all duration-200 ease-in-out hover:border-[#cbd5e1] hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
                          onClick={() => {
                            if (p.user_id) onMemberClick(p.user_id);
                          }}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="m-0 text-base font-bold text-[#1f2937]">
                              {t.card_title.replace(/\{name\}/g, p.ownerNickname?.trim() || 'Ellena')}
                            </h4>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => p.user_id && onDeletePiggy(p.user_id)}
                                className="cursor-pointer rounded-md border border-solid border-[#fecaca] bg-[#fef2f2] px-2 py-1 text-[11px] font-semibold text-[#b91c1c]"
                              >
                                {t.delete_account_btn}
                              </button>
                              <span className="text-xs text-[#64748b]">→</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2] p-2.5">
                              <div className="mb-1 text-[11px] text-[#b91c1c]">
                                {t.wallet_balance_label}
                              </div>
                              <div className="text-base font-bold text-[#b91c1c]">
                                {formatAmount(p.walletBalance ?? 0, p.currency)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed] p-2.5">
                              <div className="mb-1 text-[11px] text-[#9a3412]">
                                {t.bank_balance_label}
                              </div>
                              <div className="text-base font-bold text-[#9a3412]">
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
              <div className="grid gap-2.5">
                <div className="rounded-xl border border-solid border-[#fecaca] bg-[#fef2f2] p-3">
                  <div className="text-xs text-[#b91c1c]">
                    {t.wallet_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="text-lg font-bold text-[#b91c1c]">
                    {formatAmount(piggySummary.walletBalance, piggySummary.currency)}
                  </div>
                </div>
                <div className="rounded-xl border border-solid border-[#fed7aa] bg-[#fff7ed] p-3">
                  <div className="text-xs text-[#9a3412]">
                    {t.bank_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="text-lg font-bold text-[#9a3412]">
                    {formatAmount(piggySummary.bankBalance, piggySummary.currency)}
                  </div>
                </div>
              </div>
            ) : (
              /* 일반 사용자: 저금통 없음 */
              <div className="p-4 text-center">
                <div className="mb-3 text-sm text-[#64748b]">
                  {t.empty_ask_admin}
                </div>
                <button
                  type="button"
                  onClick={onRequestAccount}
                  className="cursor-pointer rounded-lg border border-solid border-[#94a3b8] bg-[#f1f5f9] px-4 py-2.5 font-semibold text-[#475569]"
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
