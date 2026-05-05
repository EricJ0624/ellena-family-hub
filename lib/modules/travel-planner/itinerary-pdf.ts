/**
 * 여행 일정 PDF (jsPDF). 클라이언트 전용 — 인증/API/DB와 무관.
 * 한글: Noto Sans KR subset OTF를 VFS에 넣어 Identity-H로 출력. 실패 시 Helvetica 유지.
 */
import type { jsPDF } from 'jspdf';
import { shortItineraryTitle } from './short-itinerary-title';

const VFS_FONT_FILE = 'NotoSansKR-Regular.otf';
const VFS_BOLD_FILE = 'NotoSansKR-Bold.otf';
const FONT_FAMILY = 'NotoSansKR';

/** 인디고 계열 (Tailwind indigo-600 근사) */
const BRAND_R = 79;
const BRAND_G = 70;
const BRAND_B = 229;

/** 요약 페이지 좌측 강조 바 */
const ACCENT_BAR_W = 3;

let cachedFontBase64: string | null = null;
let cachedBoldBase64: string | null = null;

export type ItineraryPdfItem = {
  type: 'accommodation' | 'dining' | 'attraction' | 'transport' | 'other';
  day_date: string;
  start_time?: string | null;
  end_time?: string | null;
  title: string;
  description?: string | null;
  address?: string | null;
  transport_type?: 'air' | 'train' | 'car' | 'bike';
};

export type ItineraryPdfTrip = {
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
};

export type ItineraryPdfLabels = {
  /** 표지 하단 작은 제목 (예: ITINERARY) */
  coverKicker: string;
  /** 2페이지 요약 섹션 제목 */
  overviewTitle: string;
  /** 상세 일정 섹션 제목 */
  detailsTitle: string;
  /** 일정 개수 표기 (예: (n) => `${n}곳`) */
  placesCount: (n: number) => string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}

async function fetchRegularFontBase64(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;

  const urls: string[] = [];
  if (typeof window !== 'undefined') {
    urls.push(`${window.location.origin}/fonts/${VFS_FONT_FILE}`);
  }
  urls.push(
    'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf',
  );

  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      cachedFontBase64 = arrayBufferToBase64(buf);
      return cachedFontBase64;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchBoldFontBase64(): Promise<string | null> {
  if (cachedBoldBase64) return cachedBoldBase64;

  const urls: string[] = [];
  if (typeof window !== 'undefined') {
    urls.push(`${window.location.origin}/fonts/${VFS_BOLD_FILE}`);
  }
  urls.push(
    'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf',
  );

  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      cachedBoldBase64 = arrayBufferToBase64(buf);
      return cachedBoldBase64;
    } catch {
      /* try next */
    }
  }
  return null;
}

function tryRegisterRegular(doc: jsPDF): boolean {
  try {
    if (!cachedFontBase64) return false;
    doc.addFileToVFS(VFS_FONT_FILE, cachedFontBase64);
    doc.addFont(VFS_FONT_FILE, FONT_FAMILY, 'normal', 'Identity-H');
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[itinerary-pdf] Noto Sans KR Regular 등록 실패:', e);
    }
    cachedFontBase64 = null;
    return false;
  }
}

function tryRegisterBold(doc: jsPDF): boolean {
  try {
    if (!cachedBoldBase64) return false;
    doc.addFileToVFS(VFS_BOLD_FILE, cachedBoldBase64);
    doc.addFont(VFS_BOLD_FILE, FONT_FAMILY, 'bold', 'Identity-H');
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[itinerary-pdf] Noto Sans KR Bold 등록 실패 (제목은 일반 굵기 사용):', e);
    }
    cachedBoldBase64 = null;
    return false;
  }
}

function setBodyFont(doc: jsPDF, hasKo: boolean, size: number) {
  doc.setFontSize(size);
  if (hasKo) {
    doc.setFont(FONT_FAMILY, 'normal');
  } else {
    doc.setFont('helvetica', 'normal');
  }
}

