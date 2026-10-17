'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/app/contexts/LanguageContext';
import type { LangCode } from '@/lib/language-fonts';
import { getSearchableSelectText } from '@/lib/translations/searchable-select';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  /** 가입 화면처럼 화면 언어와 폼 언어가 다를 때 */
  lang?: LangCode;
  tone?: 'default' | 'night';
};

/**
 * 기존 드롭다운 목록은 유지하고, 열린 목록 위에 검색만 붙인다.
 * 위치는 스크롤 영역 밖으로 잘리지 않도록 뷰포트 기준으로 잡는다.
 */
export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  className,
  ariaLabel,
  lang: langProp,
  tone = 'default',
}: Props) {
  const { lang: contextLang } = useLanguage();
  const lang = langProp ?? contextLang;
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
      )
    : options;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 220 && rect.top > spaceBelow ? Math.max(8, rect.top - 292) : rect.bottom + 4;
      setBox({ top, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const night = tone === 'night';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          setQuery('');
          setOpen((current) => !current);
        }}
        className={['flex items-center text-left', className].filter(Boolean).join(' ')}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
      </button>
      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              style={{ top: box.top, left: box.left, width: box.width }}
              className={[
                'fixed z-[1300] flex max-h-72 flex-col overflow-hidden rounded-lg border shadow-lg',
                night ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800',
              ].join(' ')}
            >
              <input
                type="text"
                value={query}
                autoFocus
                placeholder={getSearchableSelectText(lang, 'search')}
                aria-label={getSearchableSelectText(lang, 'search')}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false);
                }}
                className={[
                  'box-border w-full border-0 border-b px-3 py-2 text-sm outline-none',
                  night
                    ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400'
                    : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400',
                ].join(' ')}
              />
              <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1">
                {visible.length === 0 ? (
                  <li className={night ? 'px-3 py-2 text-sm text-slate-400' : 'px-3 py-2 text-sm text-slate-500'}>
                    {getSearchableSelectText(lang, 'empty')}
                  </li>
                ) : (
                  visible.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <li key={option.value || '__empty'}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onChange(option.value);
                            setOpen(false);
                          }}
                          className={[
                            'w-full cursor-pointer rounded-md border-0 px-3 py-2 text-left text-sm',
                            night
                              ? isSelected
                                ? 'bg-white/15 text-white'
                                : 'bg-transparent text-slate-100 hover:bg-white/10'
                              : isSelected
                                ? 'bg-violet-100 text-slate-900'
                                : 'bg-transparent text-slate-800 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {option.label}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
