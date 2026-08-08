'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ImageIcon, Search, X } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { buildPictureFindPuzzle } from '@/lib/picture-find/game-logic';
import type { PictureFindMode, PictureFindScene, PictureFindStep } from '@/lib/picture-find/types';
import { getPictureFindTranslation } from '@/lib/translations/picture-find';
import { usePictureFindScenes } from '../hooks/usePictureFindScenes';
import { PictureFindGamePlay, PictureFindResultPanel } from './PictureFindGamePlay';

export type PictureFindModalProps = {
  open: boolean;
  onClose: () => void;
  groupId: string | null;
};

type GameResult = {
  foundCount: number;
  total: number;
  remainingMs: number;
  hintsUsed: number;
  timedOut: boolean;
};

export function PictureFindModal({ open, onClose, groupId }: PictureFindModalProps) {
  const { lang } = useLanguage();
  const t = (key: Parameters<typeof getPictureFindTranslation>[1]) => getPictureFindTranslation(lang, key);
  const { scenes, loading } = usePictureFindScenes(open ? groupId : null);

  const [step, setStep] = useState<PictureFindStep>('mode');
  const [mode, setMode] = useState<PictureFindMode | null>(null);
  const [scene, setScene] = useState<PictureFindScene | null>(null);
  const [playSeed, setPlaySeed] = useState('');
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('mode');
      setMode(null);
      setScene(null);
      setPlaySeed('');
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const filteredScenes = useMemo(() => {
    if (!mode) return scenes;
    return scenes.filter((s) => (mode === 'hidden' ? s.supportsHidden : s.supportsSpotDiff));
  }, [scenes, mode]);

  const puzzle = useMemo(() => {
    if (!scene || !playSeed) return null;
    return buildPictureFindPuzzle(scene.id, playSeed);
  }, [scene, playSeed]);

  const startPlay = (picked: PictureFindScene) => {
    setScene(picked);
    setPlaySeed(String(Date.now()));
    setStep('play');
    setResult(null);
  };

  const handleComplete = (gameResult: GameResult) => {
    setResult(gameResult);
    setStep('result');
  };

  if (!open || typeof document === 'undefined') return null;

  const headerTitle =
    step === 'mode'
      ? t('entry_title')
      : step === 'scenes'
        ? t('scenes_title')
        : step === 'play'
          ? mode === 'hidden'
            ? t('mode_hidden')
            : t('mode_spot_diff')
          : t('result_title');

  const goBack = () => {
    if (step === 'scenes') setStep('mode');
    else if (step === 'play' || step === 'result') setStep('scenes');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 p-2 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[96dvh] w-full max-w-[min(96vw,920px)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('entry_title')}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3 sm:px-5">
          {step !== 'mode' && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={t('back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h3 className="m-0 flex-1 text-base font-semibold text-slate-800 sm:text-lg">{headerTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={t('modal_close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5">
          {step === 'mode' && (
            <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-2">
              <ModeCard
                icon={<Search className="h-8 w-8 text-indigo-600" />}
                title={t('mode_hidden')}
                description={t('mode_hidden_desc')}
                onClick={() => {
                  setMode('hidden');
                  setStep('scenes');
                }}
              />
              <ModeCard
                icon={<ImageIcon className="h-8 w-8 text-violet-600" />}
                title={t('mode_spot_diff')}
                description={t('mode_spot_diff_desc')}
                onClick={() => {
                  setMode('spot_diff');
                  setStep('scenes');
                }}
              />
            </div>
          )}

          {step === 'scenes' && (
            <div className="flex flex-col gap-3">
              {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}
              {!loading && filteredScenes.length === 0 && (
                <p className="text-sm text-slate-500">{t('scenes_empty')}</p>
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('scenes_system')}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredScenes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => startPlay(item)}
                    className="overflow-hidden rounded-xl border border-slate-200 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="aspect-[4/3] w-full bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    </div>
                    <span className="block px-2 py-2 text-sm font-semibold text-slate-700">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'play' && mode && scene && puzzle && (
            <PictureFindGamePlay
              mode={mode}
              scene={scene}
              puzzle={puzzle}
              t={{
                entry_title: t('entry_title'),
                entry_subtitle: t('entry_subtitle'),
                entry_start: t('entry_start'),
                modal_close: t('modal_close'),
                back: t('back'),
                mode_title: t('mode_title'),
                mode_hidden: t('mode_hidden'),
                mode_hidden_desc: t('mode_hidden_desc'),
                mode_spot_diff: t('mode_spot_diff'),
                mode_spot_diff_desc: t('mode_spot_diff_desc'),
                scenes_title: t('scenes_title'),
                scenes_system: t('scenes_system'),
                scenes_empty: t('scenes_empty'),
                loading: t('loading'),
                timer_label: t('timer_label'),
                hints_label: t('hints_label'),
                found_label: t('found_label'),
                hint_button: t('hint_button'),
                hint_none_left: t('hint_none_left'),
                wrong_tap: t('wrong_tap'),
                time_up: t('time_up'),
                result_title: t('result_title'),
                result_found: t('result_found'),
                result_time: t('result_time'),
                result_hints: t('result_hints'),
                play_again: t('play_again'),
                pick_another: t('pick_another'),
                change_mode: t('change_mode'),
                left_image: t('left_image'),
                right_image: t('right_image'),
              }}
              onComplete={handleComplete}
            />
          )}

          {step === 'result' && result && (
            <PictureFindResultPanel
              t={{
                entry_title: t('entry_title'),
                entry_subtitle: t('entry_subtitle'),
                entry_start: t('entry_start'),
                modal_close: t('modal_close'),
                back: t('back'),
                mode_title: t('mode_title'),
                mode_hidden: t('mode_hidden'),
                mode_hidden_desc: t('mode_hidden_desc'),
                mode_spot_diff: t('mode_spot_diff'),
                mode_spot_diff_desc: t('mode_spot_diff_desc'),
                scenes_title: t('scenes_title'),
                scenes_system: t('scenes_system'),
                scenes_empty: t('scenes_empty'),
                loading: t('loading'),
                timer_label: t('timer_label'),
                hints_label: t('hints_label'),
                found_label: t('found_label'),
                hint_button: t('hint_button'),
                hint_none_left: t('hint_none_left'),
                wrong_tap: t('wrong_tap'),
                time_up: t('time_up'),
                result_title: t('result_title'),
                result_found: t('result_found'),
                result_time: t('result_time'),
                result_hints: t('result_hints'),
                play_again: t('play_again'),
                pick_another: t('pick_another'),
                change_mode: t('change_mode'),
                left_image: t('left_image'),
                right_image: t('right_image'),
              }}
              foundCount={result.foundCount}
              total={result.total}
              remainingMs={result.remainingMs}
              hintsUsed={result.hintsUsed}
              timedOut={result.timedOut}
              onPlayAgain={() => {
                setPlaySeed(String(Date.now()));
                setStep('play');
              }}
              onPickAnother={() => setStep('scenes')}
              onChangeMode={() => setStep('mode')}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
    >
      {icon}
      <div>
        <p className="text-base font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </button>
  );
}
