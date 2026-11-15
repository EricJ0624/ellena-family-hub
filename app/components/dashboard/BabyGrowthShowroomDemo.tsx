'use client';

import { motion } from 'framer-motion';
import { getWidgetShowroomTranslation } from '@/lib/translations/widgetShowroom';
import type { LangCode } from '@/lib/language-fonts';

const RING = 'ring-2 ring-pink-400 ring-offset-1';

/**
 * 우리아이 성장기록 쇼룸 미리보기. 실저장·스와이프 없음.
 * 1 프로필 → 2 빠른 기록 → 3 가로 슬라이드 제스처 → 4 새 아기 등록 칸 → 5 접종 수첩
 */
export function BabyGrowthShowroomDemo({ lang, step }: { lang: LangCode; step: number }) {
  const ko = lang === 'ko';
  const name = ko ? '우리아이' : 'Baby';
  const age = ko ? '4개월' : '4 mo';
  const addLabel = getWidgetShowroomTranslation(lang, 'howto_baby_growth_add_cta');
  const emptyHint = getWidgetShowroomTranslation(lang, 'howto_baby_growth_add_hint');
  const vaccineTitle = getWidgetShowroomTranslation(lang, 'howto_baby_growth_vaccine_title');
  const vaccineRow = getWidgetShowroomTranslation(lang, 'howto_baby_growth_vaccine_row');

  const cards = ko
    ? [
        ['🍼', '마지막 수유', '2시간 전'],
        ['😴', '마지막 수면', '기록 없음'],
        ['🧷', '마지막 배변', '기록 없음'],
        ['🌡️', '마지막 체온', '기록 없음'],
      ]
    : [
        ['🍼', 'Last feed', '2h ago'],
        ['😴', 'Last sleep', 'No record'],
        ['🧷', 'Last diaper', 'No record'],
        ['🌡️', 'Last temp', 'No record'],
      ];

  const showAdd = step === 3;
  const showVaccine = step >= 4;
  const highlightFeed = step === 1;
  const showSwipeHand = step === 2;
  const highlightAdd = step === 3;

  return (
    <div className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl bg-[#fff8f4] p-3 text-gray-800 shadow-sm">
      <div className="relative overflow-hidden">
        <motion.div
          className="flex w-[200%]"
          animate={{ x: showAdd ? '-50%' : '0%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          {/* 슬라이드 1: 기존 아기 */}
          <div className="w-1/2 shrink-0 pr-1.5">
            <div className={`flex items-center gap-2 rounded-xl ${step === 0 ? RING : ''}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xl">
                👶
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-gray-900">{name}</span>
                  <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-500">
                    {age}
                  </span>
                </div>
                <p className="m-0 text-[10px] text-gray-400">2026-06-25</p>
              </div>
              <span className="shrink-0 text-sm font-black text-pink-400">D+142</span>
            </div>

            {showVaccine ? (
              <div className={`mt-2 rounded-xl bg-white p-2.5 shadow-sm ${RING}`}>
                <p className="m-0 text-[10px] font-semibold text-pink-500">💉 {vaccineTitle}</p>
                <div className="mt-1.5 flex items-center justify-between rounded-lg bg-pink-50 px-2 py-1.5">
                  <span className="text-[11px] font-medium text-gray-800">{vaccineRow}</span>
                  <span className="text-[10px] font-semibold text-emerald-600">✓</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {cards.map(([emoji, label, value], i) => (
                  <div
                    key={label}
                    className={`rounded-xl bg-white px-2 py-1.5 shadow-sm ${
                      highlightFeed && i === 0 ? RING : ''
                    }`}
                  >
                    <p className="m-0 text-[10px] text-gray-500">
                      {emoji} {label}
                    </p>
                    <p className="m-0 text-xs font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 슬라이드 2: 새 아기 등록 칸 */}
          <div className="flex w-1/2 shrink-0 flex-col items-center justify-center gap-2 px-2 py-6 text-center">
            <span className="text-4xl">🍼</span>
            <p className="m-0 text-sm text-gray-500">{emptyHint}</p>
            <span
              className={`rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white ${
                highlightAdd ? RING : ''
              }`}
            >
              {addLabel}
            </span>
          </div>
        </motion.div>
      </div>

      {showSwipeHand ? (
        <motion.div
          className="pointer-events-none absolute bottom-8 left-1/2 z-10 text-3xl"
          initial={{ x: 28, opacity: 0 }}
          animate={{ x: [-8, -56], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.35, ease: 'easeInOut', times: [0, 0.15, 0.75, 1] }}
          aria-hidden
        >
          👆
        </motion.div>
      ) : null}
    </div>
  );
}