function setHeadingFont(doc: jsPDF, hasKo: boolean, hasKoBold: boolean, size: number) {
  doc.setFontSize(size);
  if (hasKo && hasKoBold) {
    doc.setFont(FONT_FAMILY, 'bold');
  } else if (hasKo) {
    doc.setFont(FONT_FAMILY, 'normal');
  } else {
    doc.setFont('helvetica', 'bold');
  }
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\u3131-\uD7A3]/g, '-');
}

function ensurePageSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

/**
 * 일정 PDF 생성 후 브라우저 저장 대화상자.
 */
export async function buildAndSaveTravelItineraryPdf(params: {
  trip: ItineraryPdfTrip;
  items: ItineraryPdfItem[];
  getTypeLabel: (type: ItineraryPdfItem['type'], transport_type?: ItineraryPdfItem['transport_type']) => string;
  emptyItineraryMessage: string;
  pdfLabels: ItineraryPdfLabels;
  /** 경비 요약 (이미 포맷된 문자열 줄들). 없으면 생략. */
  expenseSummaryLines?: string[];
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const lineH = 6;

  const [regBase64, boldBase64] = await Promise.all([
    fetchRegularFontBase64(),
    fetchBoldFontBase64(),
  ]);

  const hasKo = Boolean(regBase64 && tryRegisterRegular(doc));
  const hasKoBold = Boolean(hasKo && boldBase64 && tryRegisterBold(doc));

  if (!hasKo && process.env.NODE_ENV === 'development') {
    console.warn('[itinerary-pdf] 한글 폰트를 불러오지 못했습니다. Helvetica로 저장됩니다.');
  }

  setHeadingFont(doc, hasKo, hasKoBold, 20);
  const titleLines = doc.splitTextToSize(params.trip.title, contentW);
  const titleLineHeight = lineH + 2;
  const headerBarH = Math.max(44, 26 + titleLines.length * titleLineHeight + 12);

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(0, 0, pageW, headerBarH, 'F');

  doc.setTextColor(255, 255, 255);
  setHeadingFont(doc, hasKo, hasKoBold, 20);
  let yTitle = 26;
  for (const line of titleLines) {
    doc.text(line, margin, yTitle);
    yTitle += titleLineHeight;
  }

  setBodyFont(doc, hasKo, 10);
  let yMeta = headerBarH + 12;
  doc.setTextColor(55, 65, 81);

  if (params.trip.destination) {
    setBodyFont(doc, hasKo, 11);
    doc.text(params.trip.destination, margin, yMeta);
    yMeta += lineH;
  }
  setBodyFont(doc, hasKo, 11);
  doc.text(`${params.trip.start_date} ~ ${params.trip.end_date}`, margin, yMeta);
  yMeta += lineH + 8;

  setBodyFont(doc, hasKo, 9);
  doc.setTextColor(100, 116, 139);
  doc.text(params.pdfLabels.coverKicker, margin, yMeta);
  doc.setTextColor(55, 65, 81);

  if (params.expenseSummaryLines && params.expenseSummaryLines.length > 0) {
    yMeta += lineH + 4;
    setBodyFont(doc, hasKo, 9);
    doc.setTextColor(71, 85, 105);
    for (const line of params.expenseSummaryLines) {
      const sub = doc.splitTextToSize(line, contentW);
      for (const sl of sub) {
        yMeta = ensurePageSpace(doc, yMeta, lineH + 2, margin);
        doc.text(sl, margin, yMeta);
        yMeta += lineH - 1;
      }
      yMeta += 2;
    }
    doc.setTextColor(55, 65, 81);
  }

  if (params.items.length === 0) {
    setBodyFont(doc, hasKo, 10);
    yMeta = ensurePageSpace(doc, yMeta, lineH + 8, margin);
    doc.text(params.emptyItineraryMessage, margin, yMeta + 6);
    doc.save(`itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
    return;
  }

  const byDay = new Map<string, ItineraryPdfItem[]>();
  for (const i of params.items) {
    const day = i.day_date || '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  }
  const days = Array.from(byDay.keys()).sort();

  /** ========== Phase 3: 요약 페이지 ========== */
  doc.addPage();
  let y = margin;

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(margin, y - 5, ACCENT_BAR_W, 10, 'F');
  setHeadingFont(doc, hasKo, hasKoBold, 14);
  doc.setTextColor(30, 41, 59);
  doc.text(params.pdfLabels.overviewTitle, margin + ACCENT_BAR_W + 6, y);
  y += lineH + 10;
  setBodyFont(doc, hasKo, 9);
  doc.setTextColor(100, 116, 139);

  for (let idx = 0; idx < days.length; idx++) {
    const day = days[idx]!;
    const dayItems = byDay.get(day)!;
    const count = dayItems.length;
    const previewParts = dayItems.slice(0, 2).map((it) => shortItineraryTitle(it.type, it.title, it.address));
    const more = count > 2 ? ` (+${count - 2})` : '';
    const summaryCore = `${previewParts.join(' · ')}${more}`;
    const summaryLine = doc.splitTextToSize(
      `Day ${idx + 1} · ${day} · ${params.pdfLabels.placesCount(count)} — ${summaryCore}`,
      contentW - ACCENT_BAR_W - 8,
    );

    y = ensurePageSpace(doc, y, summaryLine.length * (lineH + 1) + 8, margin);

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageW - margin * 2, summaryLine.length * (lineH - 1) + 10, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y - 4, pageW - margin * 2, summaryLine.length * (lineH - 1) + 10, 'S');

    doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
    doc.rect(margin, y - 4, ACCENT_BAR_W, summaryLine.length * (lineH - 1) + 10, 'F');

    setBodyFont(doc, hasKo, 9);
    doc.setTextColor(51, 65, 85);
    let rowY = y;
    for (const ln of summaryLine) {
      doc.text(ln, margin + ACCENT_BAR_W + 5, rowY);
      rowY += lineH - 0.5;
    }
    y = rowY + lineH + 2;
  }

  doc.setTextColor(55, 65, 81);

  /** ========== 상세 일정 ========== */
  doc.addPage();
  y = margin;

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(margin, y - 5, ACCENT_BAR_W, 10, 'F');
  setHeadingFont(doc, hasKo, hasKoBold, 14);
  doc.setTextColor(30, 41, 59);
  doc.text(params.pdfLabels.detailsTitle, margin + ACCENT_BAR_W + 6, y);
  y += lineH + 12;

  for (let idx = 0; idx < days.length; idx++) {
    y = ensurePageSpace(doc, y, lineH + 20, margin);
    const day = days[idx]!;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pageW - margin, y - 4);
    setHeadingFont(doc, hasKo, hasKoBold, 13);
    doc.setTextColor(30, 41, 59);
    doc.text(`Day ${idx + 1}  ·  ${day}`, margin, y);
    y += lineH + 4;
    doc.setTextColor(55, 65, 81);
    setBodyFont(doc, hasKo, 10);

    for (const i of byDay.get(day)!) {
      y = ensurePageSpace(doc, y, lineH + 8, margin);
      const label = params.getTypeLabel(i.type, i.transport_type);
      const timeStr =
        i.start_time || i.end_time ? `  ${i.start_time || '--'} ~ ${i.end_time || '--'}` : '';
      const pdfTitle = shortItineraryTitle(i.type, i.title, i.address);
      doc.text(`[${label}] ${pdfTitle}${timeStr}`, margin, y);
      y += lineH;
      if (i.description && i.description.trim()) {
        const lines = doc.splitTextToSize(i.description.trim(), pageW - margin * 2 - 8);
        setBodyFont(doc, hasKo, 9);
        for (const line of lines) {
          y = ensurePageSpace(doc, y, 6, margin);
          doc.text(line, margin + 6, y);
          y += 5;
        }
        setBodyFont(doc, hasKo, 10);
        y += 2;
      }
      y += 2;
    }
    y += 6;
  }

  doc.save(`itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
}
