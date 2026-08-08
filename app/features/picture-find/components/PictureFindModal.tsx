'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ImageIcon, Search, Trash2, Upload, X } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { buildPictureFindPuzzle } from '@/lib/picture-find/game-logic';
import { deletePictureFindScene } from '@/lib/picture-find/upload-scene';
import type { PictureFindMode, PictureFindScene, PictureFindStep } from '@/lib/picture-find/types';
import { getPictureFindTranslations } from '@/lib/translations/picture-find';
import { usePictureFindScenes } from '../hooks/usePictureFindScenes';
import { PictureFindGamePlay, PictureFindResultPanel } from './PictureFindGamePlay';
import { PictureFindUploadPanel } from './PictureFindUploadPanel';

export type PictureFindModalProps = {
  open: boolean;
  onClose: () => void;
  groupId: string | null;
  userId: string;
  canManageGroupScenes: boolean;
};

type GameResult = {
  foundCount: number;
  total: number;
  remainingMs: number;
  hintsUsed: number;
  timedOut: boolean;
};

export function PictureFindModal({
  open,
  onClose,
  groupId,
  userId,
  canManageGroupScenes,
}: PictureFindModalProps) {
  const { lang } = useLanguage();
  const t = getPictureFindTranslations(lang);
  const { scenes, loading, reload } = usePictureFindScenes(open ? groupId : null);

  const [step, setStep] = useState<PictureFindStep>('mode');
  const [mode, setMode] = useState<PictureFindMode | null>(null);
  const [scene, setScene] = useState<PictureFindScene | null>(null);
  const [playSeed, setPlaySeed] = useState('');
  const [result, setResult] = useState<GameResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('mode');
      setMode(null);
      setScene(null);
      setPlaySeed('');
      setResult(null);
      setManageError(null);
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

  const systemScenes = useMemo(
    () =>
      scenes.filter(
        (s) =>
          s.scope === 'system' &&
          (!mode || (mode === 'hidden' ? s.supportsHidden : s.supportsSpotDiff)),
      ),
    [scenes, mode],
  );

  const groupScenes = useMemo(
    () =>
      scenes.filter(
        (s) =>
          s.scope === 'group' &&
          (!mode || (mode === 'hidden' ? s.supportsHidden : s.supportsSpotDiff)),
      ),
    [scenes, mode],
  );

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

  const canDeleteScene = (item: PictureFindScene) =>
    item.scope === 'group' && (canManageGroupScenes || item.createdBy === userId);

  const handleDelete = async (item: PictureFindScene, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteScene(item)) return;
    if (!window.confirm(t.delete_confirm)) return;
    setManageError(null);
    setDeletingId(item.id);
    try {
      await deletePictureFindScene(item.id);
      await reload();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : t.delete_failed);
    } finally {
      setDeletingId(null);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const headerTitle =
    step === 'mode'
      ? t.entry_title
      : step === 'scenes'
        ? t.scenes_title
        : step === 'upload'
          ? t.upload_title
          : step === 'play'
            ? mode === 'hidden'
              ? t.mode_hidden
              : t.mode_spot_diff
            : t.result_title;

  const goBack = () => {
    if (step === 'scenes') setStep('mode');
    else if (step === 'upload') setStep('scenes');
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
        aria-label={t.entry_title}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3 sm:px-5">
          {step !== 'mode' && (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={t.back}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h3 className="m-0 flex-1 text-base font-semibold text-slate-800 sm:text-lg">{headerTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={t.modal_close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-5">
          {step === 'mode' && (
            <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-2">
              <ModeCard
                icon={<Search className="h-8 w-8 text-indigo-600" />}
                title={t.mode_hidden}
                description={t.mode_hidden_desc}
                onClick={() => {
                  setMode('hidden');
                  setStep('scenes');
                }}
              />
              <ModeCard
                icon={<ImageIcon className="h-8 w-8 text-violet-600" />}
                title={t.mode_spot_diff}
                description={t.mode_spot_diff_desc}
                onClick={() => {
                  setMode('spot_diff');
                  setStep('scenes');
                }}
              />
            </div>
          )}

          {step === 'scenes' && (
            <div className="flex flex-col gap-4">
              {loading && <p className="text-sm text-slate-500">{t.loading}</p>}
              {manageError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{manageError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.scenes_group}</p>
                <button
                  type="button"
                  disabled={!groupId}
                  onClick={() => setStep('upload')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t.upload_open}
                </button>
              </div>

              {!loading && groupScenes.length === 0 ? (
                <p className="text-sm text-slate-500">{t.scenes_group_empty}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {groupScenes.map((item) => (
                    <SceneCard
                      key={item.id}
                      item={item}
                      canDelete={canDeleteScene(item)}
                      deleting={deletingId === item.id}
                      deleteLabel={t.delete_scene}
                      onPlay={() => startPlay(item)}
                      onDelete={(e) => void handleDelete(item, e)}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-400">{t.manage_hint}</p>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.scenes_system}</p>
              {!loading && systemScenes.length === 0 && groupScenes.length === 0 && (
                <p className="text-sm text-slate-500">{t.scenes_empty}</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {systemScenes.map((item) => (
                  <SceneCard
                    key={item.id}
                    item={item}
                    canDelete={false}
                    deleting={false}
                    deleteLabel={t.delete_scene}
                    onPlay={() => startPlay(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 'upload' && (
            <PictureFindUploadPanel
              groupId={groupId}
              t={t}
              onCancel={() => setStep('scenes')}
              onCreated={(created) => {
                void reload();
                startPlay(created);
              }}
            />
          )}

          {step === 'play' && mode && scene && puzzle && (
            <PictureFindGamePlay
              mode={mode}
              scene={scene}
              puzzle={puzzle}
              t={t}
              onComplete={handleComplete}
            />
          )}

          {step === 'result' && result && (
            <PictureFindResultPanel
              t={t}
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

function SceneCard({
  item,
  canDelete,
  deleting,
  deleteLabel,
  onPlay,
  onDelete,
}: {
  item: PictureFindScene;
  canDelete: boolean;
  deleting: boolean;
  deleteLabel: string;
  onPlay: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <button type="button" onClick={onPlay} className="block w-full text-left">
        <div className="aspect-[4/3] w-full bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        </div>
        <span className="block px-2 py-2 pr-8 text-sm font-semibold text-slate-700">{item.title}</span>
      </button>
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1.5 text-white hover:bg-black/70 disabled:opacity-50"
          aria-label={deleteLabel}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
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
