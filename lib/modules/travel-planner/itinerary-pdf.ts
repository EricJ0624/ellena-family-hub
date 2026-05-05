/**
 * 여행 일정 PDF (jsPDF). 클라이언트 전용 — 인증/API/DB와 무관.
 * 다국어: Noto CJK/Noto Sans를 VFS에 넣고 Identity-H로 출력. (addFont 5번째 인자=encoding — 4번째에 넣으면 Unicode가 출력되지 않음)
 */
import type { jsPDF } from 'jspdf';
import type { LangCode } from '@/lib/language-fonts';
import { shortItineraryTitle } from './short-itinerary-title';

/** jsPDF addFont: (vfsName, id, style, fontWeight, encoding) — encoding은 5번째 */
const IDENTITY_H = 'Identity-H' as const;

/** 앱 UI 언어별 기본 Noto 서브셋 (en은 콘텐츠에 따라 latin / CJK 서브셋 자동) */
type PdfFontModule = 'kr' | 'jp' | 'sc' | 'tc' | 'latin';

const NOTO_CJK_BASE =
  'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF';
const NOTO_CJK_RAW = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF';

const FONT_SPECS: Record<
  Exclude<PdfFontModule, 'latin'>,
  { vfs: string; family: string; dir: 'KR' | 'JP' | 'SC' | 'TC'; file: string }
> = {
  kr: { vfs: 'NotoSansKR-Regular.otf', family: 'NotoSansKR', dir: 'KR', file: 'NotoSansKR-Regular.otf' },
  jp: { vfs: 'NotoSansJP-Regular.otf', family: 'NotoSansJP', dir: 'JP', file: 'NotoSansJP-Regular.otf' },
  sc: { vfs: 'NotoSansSC-Regular.otf', family: 'NotoSansSC', dir: 'SC', file: 'NotoSansSC-Regular.otf' },
  tc: { vfs: 'NotoSansTC-Regular.otf', family: 'NotoSansTC', dir: 'TC', file: 'NotoSansTC-Regular.otf' },
};

const BRAND_R = 79;
const BRAND_G = 70;
const BRAND_B = 229;
const ACCENT_BAR_W = 3;

let cachedB64: Partial<Record<PdfFontModule, string | null>> = {};

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
  coverKicker: string;
  overviewTitle: string;
  detailsTitle: string;
  placesCount: (n: number) => string;
};

type ActiveFont = { kind: 'latin' } | { kind: 'embedded'; family: string };

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

/** 영어 UI일 때 본문에 동아시아 문자가 있으면 적절한 Noto 서브셋 선택 */
function resolvePdfFontModule(lang: LangCode, contentBlob: string): PdfFontModule {
  if (lang === 'ko') return 'kr';
  if (lang === 'ja') return 'jp';
  if (lang === 'zh-CN') return 'sc';
  if (lang === 'zh-TW') return 'tc';
  if (/[\uAC00-\uD7AF]/.test(contentBlob)) return 'kr';
  if (/[\u3040-\u30FF]/.test(contentBlob)) return 'jp';
  if (/[\u4E00-\u9FFF]/.test(contentBlob)) return 'sc';
  return 'latin';
}

function collectContentBlobForFontHint(params: {
  trip: ItineraryPdfTrip;
  items: ItineraryPdfItem[];
  getTypeLabel: (type: ItineraryPdfItem['type'], transport_type?: ItineraryPdfItem['transport_type']) => string;
  emptyItineraryMessage: string;
  pdfLabels: ItineraryPdfLabels;
  expenseSummaryLines?: string[];
}): string {
  const p: string[] = [
    params.trip.title,
    params.trip.destination ?? '',
    params.trip.start_date,
    params.trip.end_date,
    params.emptyItineraryMessage,
    params.pdfLabels.coverKicker,
    params.pdfLabels.overviewTitle,
    params.pdfLabels.detailsTitle,
  ];
  if (params.expenseSummaryLines) p.push(...params.expenseSummaryLines);
  for (const it of params.items) {
    p.push(
      it.title,
      it.description ?? '',
      it.address ?? '',
      it.day_date,
      it.start_time ?? '',
      it.end_time ?? '',
      params.getTypeLabel(it.type, it.transport_type),
    );
  }
  return p.join('\n');
}

