'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useGroup } from '@/app/contexts/GroupContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import {
  WIDGET_PREVIEW_MAP,
  WidgetPreviewSurfaceProvider,
} from '@/app/components/group-admin/WidgetPreviewComponents';
import { getDashboardTranslation } from '@/lib/translations/dashboard';
import { getTravelTranslation } from '@/lib/translations/travel';
import { getGamesTranslation } from '@/lib/translations/games';
import { getTravelDiaryTranslation } from '@/lib/translations/travel-diary';
import {
  getWidgetShowroomBlurb,
  getWidgetShowroomTranslation,
  type WidgetShowroomTranslations,
} from '@/lib/translations/widgetShowroom';
import { completeWidgetShowroom } from '@/lib/widgets/complete-widget-showroom';
import {
  DEFAULT_WIDGET_CONFIGS,
  type DashboardWidgetKey,
} from '@/lib/widgets/types';
import { groupNeedsWidgetShowroom } from '@/lib/widgets/widget-showroom';

type FlowPhase = 'hidden' | 'showroom' | 'tip';

/** 가로 스와이프 인식 (오프셋 / 속도) */
const SWIPE_OFFSET_PX = 40;
const SWIPE_VELOCITY = 280;

interface WidgetShowroomHostProps {
  /** false면 액자 제스처 안내를 막아 둠 (쇼룸·재설정 안내 중) */
  onGestureHintEnabledChange?: (enabled: boolean) => void;
}

