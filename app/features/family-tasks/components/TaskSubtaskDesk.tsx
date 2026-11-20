/**
 * 임무 서브태스크 창 — 체크리스트 보기 전용 (체크·취소선·닫기).
 * 항목 추가/자주쓰는 저장은 TaskListComposer(임무 추가 모달)에서 처리.
 * 폼 state는 FamilyTasksSection 안에서만 유지 (대시보드 page로 올리지 않음).
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';
import { useFamilyTaskSubtasks } from '../hooks/useFamilyTaskSubtasks';
import type { FamilyTask } from '../types';

export type TaskSubtaskDeskTranslations = {
  subtask_desk_title: string;
  subtask_empty: string;
  subtask_all_done: string;
  close: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** 목록이 전부 완료인 채 닫을 때 — 부모 임무를 완료 처리 */
  onCloseWithAllDone?: () => void;
  task: FamilyTask | null;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  isKidsTheme: boolean;
  translations: TaskSubtaskDeskTranslations;
};

function fireAllDoneConfetti() {
  void import('canvas-confetti').then(({ default: confetti }) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10070';
    document.body.appendChild(canvas);
    const fire = confetti.create(canvas, { resize: true, useWorker: false });
    const colors = ['#fff8eb', '#fde68a', '#86efac', '#7dd3fc', '#f9a8d4'];
    fire({
      particleCount: 70,
      spread: 68,
      origin: { x: 0.5, y: 0.55 },
      colors,
      ticks: 160,
      startVelocity: 28,
      gravity: 0.9,
    });
    setTimeout(() => {
      fire.reset();
      canvas.remove();
    }, 1800);
  });
}

export function TaskSubtaskDesk({
  open,
  onClose,
  onCloseWithAllDone,
  task,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  isKidsTheme,
  translations: t,
}: Props) {
  const taskId = task && !/^\d+$/.test(String(task.id)) ? String(task.id) : null;
  const { items, loading, toggleSubtask } = useFamilyTaskSubtasks({
    taskId: open ? taskId : null,
    currentGroupId,
    getCurrentKey,
    CryptoService,
  });

  const [showAllDone, setShowAllDone] = useState(false);
  const celebratedRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!open) {
      celebratedRef.current = false;
      setShowAllDone(false);
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    }
  }, [open, task?.id]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const celebrateIfAllDone = (allDone: boolean) => {
    if (!allDone) {
      celebratedRef.current = false;
      return;
    }
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setShowAllDone(true);
    fireAllDoneConfetti();
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setShowAllDone(false);
      bannerTimerRef.current = null;
    }, 1500);
  };

  const handleToggle = (itemId: string, nextDone: boolean) => {
    const allDone =
      items.length > 0 && items.every((row) => (row.id === itemId ? nextDone : row.done));
    void toggleSubtask(itemId, nextDone)
      .then(() => {
        celebrateIfAllDone(allDone);
      })
      .catch(() => {
        /* 훅에서 롤백 — 실패 시 축하 없음 */
      });
  };

  const handleClose = () => {
    const latest = itemsRef.current;
    const allDone = latest.length > 0 && latest.every((row) => row.done);
    if (allDone) onCloseWithAllDone?.();
    onClose();
  };

  const allDoneBanner = showAllDone ? (
    <p
      className={
        isKidsTheme
          ? 'chalkboard-desk-all-done'
          : 'm-0 text-center text-base font-semibold text-emerald-600'
      }
      aria-live="polite"
    >
      {t.subtask_all_done}
    </p>
  ) : null;

  if (isKidsTheme) {
    return (
      <TopLayerDialog open={open} onClose={handleClose}>
        <div
          className="chalkboard-modal-frame chalkboard-modal-frame--stack chalkboard-modal-frame--desk"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="chalkboard-modal-container">
            <div className="chalkboard-modal-stack chalkboard-modal-stack--desk">
              <h2 className="chalkboard-modal-heading chalkboard-modal-heading--in-stack chalkboard-modal-heading--desk">
                {t.subtask_desk_title}
                {task?.text ? ` — ${task.text}` : ''}
              </h2>

              <div className="chalkboard-desk-body">
                {loading ? (
                  <p className="chalkboard-desk-empty">…</p>
                ) : items.length === 0 ? (
                  <p className="chalkboard-desk-empty">{t.subtask_empty}</p>
                ) : (
                  <ul className="chalkboard-desk-list">
                    {items.map((item) => (
                      <li key={item.id} className="chalkboard-desk-item">
                        <button
                          type="button"
                          className="desk-check"
                          onClick={() => handleToggle(item.id, !item.done)}
                          aria-checked={item.done}
                          role="checkbox"
                        >
                          {item.done ? '✓' : ''}
                        </button>
                        <span className={`desk-text${item.done ? ' is-done' : ''}`}>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {allDoneBanner}
              </div>

              <div className="chalkboard-desk-actions">
                <button
                  type="button"
                  onClick={handleClose}
                  className="chalkboard-desk-btn chalkboard-desk-btn--ghost"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      </TopLayerDialog>
    );
  }

  return (
    <TopLayerDialog open={open} onClose={handleClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 shrink-0 text-base font-semibold text-slate-800">
          {t.subtask_desk_title}
          {task?.text ? ` — ${task.text}` : ''}
        </h2>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
          {loading ? (
            <p className="flex min-h-48 flex-1 items-center justify-center text-sm text-slate-500">…</p>
          ) : items.length === 0 ? (
            <p className="flex min-h-48 flex-1 items-center justify-center text-sm text-slate-500">
              {t.subtask_empty}
            </p>
          ) : (
            <ul className="m-0 flex min-h-48 max-h-[52dvh] list-none flex-col gap-2.5 overflow-y-auto p-0">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <button
                    type="button"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-sm"
                    onClick={() => handleToggle(item.id, !item.done)}
                    aria-checked={item.done}
                    role="checkbox"
                  >
                    {item.done ? '✓' : ''}
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-base text-slate-800 ${
                      item.done ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {allDoneBanner}
        </div>

        <div className="mt-3 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.close}
          </button>
        </div>
      </div>
    </TopLayerDialog>
  );
}
