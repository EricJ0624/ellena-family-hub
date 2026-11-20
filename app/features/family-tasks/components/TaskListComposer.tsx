/**
 * 임무 추가 모달에서 여는 목록 작성 창.
 * 항목 초안 + 자주쓰는 목록 저장. 폼 state는 이 컴포넌트/부모 섹션에만 둔다.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { TopLayerDialog } from '@/app/components/TopLayerDialog';

export type TaskListComposerTranslations = {
  subtask_composer_title: string;
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
  items: string[];
  onChangeItems: (next: string[]) => void;
  sanitizeInput: (input: string | null | undefined, maxLength?: number) => string;
  isKidsTheme: boolean;
  translations: TaskListComposerTranslations;
  saveTemplate: (name: string, itemTexts: string[]) => Promise<string>;
  /** 자주쓰는 목록 저장 직후 — 불러오기 select에 바로 반영 */
  onTemplateSaved?: (templateId: string) => void;
};

export function TaskListComposer({
  open,
  onClose,
  items,
  onChangeItems,
  sanitizeInput,
  isKidsTheme,
  translations: t,
  saveTemplate,
  onTemplateSaved,
}: Props) {
  const [newText, setNewText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewText('');
    setTemplateName('');
    setError(null);
  }, [open]);

  const handleAdd = () => {
    const text = sanitizeInput(newText, 100);
    if (!text) return;
    onChangeItems([...items, text]);
    setNewText('');
    setError(null);
  };

  const handleRemove = (index: number) => {
    if (!confirm(t.delete_confirm)) return;
    onChangeItems(items.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async () => {
    const name = sanitizeInput(templateName, 60);
    if (!name) {
      setError(t.subtask_template_name_placeholder);
      return;
    }
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const id = await saveTemplate(name, items);
      setTemplateName('');
      onTemplateSaved?.(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  if (isKidsTheme) {
    return (
      <TopLayerDialog
        open={open}
        onClose={onClose}
        frameClassName="fixed inset-0 z-[10060] flex items-center justify-center p-4"
      >
        <div
          className="chalkboard-modal-frame chalkboard-modal-frame--stack chalkboard-modal-frame--desk"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="chalkboard-modal-container">
            <div className="chalkboard-modal-stack chalkboard-modal-stack--desk">
              <h2 className="chalkboard-modal-heading chalkboard-modal-heading--in-stack chalkboard-modal-heading--desk">
                {t.subtask_composer_title}
              </h2>

              <div className="chalkboard-desk-body">
                {items.length === 0 ? (
                  <p className="chalkboard-desk-empty">{t.subtask_empty}</p>
                ) : (
                  <ul className="chalkboard-desk-list">
                    {items.map((text, index) => (
                      <li key={`draft-${index}`} className="chalkboard-desk-item">
                        <span className="desk-text">{text}</span>
                        <button
                          type="button"
                          className="desk-delete"
                          aria-label="delete"
                          onClick={() => handleRemove(index)}
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
                        handleAdd();
                      }
                    }}
                    maxLength={100}
                    autoComplete="off"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      color: 'rgba(255, 248, 235, 0.9)',
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleAdd}
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
                    autoComplete="off"
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
    <TopLayerDialog
      open={open}
      onClose={onClose}
      frameClassName="fixed inset-0 z-[10060] flex items-center justify-center p-4"
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 shrink-0 text-base font-semibold text-slate-800">{t.subtask_composer_title}</h2>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5">
          {items.length === 0 ? (
            <p className="flex min-h-48 flex-1 items-center justify-center text-sm text-slate-500">
              {t.subtask_empty}
            </p>
          ) : (
            <ul className="m-0 flex min-h-48 max-h-[52dvh] list-none flex-col gap-2.5 overflow-y-auto p-0">
              {items.map((text, index) => (
                <li
                  key={`draft-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-base text-slate-800">{text}</span>
                  <button
                    type="button"
                    className="shrink-0 text-slate-400 hover:text-red-500"
                    aria-label="delete"
                    onClick={() => handleRemove(index)}
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
                  handleAdd();
                }
              }}
              maxLength={100}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleAdd}
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
              autoComplete="off"
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