export default function WidgetShowroomHost({
  onGestureHintEnabledChange,
}: WidgetShowroomHostProps) {
  const { lang } = useLanguage();
  const { currentGroup, currentGroupId, isOwner, refreshGroups } = useGroup();
  const t = useCallback(
    (key: keyof WidgetShowroomTranslations) => getWidgetShowroomTranslation(lang, key),
    [lang],
  );

  const needsShowroom = isOwner && groupNeedsWidgetShowroom(currentGroup);
  const [phase, setPhase] = useState<FlowPhase>('hidden');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<DashboardWidgetKey>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  const orderedKeys = useMemo(
    () =>
      [...DEFAULT_WIDGET_CONFIGS]
        .sort((a, b) => a.display_order - b.display_order)
        .map((c) => c.widget_key),
    [],
  );

  const widgetLabels = useMemo((): Record<DashboardWidgetKey, string> => {
    const dt = (key: Parameters<typeof getDashboardTranslation>[1]) =>
      getDashboardTranslation(lang, key);
    const tt = (key: Parameters<typeof getTravelTranslation>[1]) => getTravelTranslation(lang, key);
    const gt = (key: Parameters<typeof getGamesTranslation>[1]) => getGamesTranslation(lang, key);
    const tdy = (key: Parameters<typeof getTravelDiaryTranslation>[1]) =>
      getTravelDiaryTranslation(lang, key);
    return {
      tasks: dt('todo_section_title'),
      calendar: dt('section_title_calendar'),
      chat: dt('section_title_chat'),
      location: dt('section_title_location'),
      album: dt('section_title_memories'),
      travel: tt('title'),
      piggy: dt('piggy_section_admin_title'),
      games: gt('section_title'),
      travel_diary: tdy('section_title'),
      travel_quick_record: tt('quick_record_title'),
    };
  }, [lang]);

  useEffect(() => {
    if (needsShowroom) {
      setPhase((prev) => (prev === 'hidden' ? 'showroom' : prev));
      return;
    }
    setPhase((prev) => (prev === 'showroom' ? 'hidden' : prev));
  }, [needsShowroom]);

  useEffect(() => {
    onGestureHintEnabledChange?.(phase === 'hidden');
  }, [phase, onGestureHintEnabledChange]);

  const currentKey = orderedKeys[index] ?? orderedKeys[0];
  const Preview = currentKey ? WIDGET_PREVIEW_MAP[currentKey] : null;
  const isSelected = currentKey ? selected.has(currentKey) : false;

  const goPrev = useCallback(() => {
    setSlideDir(-1);
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSlideDir(1);
    setIndex((i) => Math.min(orderedKeys.length - 1, i + 1));
  }, [orderedKeys.length]);

  const onSwipeDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      if (offset.x <= -SWIPE_OFFSET_PX || velocity.x <= -SWIPE_VELOCITY) {
        goNext();
        return;
      }
      if (offset.x >= SWIPE_OFFSET_PX || velocity.x >= SWIPE_VELOCITY) {
        goPrev();
      }
    },
    [goNext, goPrev],
  );

  const toggleAdd = () => {
    if (!currentKey) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(currentKey)) next.delete(currentKey);
      else next.add(currentKey);
      return next;
    });
    setError(null);
  };

  const handleSkip = () => {
    if (index < orderedKeys.length - 1) goNext();
  };

  const handleStart = async () => {
    if (!currentGroupId) return;
    if (selected.size === 0) {
      setError(t('min_one'));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await completeWidgetShowroom({
        groupId: currentGroupId,
        selectedKeys: [...selected],
      });
      await refreshGroups();
      setPhase('tip');
    } catch (e) {
      console.warn('[widget-showroom] save failed', e);
      setError(t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  const finishTip = () => {
    setPhase('hidden');
    onGestureHintEnabledChange?.(true);
  };

  if (phase === 'hidden') return null;

  if (phase === 'tip') {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-white/40 bg-white p-6 shadow-xl"
        >
          <h2 className="m-0 text-lg font-semibold text-slate-900">{t('tip_title')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('tip_body')}</p>
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
            {t('tip_path')}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link
              href="/group-admin"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={finishTip}
            >
              {t('tip_open_admin')}
            </Link>
            <button
              type="button"
              onClick={finishTip}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('tip_continue')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <WidgetPreviewSurfaceProvider surface="showroom">
      <div className="fixed inset-0 z-[120] flex flex-col bg-gradient-to-b from-sky-50 via-white to-violet-50">
        <header className="shrink-0 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-center">
          <div className="mx-auto flex max-w-lg items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
            <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {t('welcome_title')}
            </h1>
          </div>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">{t('welcome_body')}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-indigo-700">
            {t('select_prompt')}
          </p>
        </header>

        <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pb-3">
          {/* 카드 껍질 고정 — 위젯 전환 시 drag 세션이 끊기지 않음 */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white/90 shadow-lg ${
              isSelected ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
            }`}
          >
            <motion.div
              className="flex min-h-0 flex-1 cursor-grab touch-none flex-col active:cursor-grabbing"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              dragDirectionLock
              onDragEnd={onSwipeDragEnd}
            >
              <div className="shrink-0 border-b border-slate-100 px-4 py-3">
                <h2 className="m-0 text-base font-semibold text-slate-900">
                  {currentKey ? widgetLabels[currentKey] : ''}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {currentKey ? getWidgetShowroomBlurb(lang, currentKey) : ''}
                </p>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50/90 p-3">
                <AnimatePresence mode="wait" custom={slideDir}>
                  <motion.div
                    key={currentKey}
                    custom={slideDir}
                    initial={{ opacity: 0, x: 40 * slideDir }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 * slideDir }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="pointer-events-none h-full min-h-[12rem] select-none [&_.content-section]:shadow-none"
                  >
                    {Preview ? <Preview /> : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>

            <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t('skip')}
              </button>
              <button
                type="button"
                onClick={toggleAdd}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-white ${
                  isSelected
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSelected ? <Check className="h-4 w-4" aria-hidden /> : null}
                {isSelected ? t('added') : t('add')}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex flex-wrap justify-center gap-1.5">
              {orderedKeys.map((key, i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSlideDir(i > index ? 1 : -1);
                    setIndex(i);
                  }}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    i === index
                      ? 'bg-indigo-600'
                      : selected.has(key)
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                  }`}
                  aria-label={widgetLabels[key]}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-500">
              {t('swipe_hint')} · {t('selected_count').replace('{n}', String(selected.size))} ·{' '}
              {index + 1}/{orderedKeys.length}
            </span>
          </div>

          {error ? (
            <p className="mt-2 text-center text-xs font-medium text-red-600">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleStart()}
            className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? t('saving') : t('start_dashboard')}
          </button>
        </div>
      </div>
    </WidgetPreviewSurfaceProvider>
  );
}
