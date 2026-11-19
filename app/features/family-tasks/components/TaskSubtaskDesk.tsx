/**
 * 임무 서브태스크 창 — 체크리스트 보기/편집, 목록 템플릿 저장.
 * 마감·알림은 할 일 추가 모달에서만 설정 (이 창에는 없음).
 * 폼 state는 FamilyTasksSection 안에서만 유지 (대시보드 page로 올리지 않음).
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';
import { useFamilyTaskSubtasks } from '../hooks/useFamilyTaskSubtasks';
import type { FamilyTask } from '../types';

export type TaskSubtaskDeskTranslations = {
  subtask_desk_title: string;
  subtask_add_placeholder: string;
  subtask_add_btn: string;
  subtask_empty: string;
  subtask_save_list: string;
  subtask_template_name_placeholder: string;
  close: string;
  delete_confirm: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  task: FamilyTask | null;
  currentGroupId: string | null;
  getCurrentKey: () => string;
  CryptoService: {
    encrypt: (data: any, key: string) => string;
    decrypt: (cipher: string, key: string) => any;
  };
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  isKidsTheme: boolean;
  translations: TaskSubtaskDeskTranslations;
  /** 부모(FamilyTasksSection)와 동일 훅 — 저장 후 추가 모달 목록이 바로 갱신됨 */
  saveTemplate: (name: string, itemTexts: string[]) => Promise<string>;
};

export function TaskSubtaskDesk({
  open,
  onClose,
  task,
  currentGroupId,
  getCurrentKey,
  CryptoService,
  sanitizeInput,
  isKidsTheme,
  translations: t,
  saveTemplate,
}: Props) {
  const taskId = task && !/^\d+$/.test(String(task.id)) ? String(task.id) : null;
  const {
    items,
    loading,
    addSubtask,
    updateSubtaskText,
    toggleSubtask,
    deleteSubtask,
  } = useFamilyTaskSubtasks({
    taskId: open ? taskId : null,
    currentGroupId,
    getCurrentKey,
    CryptoService,
  });

  const [newText, setNewText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const draftValues = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!open || !task) return;
    setNewText('');
    setTemplateName('');
    setError(null);
  }, [open, task?.id]);

  useEffect(() => {
    return () => {
      draftTimers.current.forEach((timer) => clearTimeout(timer));
      draftTimers.current.clear();
    };
  }, []);

  const handleAdd = async () => {
    const text = sanitizeInput(newText, 100);
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await addSubtask(text);
      setNewText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const scheduleTextSave = (subtaskId: string, value: string) => {
    draftValues.current.set(subtaskId, value);
    const prev = draftTimers.current.get(subtaskId);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      draftTimers.current.delete(subtaskId);
      const latest = draftValues.current.get(subtaskId);
      if (latest == null) return;
      const cleaned = sanitizeInput(latest, 100);
      if (!cleaned) return;
      void updateSubtaskText(subtaskId, cleaned).catch((e) => {
        setError(e instanceof Error ? e.message : '저장 실패');
      });
    }, 450);
    draftTimers.current.set(subtaskId, timer);
  };

  const handleSaveTemplate = async () => {
    const name = sanitizeInput(templateName, 60);
    if (!name) {
      setError(t.subtask_template_name_placeholder);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveTemplate(
        name,
        items.map((i) => i.text),
      );
      setTemplateName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  if (isKidsTheme) {
    return (
      <TopLayerDialog open={open} onClose={onClose}>
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
                          onClick={() => void toggleSubtask(item.id, !item.done)}
                          aria-checked={item.done}
                          role="checkbox"
                        >
                          {item.done ? '✓' : ''}
                        </button>
                        <input
                          type="text"
                          className={`desk-text${item.done ? ' is-done' : ''}`}
                          defaultValue={item.text}
                          key={`${item.id}:${item.text}`}
                          onChange={(e) => scheduleTextSave(item.id, e.target.value)}
                          maxLength={100}
                          style={{
                            background: 'transparent',
                            backgroundColor: 'transparent',
                            color: 'rgba(255, 248, 235, 0.95)',
                            border: 'none',
                            borderBottom: 'none',
                            boxShadow: 'none',
                            outline: 'none',
                            filter: 'none',
                            fontSize: '1.35rem',
                          }}
                        />
                        <button
                          type="button"
                          className="desk-delete"
                          aria-label="delete"
                          onClick={() => {
                            if (!confirm(t.delete_confirm)) return;
                            void deleteSubtask(item.id).catch((e) =>
                              setError(e instanceof Error ? e.message : '삭제 실패'),
                            );
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="chalkboard-desk-secondary">
                  <input
                    type="text"
                    className="chalkboard-desk-input"
                    placeholder={t.subtask_add_placeholder}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAdd();
                      }
                    }}
                    maxLength={100}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      color: 'rgba(255, 248, 235, 0.9)',
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAdd()}
                    className="chalkboard-desk-btn"
                  >
                    {t.subtask_add_btn}
                  </button>
                </div>

                <div className="chalkboard-desk-secondary">
                  <input
                    type="text"
                    className="chalkboard-desk-input"
                    placeholder={t.subtask_template_name_placeholder}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    maxLength={60}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      color: 'rgba(255, 248, 235, 0.9)',
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || items.length === 0}
                    onClick={() => void handleSaveTemplate()}
                    className="chalkboard-desk-btn chalkboard-desk-btn--ghost"
                  >
                    {t.subtask_save_list}
                  </button>
                </div>

                {error ? <p className="chalkboard-modal-error">{error}</p> : null}
              </div>

              <div className="chalkboard-desk-actions">
                <button type="button" onClick={onClose} className="chalkboard-desk-btn chalkboard-desk-btn--ghost">
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
    <TopLayerDialog open={open} onClose={onClose}>
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
                    onClick={() => void toggleSubtask(item.id, !item.done)}
                    aria-checked={item.done}
                    role="checkbox"
                  >
                    {item.done ? '✓' : ''}
                  </button>
                  <input
                    type="text"
                    className={`min-w-0 flex-1 border-0 bg-transparent text-base text-slate-800 outline-none ${
                      item.done ? 'line-through opacity-60' : ''
                    }`}
                    defaultValue={item.text}
                    key={`${item.id}:${item.text}`}
                    onChange={(e) => scheduleTextSave(item.id, e.target.value)}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-slate-400 hover:text-red-500"
                    aria-label="delete"
                    onClick={() => {
                      if (!confirm(t.delete_confirm)) return;
                      void deleteSubtask(item.id).catch((e) =>
                        setError(e instanceof Error ? e.message : '삭제 실패'),
                      );
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex shrink-0 gap-2">
            <input
              type="text"
              className="form-input min-h-8 flex-1 py-1.5 text-sm"
              placeholder={t.subtask_add_placeholder}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              maxLength={100}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAdd()}
              className="shrink-0 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {t.subtask_add_btn}
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              type="text"
              className="form-input min-h-8 min-w-[8rem] flex-1 py-1.5 text-sm"
              placeholder={t.subtask_template_name_placeholder}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              maxLength={60}
            />
            <button
              type="button"
              disabled={busy || items.length === 0}
              onClick={() => void handleSaveTemplate()}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {t.subtask_save_list}
            </button>
          </div>

          {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="mt-3 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.close}
          </button>
        </div>
      </div>
    </TopLayerDialog>
  );
}
