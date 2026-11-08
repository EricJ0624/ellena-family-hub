'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getWidgetPreviewTranslation } from '@/lib/translations/widgetPreview';
import { getWidgetShowroomTranslation } from '@/lib/translations/widgetShowroom';
import type { LangCode } from '@/lib/language-fonts';

const RING = 'ring-2 ring-violet-500 ring-offset-2';

function TypedField({ text, placeholder }: { text: string; placeholder: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    const id = window.setInterval(() => {
      setCount((n) => (n >= text.length ? n : n + 1));
    }, 70);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <input
      readOnly
      tabIndex={-1}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
      value={text.slice(0, count)}
      placeholder={placeholder}
    />
  );
}

/**
 * 저금통 쇼룸 미리보기. 실입금·지출·삭제는 하지 않고, 참고 영상 순서만 보여 준다.
 * 1 빈 위젯 → 2 통화 → 3 아이 선택 → 4 용돈·입금 → 5 잔액 위젯 → 6 지출 입력 → 7 내역 → 8 최종 잔액
 */
export function PiggyShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const dt = (key: Parameters<typeof getDashboardTranslation>[1]) => getDashboardTranslation(lang, key);
  const wp = (key: Parameters<typeof getWidgetPreviewTranslation>[1]) =>
    getWidgetPreviewTranslation(lang, key);
  const childName = getWidgetShowroomTranslation(lang, 'demo_piggy_child');
  const expenseCat = getWidgetShowroomTranslation(lang, 'demo_piggy_expense_category');
  const expenseMemo = getWidgetShowroomTranslation(lang, 'demo_piggy_expense_memo');
  const depositMemo = getWidgetShowroomTranslation(lang, 'demo_piggy_deposit_memo');
  const scene =
    step === 1 || step === 2 || step === 3
      ? 'admin'
      : step === 5 || step === 6
        ? 'ledger'
        : 'widget';
  const wallet = step >= 7 ? '₩40,000' : step >= 4 ? '₩50,000' : '₩0';
  const bank = step >= 4 ? '₩10,000' : '₩0';
  const filled = step >= 4;

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <AnimatePresence mode="wait">
        {scene === 'admin' ? (
          <motion.div
            key={`admin-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-gradient-to-b from-sky-100 via-pink-100 to-orange-50 p-3 shadow-lg"
          >
            <div className="mb-3 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/piggy/kids-widget-bg.webp?v=5"
                alt=""
                aria-hidden
                className="h-10 w-10 rounded-xl object-cover object-left"
              />
              <div>
                <p className="m-0 text-sm font-bold text-slate-900">
                  Piggy Bank {lang === 'ko' ? '관리' : 'Admin'}
                </p>
                <p className="m-0 text-[10px] text-slate-500">
                  {getWidgetShowroomTranslation(lang, 'demo_piggy_admin_sub')}
                </p>
              </div>
            </div>
            <div className={`mb-2 rounded-2xl bg-white/90 p-3 shadow-sm ${step === 1 ? RING : ''}`}>
              <p className="m-0 text-xs font-bold text-slate-800">
                {getWidgetShowroomTranslation(lang, 'demo_piggy_currency_title')}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {getWidgetShowroomTranslation(lang, 'demo_piggy_currency_hint')}
              </p>
              <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800">
                KRW ({lang === 'ko' ? '대한민국 원' : 'Korean Won'})
              </div>
              <span className="mt-2 inline-flex rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
                {getWidgetShowroomTranslation(lang, 'demo_piggy_currency_save')}
              </span>
            </div>
            <div className={`rounded-2xl bg-white/90 p-3 shadow-sm ${step === 2 || step === 3 ? RING : ''}`}>
              <p className="m-0 text-xs font-bold text-slate-800">
                {getWidgetShowroomTranslation(lang, 'demo_piggy_select_child')}
              </p>
              {step >= 2 ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                  {childName} · {lang === 'ko' ? '용돈' : 'Wallet'} {wallet} /{' '}
                  {lang === 'ko' ? '저금통' : 'Piggy'} {bank}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-400">
                  {lang === 'ko' ? '선택하세요' : 'Select'}
                </div>
              )}
              {step === 3 ? (
                <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/80 p-2">
                  <p className="m-0 text-[11px] font-bold text-blue-900">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_pay_title')}
                  </p>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-sm font-semibold text-slate-800">
                    50000
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-xs text-slate-500">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_month_allowance')}
                  </div>
                  <span className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_pay_btn')}
                  </span>
                  <p className="m-0 pt-1 text-[11px] font-bold text-rose-800">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_deposit_title')}
                  </p>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-sm font-semibold text-slate-800">
                    10000
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-xs text-slate-600">{depositMemo}</div>
                  <span className="inline-flex rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_deposit_btn')}
                  </span>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : scene === 'ledger' ? (
          <motion.div
            key={`ledger-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-2 overflow-hidden rounded-[1.5rem] border border-white/70 bg-gradient-to-b from-fuchsia-50 via-pink-50 to-orange-50 p-3 shadow-lg"
          >
            {step === 6 ? (
              <div className={`rounded-2xl bg-white/95 p-3 shadow-sm ${RING}`}>
                <p className="m-0 text-xs font-bold text-slate-900">
                  {getWidgetShowroomTranslation(lang, 'demo_piggy_history_title')}
                </p>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="rounded-xl border border-slate-100 px-2 py-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {getWidgetShowroomTranslation(lang, 'demo_piggy_pay_history')}
                      </span>
                      <span className="font-bold text-emerald-600">+₩50,000</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 px-2 py-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {getWidgetShowroomTranslation(lang, 'demo_piggy_expense_history')} · {expenseCat}
                      </span>
                      <span className="font-bold text-rose-600">-₩10,000</span>
                    </div>
                    <p className="m-0 mt-0.5 text-[10px] text-slate-500">{expenseMemo}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 px-2 py-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        {getWidgetShowroomTranslation(lang, 'demo_piggy_deposit_history')}
                      </span>
                      <span className="font-bold text-emerald-600">+₩10,000</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl bg-white/95 p-3 shadow-sm ${RING}`}>
                <p className="m-0 text-xs font-bold text-slate-900">
                  {getWidgetShowroomTranslation(lang, 'demo_piggy_expense_title')}
                </p>
                <div className="mt-2 space-y-2">
                  <TypedField text="10000" placeholder={lang === 'ko' ? '금액' : 'Amount'} />
                  <TypedField
                    text={expenseCat}
                    placeholder={lang === 'ko' ? '카테고리' : 'Category'}
                  />
                  <input
                    readOnly
                    tabIndex={-1}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                    value={expenseMemo}
                  />
                  <span className="inline-flex rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                    {getWidgetShowroomTranslation(lang, 'demo_piggy_expense_btn')}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`widget-${step}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <section
              className="content-section relative min-h-[15rem] overflow-hidden rounded-[1.5rem] bg-[#bae6fd] [background-image:linear-gradient(160deg,#bae6fd_0%,#f9a8d4_58%,#ffedd5_100%)]"
              data-piggy-filled={filled ? 'true' : 'false'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/piggy/kids-widget-bg.webp?v=5"
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-y-1 right-0 z-0 h-[calc(100%-0.5rem)] w-auto max-w-[55%] object-contain object-right opacity-95"
              />
              <div className="relative z-[3] flex items-start justify-between gap-2 px-3 pt-3">
                <h3 className="m-0 text-sm font-bold text-slate-900">
                  {filled
                    ? `${childName} ${lang === 'ko' ? '저금통' : 'Piggy'}`
                    : dt('piggy_section_admin_title')}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-white ${
                    step === 0 || step === 7 ? RING : ''
                  }`}
                >
                  🐷 {filled ? (lang === 'ko' ? '이동' : 'Open') : wp('preview_manage_btn')}
                </span>
              </div>
              <div className="section-body relative z-[3] px-3 pb-3 pt-2">
                {filled ? (
                  <div className={`max-w-[72%] rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-sm ${step === 4 || step === 7 ? RING : ''}`}>
                    <div className="mb-1.5 text-xs font-bold text-[#1f2937]">{childName}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg border border-solid border-[#fecaca] bg-[#fef2f2] px-2 py-1">
                        <div className="text-[9px] text-[#b91c1c]">{wp('preview_wallet')}</div>
                        <div className="text-[11px] font-bold text-[#b91c1c]">{wallet}</div>
                      </div>
                      <div className="rounded-lg border border-solid border-[#fed7aa] bg-[#fff7ed] px-2 py-1">
                        <div className="text-[9px] text-[#9a3412]">{wp('preview_bank')}</div>
                        <div className="text-[11px] font-bold text-[#9a3412]">{bank}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[78%] rounded-xl border border-white/70 bg-white/90 p-3 shadow-sm ${step === 0 ? RING : ''}`}>
                    <p className="m-0 text-xs font-bold text-slate-800">{childName}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{dt('piggy_member_no_account_line')}</p>
                    <span className="mt-2 inline-flex rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-white">
                      {lang === 'ko' ? '저금통 추가' : 'Add piggy bank'}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
