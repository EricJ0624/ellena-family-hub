'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  WIDGET_PREVIEW_MAP,
  WidgetPreviewSurfaceProvider,
} from '@/app/components/group-admin/WidgetPreviewComponents';
import {
  getWidgetShowroomHowtoSteps,
  getWidgetShowroomTranslation,
} from '@/lib/translations/widgetShowroom';
import type { LangCode } from '@/lib/language-fonts';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

const STEP_MS = 2200;

type Props = {
  lang: LangCode;
  widgetKey: DashboardWidgetKey;
  widgetLabel: string;
  onClose: () => void;
};

/**
 * 쇼룸 「미리보기」— 이용법 3단계 + 위젯 카드 연출 (실기능 없음)
 */
export function WidgetShowroomDemoOverlay({ lang, widgetKey, widgetLabel, onClose }: Props) {
  const Preview = WIDGET_PREVIEW_MAP[widgetKey];
  const steps = useMemo(
    () => getWidgetShowroomHowtoSteps(lang, widgetKey),
    [lang, widgetKey],
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [widgetKey, steps]);

  const t = (key: 'demo_close' | 'demo_playing' | 'preview') =>
    getWidgetShowroomTranslation(lang, key);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label={t('preview')}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {t('demo_playing')}
            </p>
            <h2 className="m-0 mt-0.5 truncate text-base font-bold text-slate-900">{widgetLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label={t('demo_close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 p-3">
          <WidgetPreviewSurfaceProvider surface="showroom">
            <motion.div
              key={`${widgetKey}-${step}`}
              initial={{ opacity: 0.65, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none h-full min-h-[14rem] select-none [&_.content-section]:shadow-none"
            >
              {Preview ? <Preview /> : null}
            </motion.div>
          </WidgetPreviewSurfaceProvider>

          {/* 단계별 포인터 하이라이트 */}
          <motion.div
            key={`pulse-${step}`}
            className="pointer-events-none absolute inset-x-6 top-[18%] h-10 rounded-xl border-2 border-indigo-400/80 bg-indigo-400/10"
            initial={{ opacity: 0, y: -8 }}
            animate={{
              opacity: [0, 1, 1, 0.35],
              y: [0, 0, 72 * step, 72 * step],
              scale: [0.98, 1.02, 1, 1],
            }}
            transition={{ duration: 1.8, ease: 'easeInOut' }}
          />
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <div className="mb-2 flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i === step ? 'bg-indigo-600' : i < step ? 'bg-indigo-300' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="m-0 min-h-[2.75rem] text-sm font-medium leading-relaxed text-slate-700"
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {step + 1}
              </span>
              {steps[step]}
            </motion.p>
          </AnimatePresence>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t('demo_close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