async function fetchNotoCjkBase64(module: Exclude<PdfFontModule, 'latin'>): Promise<string | null> {
  if (cachedB64[module] !== undefined) return cachedB64[module] ?? null;

  const spec = FONT_SPECS[module];
  const urls: string[] = [];
  if (typeof window !== 'undefined') {
    urls.push(`${window.location.origin}/fonts/${spec.file}`);
  }
  urls.push(
    `${NOTO_CJK_BASE}/${spec.dir}/${spec.file}`,
    `${NOTO_CJK_RAW}/${spec.dir}/${spec.file}`,
  );

  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      const b64 = arrayBufferToBase64(buf);
      cachedB64[module] = b64;
      return b64;
    } catch {
      /* try next */
    }
  }
  cachedB64[module] = null;
  return null;
}

function tryRegisterNotoSubset(doc: jsPDF, module: Exclude<PdfFontModule, 'latin'>): boolean {
  const spec = FONT_SPECS[module];
  const b64 = cachedB64[module];
  if (!b64) return false;
  try {
    doc.addFileToVFS(spec.vfs, b64);
    /** fontWeight 4번째, encoding 5번째 — 순서 틀리면 전부 빈 텍스트 */
    doc.addFont(spec.vfs, spec.family, 'normal', 'normal', IDENTITY_H);
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[itinerary-pdf] Noto (${module}) 등록 실패:`, e);
    }
    return false;
  }
}

async function resolveActiveFont(doc: jsPDF, lang: LangCode, contentBlob: string): Promise<ActiveFont> {
  const mod = resolvePdfFontModule(lang, contentBlob);
  if (mod === 'latin') {
    return { kind: 'latin' };
  }
  const b64 = await fetchNotoCjkBase64(mod);
  if (!b64 || !tryRegisterNotoSubset(doc, mod)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[itinerary-pdf] Noto 서브셋을 불러오지 못했습니다. Helvetica로 저장합니다(동아시아 문자는 비거나 깨질 수 있음).');
    }
    return { kind: 'latin' };
  }
  return { kind: 'embedded', family: FONT_SPECS[mod].family };
}

function setBodyFont(doc: jsPDF, active: ActiveFont, size: number) {
  doc.setFontSize(size);
  if (active.kind === 'embedded') {
    doc.setFont(active.family, 'normal');
  } else {
    doc.setFont('helvetica', 'normal');
  }
}

function setHeadingFont(doc: jsPDF, active: ActiveFont, size: number) {
  doc.setFontSize(size);
  if (active.kind === 'embedded') {
    doc.setFont(active.family, 'normal');
  } else {
    doc.setFont('helvetica', 'bold');
  }
}

function restoreDefaultBodyStyle(doc: jsPDF, active: ActiveFont) {
  doc.setTextColor(55, 65, 81);
  setBodyFont(doc, active, 10);
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\u3131-\uD7A3]/g, '-');
}

function ensurePageSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  margin: number,
  active: ActiveFont,
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    restoreDefaultBodyStyle(doc, active);
    return margin;
  }
  return y;
}

/**
 * 일정 PDF 생성 후 브라우저 저장 대화상자.
 */
export async function buildAndSaveTravelItineraryPdf(params: {
  /** 앱 표시 언어 — PDF 라벨·Noto 서브셋 선택에 사용 */
  lang: LangCode;
  trip: ItineraryPdfTrip;
  items: ItineraryPdfItem[];
  getTypeLabel: (type: ItineraryPdfItem['type'], transport_type?: ItineraryPdfItem['transport_type']) => string;
  emptyItineraryMessage: string;
  pdfLabels: ItineraryPdfLabels;
  expenseSummaryLines?: string[];
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ compress: true });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const lineH = 6;

  const contentBlob = collectContentBlobForFontHint(params);
  const active = await resolveActiveFont(doc, params.lang, contentBlob);

  setHeadingFont(doc, active, 20);
  const titleLines = doc.splitTextToSize(params.trip.title, contentW);
  const titleLineHeight = lineH + 2;
  const headerBarH = Math.max(44, 26 + titleLines.length * titleLineHeight + 12);

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(0, 0, pageW, headerBarH, 'F');

  doc.setTextColor(255, 255, 255);
  setHeadingFont(doc, active, 20);
  let yTitle = 26;
  for (const line of titleLines) {
    doc.text(line, margin, yTitle);
    yTitle += titleLineHeight;
  }

  setBodyFont(doc, active, 10);
  let yMeta = headerBarH + 12;
  doc.setTextColor(55, 65, 81);

  if (params.trip.destination) {
    setBodyFont(doc, active, 11);
    doc.text(params.trip.destination, margin, yMeta);
    yMeta += lineH;
  }
  setBodyFont(doc, active, 11);
  doc.text(`${params.trip.start_date} ~ ${params.trip.end_date}`, margin, yMeta);
  yMeta += lineH + 8;

  setBodyFont(doc, active, 9);
  doc.setTextColor(100, 116, 139);
  doc.text(params.pdfLabels.coverKicker, margin, yMeta);
  doc.setTextColor(55, 65, 81);

  if (params.expenseSummaryLines && params.expenseSummaryLines.length > 0) {
    yMeta += lineH + 4;
    setBodyFont(doc, active, 9);
    doc.setTextColor(71, 85, 105);
    for (const line of params.expenseSummaryLines) {
      const sub = doc.splitTextToSize(line, contentW);
      for (const sl of sub) {
        yMeta = ensurePageSpace(doc, yMeta, lineH + 2, margin, active);
        doc.text(sl, margin, yMeta);
        yMeta += lineH - 1;
      }
      yMeta += 2;
    }
    doc.setTextColor(55, 65, 81);
  }

  if (params.items.length === 0) {
    setBodyFont(doc, active, 10);
    yMeta = ensurePageSpace(doc, yMeta, lineH + 8, margin, active);
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

  doc.addPage();
  restoreDefaultBodyStyle(doc, active);
  let y = margin;

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(margin, y - 5, ACCENT_BAR_W, 10, 'F');
  setHeadingFont(doc, active, 14);
  doc.setTextColor(30, 41, 59);
  doc.text(params.pdfLabels.overviewTitle, margin + ACCENT_BAR_W + 6, y);
  y += lineH + 10;
  setBodyFont(doc, active, 9);
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

    y = ensurePageSpace(doc, y, summaryLine.length * (lineH + 1) + 8, margin, active);

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageW - margin * 2, summaryLine.length * (lineH - 1) + 10, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y - 4, pageW - margin * 2, summaryLine.length * (lineH - 1) + 10, 'S');

    doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
    doc.rect(margin, y - 4, ACCENT_BAR_W, summaryLine.length * (lineH - 1) + 10, 'F');

    setBodyFont(doc, active, 9);
    doc.setTextColor(51, 65, 85);
    let rowY = y;
    for (const ln of summaryLine) {
      doc.text(ln, margin + ACCENT_BAR_W + 5, rowY);
      rowY += lineH - 0.5;
    }
    y = rowY + lineH + 2;
  }

  doc.setTextColor(55, 65, 81);

  doc.addPage();
  restoreDefaultBodyStyle(doc, active);
  y = margin;

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(margin, y - 5, ACCENT_BAR_W, 10, 'F');
  setHeadingFont(doc, active, 14);
  doc.setTextColor(30, 41, 59);
  doc.text(params.pdfLabels.detailsTitle, margin + ACCENT_BAR_W + 6, y);
  y += lineH + 12;

  for (let idx = 0; idx < days.length; idx++) {
    y = ensurePageSpace(doc, y, lineH + 20, margin, active);
    const day = days[idx]!;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pageW - margin, y - 4);
    setHeadingFont(doc, active, 13);
    doc.setTextColor(30, 41, 59);
    doc.text(`Day ${idx + 1}  ·  ${day}`, margin, y);
    y += lineH + 4;
    doc.setTextColor(55, 65, 81);
    setBodyFont(doc, active, 10);

    for (const i of byDay.get(day)!) {
      y = ensurePageSpace(doc, y, lineH + 8, margin, active);
      const label = params.getTypeLabel(i.type, i.transport_type);
      const timeStr =
        i.start_time || i.end_time ? `  ${i.start_time || '--'} ~ ${i.end_time || '--'}` : '';
      const pdfTitle = shortItineraryTitle(i.type, i.title, i.address);
      doc.text(`[${label}] ${pdfTitle}${timeStr}`, margin, y);
      y += lineH;
      if (i.description && i.description.trim()) {
        const lines = doc.splitTextToSize(i.description.trim(), pageW - margin * 2 - 8);
        setBodyFont(doc, active, 9);
        for (const line of lines) {
          y = ensurePageSpace(doc, y, 6, margin, active);
          doc.text(line, margin + 6, y);
          y += 5;
        }
        setBodyFont(doc, active, 10);
        y += 2;
      }
      y += 2;
    }
    y += 6;
  }

  doc.save(`itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
}
