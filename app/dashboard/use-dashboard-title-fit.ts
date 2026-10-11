'use client';

import { useLayoutEffect, type MutableRefObject, type RefObject } from 'react';
import {
  shrinkFontSizeToElement,
  CUSTOM_TITLE_FONT_MIN_PX,
  NEO_STAMP_TITLE_MIN_PX,
  HIGHEND_CAPSULE_TITLE_MIN_PX,
  DEFAULT_APP_TITLE_MAX_PX_PORTRAIT,
  DEFAULT_APP_TITLE_MIN_PX_PORTRAIT,
} from '@/lib/dashboard-title-fit';

/**
 * 타이틀 폭 실측 effect만 분리.
 * 결과 state(customTitleFontSize)는 deps에 넣지 않음. 너비는 2px 미만이면 유지.
 */
export function useDashboardTitleMeasureEffects(opts: {
  measureCustomTitleFontSize: () => void;
  titleRowRef: RefObject<HTMLDivElement | null>;
  titleContainerRef: RefObject<HTMLDivElement | null>;
  titleH1Ref: RefObject<HTMLHeadingElement | null>;
  titleBoxWidthRef: MutableRefObject<number>;
  customTitleFontSizeRef: MutableRefObject<number | null>;
  setCustomTitleFontSize: (updater: (prev: number | null) => number | null) => void;
  dashboardTitleText: string;
  isDefaultDashboardTitle: boolean;
  frameIsPortrait: boolean;
  isAdminTitleContext: boolean;
  isKidsTheme: boolean;
  isNeoTheme: boolean;
  isHighendTheme: boolean;
  estimatedCustomTitleFontSize: number;
  titleFitMaxPx: number;
  customFontSizeCap: number | null;
}) {
  const {
    measureCustomTitleFontSize,
    titleRowRef,
    titleContainerRef,
    titleH1Ref,
    titleBoxWidthRef,
    customTitleFontSizeRef,
    setCustomTitleFontSize,
    dashboardTitleText,
    isDefaultDashboardTitle,
    frameIsPortrait,
    isAdminTitleContext,
    isKidsTheme,
    isNeoTheme,
    isHighendTheme,
    estimatedCustomTitleFontSize,
    titleFitMaxPx,
    customFontSizeCap,
  } = opts;

  useLayoutEffect(() => {
    measureCustomTitleFontSize();
    const row = titleRowRef.current;
    const container = titleContainerRef.current;
    // h1은 관찰하지 않음 — fontSize 변경으로 높이가 바뀌면 RO→setState 무한 루프(#185)
    if (!row && !container) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (Math.abs(w - titleBoxWidthRef.current) < 2) return;
      titleBoxWidthRef.current = w;
      measureCustomTitleFontSize();
    });
    if (row) ro.observe(row);
    if (container) ro.observe(container);
    const onFonts = () => measureCustomTitleFontSize();
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    void document.fonts?.ready?.then(onFonts);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, [measureCustomTitleFontSize, dashboardTitleText, isDefaultDashboardTitle, frameIsPortrait, isAdminTitleContext, titleRowRef, titleContainerRef, titleBoxWidthRef]);

  /** DOM 실측 — scrollWidth 초과 시 축소 (canvas 추정 보정). 결과 fontSize는 deps에 넣지 않음(자기 루프 #185). */
  useLayoutEffect(() => {
    const el = titleH1Ref.current;
    if (!el) return;
    /* kids 간판은 테두리가 h1 scrollWidth에 포함된다. 여기서 다시 줄이면 글자가 최소 크기까지 떨어진다. */
    if (isKidsTheme) return;

    if (frameIsPortrait && isDefaultDashboardTitle && !isHighendTheme) {
      const maxPx = Math.min(
        customFontSizeCap ?? DEFAULT_APP_TITLE_MAX_PX_PORTRAIT,
        DEFAULT_APP_TITLE_MAX_PX_PORTRAIT,
      );
      const startPx = customTitleFontSizeRef.current ?? estimatedCustomTitleFontSize ?? maxPx;
      const fitted = shrinkFontSizeToElement(el, startPx, DEFAULT_APP_TITLE_MIN_PX_PORTRAIT);
      setCustomTitleFontSize((prev) => (prev === fitted ? prev : fitted));
      return;
    }

    if (!frameIsPortrait && isDefaultDashboardTitle && !isNeoTheme && !isHighendTheme) return;

    const chipTarget = isNeoTheme
      ? ((el.querySelector('.dashboard-neo-title-text') as HTMLElement | null)
        ?? (el.querySelector('.dashboard-neo-title-stamp') as HTMLElement | null)
        ?? el)
      : isHighendTheme
        ? ((el.querySelector('.dashboard-highend-title-text') as HTMLElement | null)
          ?? (el.querySelector('.dashboard-highend-title-capsule') as HTMLElement | null)
          ?? el)
        : el;
    const minPx = isNeoTheme
      ? NEO_STAMP_TITLE_MIN_PX
      : isHighendTheme
        ? HIGHEND_CAPSULE_TITLE_MIN_PX
        : CUSTOM_TITLE_FONT_MIN_PX;
    const startPx = customTitleFontSizeRef.current ?? estimatedCustomTitleFontSize ?? titleFitMaxPx;
    const fitted = shrinkFontSizeToElement(chipTarget, startPx, minPx);
    setCustomTitleFontSize((prev) => (prev === fitted ? prev : fitted));
  }, [
    frameIsPortrait,
    isDefaultDashboardTitle,
    estimatedCustomTitleFontSize,
    dashboardTitleText,
    titleFitMaxPx,
    customFontSizeCap,
    isNeoTheme,
    isHighendTheme,
    isKidsTheme,
    titleH1Ref,
    customTitleFontSizeRef,
    setCustomTitleFontSize,
  ]);
}
