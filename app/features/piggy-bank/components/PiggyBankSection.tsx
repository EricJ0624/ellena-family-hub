/**
 * 저금통(Piggy Bank) 섹션 컴포넌트
 * Dashboard용 저금통 잔액 요약 뷰
 */

'use client';

import React from 'react';
import type { AccountRequest, PiggyMemberOrAccount, PiggySummary } from '../types';

function withPiggyName(template: string, name: string | null | undefined) {
  return template.replace(/\{name\}/g, name?.trim() || 'Ellena');
}

function piggyCardHeading(
  savedName: string | null | undefined,
  nickname: string | null | undefined,
  template: string,
) {
  const saved = savedName?.trim();
  if (saved && !/piggy\s*bank/i.test(saved)) return saved;
  return withPiggyName(template, nickname);
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
    : withPiggyName(t.section_title_user, piggySummary?.ownerNickname);

  const buttonText = isAdmin ? t.manage_all : t.go;
  const hasPiggyFilled = isAdmin
    ? Boolean(piggyMemberPiggies && piggyMemberPiggies.length > 0)
    : Boolean(piggySummary);
  const piggyCardCount = isAdmin
    ? (piggyMemberPiggies?.length ?? 0)
    : piggySummary
      ? 1
      : 0;
  const piggyCountAttr = piggyCardCount >= 3 ? '3' : String(piggyCardCount);
  // 카드 크기는 기본 칸(--piggy-ref-h)에 고정. 위젯을 키우면 그 높이에 카드가 더 들어가고, 넘치면 스크롤된다.
  const pu = (n: number) => `calc(var(--piggy-u) * ${n})`;

  return (
    <section
      className="content-section piggy-widget-section"
      data-piggy-filled={hasPiggyFilled ? 'true' : 'false'}
      data-piggy-count={piggyCountAttr}
    >
      <div className="section-header">
        <h3 className="section-title">{sectionTitle}</h3>
        {currentGroupId && (
          <button
            onClick={isAdmin ? onManageClick : onGoClick}
            className="inline-flex cursor-pointer items-center gap-[calc(var(--piggy-u)*2)] rounded-lg border-0 bg-[#ef4444] text-white"
            style={{ padding: `${pu(2)} ${pu(3.5)}`, fontSize: pu(5), fontWeight: 700 }}
          >
            <span>🐷</span>
            {buttonText}
          </button>
        )}
      </div>
      <div className="section-body">
        {!currentGroupId ? (
          <div style={{ fontSize: pu(5) }} className="text-[#64748b]">
            {t.select_group}
          </div>
        ) : (
          <div className="grid" style={{ gap: pu(2.5) }}>
            {piggySummaryError && (
              <div className="rounded-lg bg-[#fee2e2] text-[#b91c1c]" style={{ padding: `${pu(2)} ${pu(3)}`, fontSize: pu(4) }}>
                {piggySummaryError}
              </div>
            )}
            {!piggyLoaded ? (
              <div style={{ fontSize: pu(5) }} className="text-[#64748b]">{t.loading}</div>
            ) : isAdmin && piggyMemberPiggies !== null ? (
              /* 관리자: 저금통 요청 리스트 + 멤버별 카드 */
              <div className="grid" style={{ gap: pu(3) }}>
                    {pendingAccountRequests.length > 0 && (
                      <div className="glass-panel-soft rounded-xl" style={{ padding: pu(3), marginBottom: pu(1) }}>
                        <div className="font-bold text-[#92400e]" style={{ fontSize: pu(5), marginBottom: pu(2) }}>
                          {t.pending_requests.replace(/\{count\}/g, String(pendingAccountRequests.length))}
                        </div>
                        {pendingAccountRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between border-b border-[#fde68a]"
                            style={{ padding: `${pu(2)} 0` }}
                          >
                            <span className="text-[#78350f]" style={{ fontSize: pu(5) }}>
                              {req.nickname || t.member}
                            </span>
                            <div className="flex" style={{ gap: pu(1.5) }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRejectRequest(req.id);
                                }}
                                className="cursor-pointer rounded-md border border-solid border-[#e2e8f0] bg-[#f1f5f9] font-semibold text-[#475569]"
                                style={{ padding: `${pu(1.5)} ${pu(2.5)}`, fontSize: pu(4) }}
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
                                style={{ padding: `${pu(1.5)} ${pu(2.5)}`, fontSize: pu(4) }}
                              >
                                {t.approve_btn}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {piggyMemberPiggies.length === 0 && (
                      <div className="text-center text-[#64748b]" style={{ padding: pu(3), fontSize: pu(5) }}>
                        {t.no_account_holders}
                      </div>
                    )}
                    <div className="piggy-card-stack grid" style={{ gap: pu(3) }}>
                    {piggyMemberPiggies.map((p) =>
                      p.noAccount ? (
                        <div
                          key={p.user_id}
                          className="piggy-widget-card flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-white"
                          style={{ gap: pu(2.5), padding: pu(4) }}
                        >
                          <div>
                            <div className="piggy-widget-empty-name font-bold text-[#1f2937]" style={{ fontSize: pu(6) }}>
                              {p.ownerNickname || t.member}
                            </div>
                            <div className="piggy-widget-empty-hint text-[#64748b]" style={{ marginTop: pu(1), fontSize: pu(5) }}>
                              {t.member_no_account_line}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPiggy(p.user_id);
                            }}
                            className="piggy-widget-add-btn cursor-pointer rounded-lg border-0 bg-[#22c55e] font-semibold text-white"
                            style={{ padding: `${pu(2)} ${pu(3.5)}`, fontSize: pu(5) }}
                          >
                            {t.add_account_btn}
                          </button>
                        </div>
                      ) : (
                        <div
                          key={p.id}
                          className="piggy-widget-card cursor-pointer rounded-xl border border-slate-200 bg-white"
                          style={{ padding: pu(4) }}
                          onClick={() => {
                            if (p.user_id) onMemberClick(p.user_id);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between" style={{ marginBottom: pu(3), gap: pu(2) }}>
                            <h4 className="m-0 font-bold text-[#1f2937]" style={{ fontSize: pu(6) }}>
                              {piggyCardHeading(p.name, p.ownerNickname, t.card_title)}
                            </h4>
                            <div
                              className="flex items-center"
                              style={{ gap: pu(2) }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => p.user_id && onDeletePiggy(p.user_id)}
                                className="piggy-widget-remove-btn cursor-pointer rounded-md border border-solid border-[#fecaca] bg-[#fef2f2] font-semibold text-[#b91c1c]"
                                style={{ padding: `${pu(1)} ${pu(2)}`, fontSize: pu(4) }}
                              >
                                {t.delete_account_btn}
                              </button>
                              <span className="text-[#64748b]" style={{ fontSize: pu(4) }}>→</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2" style={{ gap: pu(2.5) }}>
                            <div className="piggy-widget-metric--wallet rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2]" style={{ padding: pu(2.5) }}>
                              <div className="text-[#b91c1c]" style={{ marginBottom: pu(1), fontSize: pu(4) }}>
                                {t.wallet_balance_label}
                              </div>
                              <div className="font-bold text-[#b91c1c]" style={{ fontSize: pu(6) }}>
                                {formatAmount(p.walletBalance ?? 0, p.currency)}
                              </div>
                            </div>
                            <div className="piggy-widget-metric--bank rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed]" style={{ padding: pu(2.5) }}>
                              <div className="text-[#9a3412]" style={{ marginBottom: pu(1), fontSize: pu(4) }}>
                                {t.bank_balance_label}
                              </div>
                              <div className="font-bold text-[#9a3412]" style={{ fontSize: pu(6) }}>
                                {formatAmount(p.balance ?? 0, p.currency)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                    </div>
                  </div>
            ) : piggySummary ? (
              /* 일반 사용자: 저금통 있음 — 잔고 표시 */
              <div className="grid" style={{ gap: pu(2.5) }}>
                <div className="piggy-widget-card rounded-xl border border-slate-200 bg-white" style={{ padding: pu(3) }}>
                  <div className="text-[#b91c1c]" style={{ fontSize: pu(4.5) }}>
                    {t.wallet_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="font-bold text-[#b91c1c]" style={{ fontSize: pu(7) }}>
                    {formatAmount(piggySummary.walletBalance, piggySummary.currency)}
                  </div>
                </div>
                <div className="piggy-widget-card rounded-xl border border-slate-200 bg-white" style={{ padding: pu(3) }}>
                  <div className="text-[#9a3412]" style={{ fontSize: pu(4.5) }}>
                    {t.bank_balance_for_name.replace(/\{name\}/g, piggyLabel)}
                  </div>
                  <div className="font-bold text-[#9a3412]" style={{ fontSize: pu(7) }}>
                    {formatAmount(piggySummary.bankBalance, piggySummary.currency)}
                  </div>
                </div>
              </div>
            ) : (
              /* 일반 사용자: 저금통 없음 */
              <div className="text-center" style={{ padding: pu(4) }}>
                <div className="text-[#64748b]" style={{ marginBottom: pu(3), fontSize: pu(5) }}>
                  {t.empty_ask_admin}
                </div>
                <button
                  type="button"
                  onClick={onRequestAccount}
                  className="cursor-pointer rounded-lg border border-solid border-[#94a3b8] bg-[#f1f5f9] font-semibold text-[#475569]"
                  style={{ padding: `${pu(2.5)} ${pu(4)}`, fontSize: pu(5) }}
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
