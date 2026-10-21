'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  ShowroomPreviewFit,
  WIDGET_PREVIEW_MAP,
  WidgetPreviewSurfaceProvider,
} from '@/app/components/group-admin/WidgetPreviewComponents';
import { CalendarShowroomDemo } from '@/app/components/dashboard/CalendarShowroomDemo';
import { TasksShowroomDemo } from '@/app/components/dashboard/TasksShowroomDemo';
import {
  CALENDAR_SHOWROOM_STEP_MS,
  getWidgetShowroomHowtoSteps,
  getWidgetShowroomTranslation,
  hasNativeShowroomCopy,
  TASKS_SHOWROOM_STEP_MS,
} from '@/lib/translations/widgetShowroom';
import { supabase } from '@/lib/supabase';
import { waitForSupabaseSession } from '@/lib/supabase-session-ready';
import type { LangCode } from '@/lib/language-fonts';
import type { DashboardWidgetKey } from '@/lib/widgets/types';

const STEP_MS = 2200;

type Props = {
  lang: LangCode;
  widgetKey: DashboardWidgetKey;
  widgetLabel: string;
  onClose: () => void;
  /** 관리자 확인 화면에서만 넘긴다. 없으면 기존 닫기 문구. */
  closeLabel?: string;
  /**
   * 가족 쇼룸에서만 켠다. 한국어는 항상 코드 연출이다.
   * 박스가 꺼진 언어는 영어 코드 연출을 유지한다.
   * 박스가 켜진 언어는 그 언어 영상, 그 언어 코드 연출, 영어 영상, 영어 코드 연출 순이다.
   */
  usePublishedVideo?: boolean;
};

/**
 * 쇼룸 「미리보기」— 이용법 단계 + 위젯 카드 연출 (실기능 없음).
 * tasks 는 7단계, calendar 는 6단계, 그 외 위젯은 기존 3단계.
 */
export function WidgetShowroomDemoOverlay({
  lang,
  widgetKey,
  widgetLabel,
  onClose,
  closeLabel,
  usePublishedVideo = false,
}: Props) {
  const Preview = WIDGET_PREVIEW_MAP[widgetKey];
  const [step, setStep] = useState(0);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [scriptLang, setScriptLang] = useState<LangCode>(lang);
  const englishVideoUrl = useRef<string | null>(null);
  const steps = useMemo(
    () => getWidgetShowroomHowtoSteps(scriptLang, widgetKey),
    [scriptLang, widgetKey],
  );
  const isScripted = widgetKey === 'tasks' || widgetKey === 'calendar';
  const showVideo = publishedUrl !== null;

  useEffect(() => {
    if (showVideo || steps.length === 0) return;
    let current = 0;
    let timer = 0;
    const durations =
      widgetKey === 'tasks' && steps.length === TASKS_SHOWROOM_STEP_MS.length
        ? TASKS_SHOWROOM_STEP_MS
        : widgetKey === 'calendar' && steps.length === CALENDAR_SHOWROOM_STEP_MS.length
          ? CALENDAR_SHOWROOM_STEP_MS
          : steps.map(() => STEP_MS);
    const tick = () => {
      timer = window.setTimeout(() => {
        current = (current + 1) % steps.length;
        setStep(current);
        tick();
      }, durations[current] ?? STEP_MS);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [showVideo, widgetKey, steps]);

  useEffect(() => {
    setPublishedUrl(null);
    setScriptLang(lang);
    englishVideoUrl.current = null;
    if (!usePublishedVideo || lang === 'ko') return;
    let cancelled = false;
    const urlFor = (videos: { widgetKey?: string; url?: string }[] | undefined) =>
      videos?.find((video) => video.widgetKey === widgetKey && video.url)?.url;
    const loadPublished = async () => {
      try {
        const session = await waitForSupabaseSession(supabase);
        if (!session?.access_token || cancelled) return;
        const response = await fetch(
          `/api/showroom-published-videos?lang=${encodeURIComponent(lang)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!response.ok || cancelled) return;
        const result = (await response.json().catch(() => ({}))) as {
          videos?: { widgetKey?: string; url?: string }[];
          fallbackVideos?: { widgetKey?: string; url?: string }[];
          nativeCopy?: boolean;
        };
        if (cancelled) return;
        const ownUrl = urlFor(result.videos);
        const englishUrl = result.nativeCopy === false ? urlFor(result.fallbackVideos) : undefined;
        englishVideoUrl.current = englishUrl && englishUrl !== ownUrl ? englishUrl : null;
        if (ownUrl || englishUrl) {
          setPublishedUrl(ownUrl || englishUrl || null);
          return;
        }
        if (result.nativeCopy === false) {
          setScriptLang('en');
          setStep(0);
        }
      } catch {
        // 조회가 실패하면 기존 코드 연출을 유지한다.
      }
    };
    void loadPublished();
    return () => {
      cancelled = true;
    };
  }, [usePublishedVideo, lang, widgetKey]);

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
        className="flex min-h-0 max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl"
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
            aria-label={closeLabel ?? t('demo_close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 p-3">
          {showVideo ? (
            <video
              key={publishedUrl}
              src={publishedUrl ?? undefined}
              controls
              autoPlay
              playsInline
              className="max-h-full w-full bg-slate-950"
              onError={() => {
                const englishUrl = englishVideoUrl.current;
                if (englishUrl && englishUrl !== publishedUrl) {
                  englishVideoUrl.current = null;
                  setPublishedUrl(englishUrl);
                  return;
                }
                setPublishedUrl(null);
                if (!hasNativeShowroomCopy(lang)) {
                  setScriptLang('en');
                  setStep(0);
                }
              }}
            />
          ) : null}
          {showVideo ? null : (
          <>
          <WidgetPreviewSurfaceProvider surface="showroom">
            <div className="pointer-events-none h-full min-h-0 select-none [&_.content-section]:shadow-none">
              <ShowroomPreviewFit>
                {widgetKey === 'tasks' ? (
                  <TasksShowroomDemo lang={scriptLang} step={step} />
                ) : widgetKey === 'calendar' ? (
                  <CalendarShowroomDemo lang={scriptLang} step={step} />
                ) : (
                  <motion.div
                    key={`${widgetKey}-${step}`}
                    initial={{ opacity: 0.65, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="min-h-[14rem]"
                  >
                    {Preview ? <Preview /> : null}
                  </motion.div>
                )}
              </ShowroomPreviewFit>
            </div>
          </WidgetPreviewSurfaceProvider>

          {isScripted ? null : (
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
          )}
          </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          {showVideo ? null : (
          <>
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
          </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {closeLabel ?? t('demo_close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
