/**
 * 여행 일정 PDF (pdf-lib + fontkit). 클라이언트 전용 — 인증/API/DB와 무관.
 * 모바일 Chrome 등에서 jsPDF CID 폰트가 글자 없이 보이는 경우가 있어 pdf-lib 임베딩으로 생성한다.
 */
import type { LangCode } from '@/lib/language-fonts';
import { enumerateTripDays } from './itinerary-display-expand';
import { shortItineraryTitle } from './short-itinerary-title';
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';

const MM_TO_PT = 72 / 25.4;
const A4_W_MM = 210;
const A4_H_MM = 297;

type PdfFontModule = 'kr' | 'jp' | 'sc' | 'tc' | 'latin';

const NOTO_CJK_BASE =
  'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF';
const NOTO_CJK_RAW = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF';

const FONT_SPECS: Record<
  Exclude<PdfFontModule, 'latin'>,
  { dir: 'KR' | 'JP' | 'SC' | 'TC'; file: string }
> = {
  kr: { dir: 'KR', file: 'NotoSansKR-Regular.otf' },
  jp: { dir: 'JP', file: 'NotoSansJP-Regular.otf' },
  sc: { dir: 'SC', file: 'NotoSansSC-Regular.otf' },
  tc: { dir: 'TC', file: 'NotoSansTC-Regular.otf' },
};

const ACCENT_BAR_W_MM = 3;

function rgb255(r: number, g: number, b: number) {
  return rgb(r / 255, g / 255, b / 255);
}

let cachedBytes: Partial<Record<Exclude<PdfFontModule, 'latin'>, Uint8Array | null>> = {};

/** CDN이 HTML 에러 페이지를 주는 경우 폰트로 오인하지 않음 */
function looksLikeBinaryOpenType(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const [a0, a1, a2, a3] = [bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!];
  /** OTTO = CFF OTF */
  if (a0 === 0x4f && a1 === 0x54 && a2 === 0x54 && a3 === 0x4f) return true;
  /** true — classic TrueType */
  if (a0 === 0x74 && a1 === 0x72 && a2 === 0x75 && a3 === 0x65) return true;
  if (a0 === 0x00 && a1 === 0x01 && a2 === 0x00 && a3 === 0x00) return true;
  /** HTML 에러 페이지 */
  if (a0 === 0x3c && (a1 === 0x21 || a1 === 0x68)) return false;
  return false;
}

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
  /** 기간 밖 일정 섹션 제목 */
  outsideTripSectionTitle?: string;
};

type FontPair = { body: PDFFont; heading: PDFFont };

function mm(n: number): number {
  return n * MM_TO_PT;
}

/** y는 위에서 아래(mm), 텍스트 y는 베이스라인 근처 */
function baselineY(pageHPt: number, yFromTopMm: number): number {
  return pageHPt - mm(yFromTopMm);
}

function mmRectTopLeft(pageHPt: number, xMm: number, yTopMm: number, wMm: number, hMm: number) {
  return {
    x: mm(xMm),
    y: pageHPt - mm(yTopMm + hMm),
    width: mm(wMm),
    height: mm(hMm),
  };
}

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

async function fetchNotoBytes(module: Exclude<PdfFontModule, 'latin'>): Promise<Uint8Array | null> {
  const hit = cachedBytes[module];
  if (hit !== undefined) {
    if (hit !== null && looksLikeBinaryOpenType(hit)) return hit;
    delete cachedBytes[module];
  }

  const spec = FONT_SPECS[module];
  const urls: string[] = [];
  if (typeof window !== 'undefined') {
    urls.push(`${window.location.origin}/fonts/${spec.file}`);
  }
  urls.push(`${NOTO_CJK_BASE}/${spec.dir}/${spec.file}`, `${NOTO_CJK_RAW}/${spec.dir}/${spec.file}`);

  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      const bytes = new Uint8Array(buf);
      if (!looksLikeBinaryOpenType(bytes)) continue;
      cachedBytes[module] = bytes;
      return bytes;
    } catch {
      /* next */
    }
  }
  cachedBytes[module] = null;
  return null;
}

/** 너비 기준 줄바꿈 (공백 우선, CJK/Glyph는 문자 단위) */
function wrapToWidth(text: string, maxWidthPt: number, font: PDFFont, size: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    if (!para) {
      out.push('');
      continue;
    }
    let rest = para;
    while (rest.length > 0) {
      if (font.widthOfTextAtSize(rest, size) <= maxWidthPt) {
        out.push(rest);
        break;
      }
      let lo = 0;
      let hi = rest.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const slice = rest.slice(0, mid);
        if (font.widthOfTextAtSize(slice, size) <= maxWidthPt) lo = mid;
        else hi = mid - 1;
      }
      let breakPos = lo;
      if (breakPos === 0) breakPos = 1;
      else {
        const head = rest.slice(0, breakPos);
        const sp = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\t'));
        if (sp > 0 && sp >= breakPos - 8) breakPos = sp + 1;
      }
      out.push(rest.slice(0, breakPos).trimEnd());
      rest = rest.slice(breakPos).trimStart();
      if (!rest.length) break;
    }
  }
  return out;
}

async function embedFontPair(pdfDoc: PDFDocument, mod: PdfFontModule): Promise<FontPair> {
  if (mod === 'latin') {
    const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const heading = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { body, heading };
  }
  const fontkitMod = await import('@pdf-lib/fontkit');
  pdfDoc.registerFontkit(fontkitMod.default);

  const bytes = await fetchNotoBytes(mod);
  if (!bytes) {
    throw new Error('[itinerary-pdf] Noto font fetch failed — cannot fallback to Helvetica for CJK text');
  }
  /**
   * SubsetOTF에 pdf-lib subset을 겹치면 CID/ToUnicode가 깨져 글자가 기호처럼 보일 수 있음.
   */
  try {
    const embedded = await pdfDoc.embedFont(bytes, { subset: false });
    return { body: embedded, heading: embedded };
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[itinerary-pdf] Noto embed failed:', e);
    }
    throw new Error('[itinerary-pdf] Noto font embed failed');
  }
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\u3131-\uD7A3]/g, '-');
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type DrawState = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  pageWPt: number;
  pageHPt: number;
  marginMm: number;
  fonts: FontPair;
};

function ensurePageSpace(state: DrawState, yMm: number, neededMm: number): number {
  const { pageHPt, marginMm } = state;
  if (yMm + neededMm > A4_H_MM - marginMm) {
    state.page = state.pdfDoc.addPage([state.pageWPt, pageHPt]);
    return marginMm;
  }
  return yMm;
}

/**
 * 일정 PDF 생성 후 브라우저 저장 대화상자.
 */
export async function buildAndSaveTravelItineraryPdf(params: {
  lang: LangCode;
  trip: ItineraryPdfTrip;
  items: ItineraryPdfItem[];
  getTypeLabel: (type: ItineraryPdfItem['type'], transport_type?: ItineraryPdfItem['transport_type']) => string;
  emptyItineraryMessage: string;
  pdfLabels: ItineraryPdfLabels;
  expenseSummaryLines?: string[];
  /** 여행 일차 헤더(1 = 출발일). 앱 로캘·번역 형식 통일용 */
  formatScheduleDayHeading: (dayNum1Based: number, isoYmd: string) => string;
  /** 기간 외 일(선택): 날짜 줄 전체 */
  formatOutsideDayHeading?: (isoYmd: string) => string;
}): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const pageWPt = mm(A4_W_MM);
  const pageHPt = mm(A4_H_MM);
  const marginMm = 20;
  const contentWPt = pageWPt - mm(marginMm * 2);
  const lineHmm = 6;

  const mod = resolvePdfFontModule(params.lang, collectContentBlobForFontHint(params));
  const fonts = await embedFontPair(pdfDoc, mod);

  let page = pdfDoc.addPage([pageWPt, pageHPt]);
  const state: DrawState = { pdfDoc, page, pageWPt, pageHPt, marginMm, fonts };

  const titleLines = wrapToWidth(params.trip.title, contentWPt, fonts.heading, 20);
  const titleLineHmm = lineHmm + 2;
  const headerBarHmm = Math.max(44, 26 + titleLines.length * titleLineHmm + 12);

  const headerR = mmRectTopLeft(pageHPt, 0, 0, A4_W_MM, headerBarHmm);
  state.page.drawRectangle({ ...headerR, color: rgb255(79, 70, 229) });

  let yTitle = 26;
  for (const line of titleLines) {
    state.page.drawText(line, {
      x: mm(marginMm),
      y: baselineY(pageHPt, yTitle),
      size: 20,
      font: fonts.heading,
      color: rgb255(255, 255, 255),
    });
    yTitle += titleLineHmm;
  }

  let yMeta = headerBarHmm + 12;

  if (params.trip.destination) {
    state.page.drawText(params.trip.destination, {
      x: mm(marginMm),
      y: baselineY(pageHPt, yMeta),
      size: 11,
      font: fonts.body,
      color: rgb255(55, 65, 81),
    });
    yMeta += lineHmm;
  }
  state.page.drawText(`${params.trip.start_date} ~ ${params.trip.end_date}`, {
    x: mm(marginMm),
    y: baselineY(pageHPt, yMeta),
    size: 11,
    font: fonts.body,
    color: rgb255(55, 65, 81),
  });
  yMeta += lineHmm + 8;

  state.page.drawText(params.pdfLabels.coverKicker, {
    x: mm(marginMm),
    y: baselineY(pageHPt, yMeta),
    size: 9,
    font: fonts.body,
    color: rgb255(100, 116, 139),
  });
  yMeta += lineHmm;
  yMeta += 8;

  if (params.expenseSummaryLines && params.expenseSummaryLines.length > 0) {
    yMeta += lineHmm + 4;
    for (const line of params.expenseSummaryLines) {
      const sub = wrapToWidth(line, contentWPt, fonts.body, 9);
      for (const sl of sub) {
        yMeta = ensurePageSpace(state, yMeta, lineHmm + 2);
        state.page.drawText(sl, {
          x: mm(marginMm),
          y: baselineY(pageHPt, yMeta),
          size: 9,
          font: fonts.body,
          color: rgb255(71, 85, 105),
        });
        yMeta += lineHmm - 1;
      }
      yMeta += 2;
    }
  }

  if (params.items.length === 0) {
    yMeta = ensurePageSpace(state, yMeta, lineHmm + 8);
    state.page.drawText(params.emptyItineraryMessage, {
      x: mm(marginMm),
      y: baselineY(pageHPt, yMeta + 6),
      size: 10,
      font: fonts.body,
      color: rgb255(55, 65, 81),
    });
    triggerDownload(await pdfDoc.save(), `itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
    return;
  }

  const byDay = new Map<string, ItineraryPdfItem[]>();
  for (const i of params.items) {
    const day = i.day_date || '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  }

  const tripDays = enumerateTripDays(params.trip.start_date, params.trip.end_date);
  const tripDaySet = new Set(tripDays);
  const extraDays = [...byDay.keys()].filter((d) => !tripDaySet.has(d)).sort();

  state.page = pdfDoc.addPage([pageWPt, pageHPt]);
  let y = marginMm;

  const ovBar = mmRectTopLeft(pageHPt, marginMm, y - 5, ACCENT_BAR_W_MM, 10);
  state.page.drawRectangle({ ...ovBar, color: rgb255(79, 70, 229) });
  state.page.drawText(params.pdfLabels.overviewTitle, {
    x: mm(marginMm + ACCENT_BAR_W_MM + 6),
    y: baselineY(pageHPt, y),
    size: 14,
    font: fonts.heading,
    color: rgb255(30, 41, 59),
  });
  y += lineHmm + 10;

  const summaryMaxW = contentWPt - mm(ACCENT_BAR_W_MM + 8);

  for (let idx = 0; idx < tripDays.length; idx++) {
    const day = tripDays[idx]!;
    const dayNum = idx + 1;
    const dayItems = byDay.get(day) ?? [];
    const count = dayItems.length;
    const previewParts = dayItems.slice(0, 2).map((it) => shortItineraryTitle(it.type, it.title, it.address));
    const more = count > 2 ? ` (+${count - 2})` : '';
    const summaryCore = count === 0 ? '—' : `${previewParts.join(' · ')}${more}`;
    const summaryText = `${params.formatScheduleDayHeading(dayNum, day)} · ${params.pdfLabels.placesCount(count)} — ${summaryCore}`;
    const summaryLine = wrapToWidth(summaryText, summaryMaxW, fonts.body, 9);

    y = ensurePageSpace(state, y, summaryLine.length * (lineHmm + 1) + 8);

    const rowHmm = summaryLine.length * (lineHmm - 1) + 10;
    const bgR = mmRectTopLeft(pageHPt, marginMm, y - 4, A4_W_MM - marginMm * 2, rowHmm);
    state.page.drawRectangle({
      ...bgR,
      color: rgb255(241, 245, 249),
      borderColor: rgb255(226, 232, 240),
      borderWidth: 0.5,
    });
    const accR = mmRectTopLeft(pageHPt, marginMm, y - 4, ACCENT_BAR_W_MM, rowHmm);
    state.page.drawRectangle({ ...accR, color: rgb255(79, 70, 229) });

    let rowY = y;
    for (const ln of summaryLine) {
      state.page.drawText(ln, {
        x: mm(marginMm + ACCENT_BAR_W_MM + 5),
        y: baselineY(pageHPt, rowY),
        size: 9,
        font: fonts.body,
        color: rgb255(51, 65, 85),
      });
      rowY += lineHmm - 0.5;
    }
    y = rowY + lineHmm + 2;
  }

  for (let ex = 0; ex < extraDays.length; ex++) {
    const day = extraDays[ex]!;
    const dayItems = byDay.get(day)!;
    const count = dayItems.length;
    const previewParts = dayItems.slice(0, 2).map((it) => shortItineraryTitle(it.type, it.title, it.address));
    const more = count > 2 ? ` (+${count - 2})` : '';
    const head =
      params.formatOutsideDayHeading?.(day) ?? `${params.pdfLabels.outsideTripSectionTitle ?? ''} · ${day}`.trim();
    const summaryCore = `${previewParts.join(' · ')}${more}`;
    const summaryText = `${head} · ${params.pdfLabels.placesCount(count)} — ${summaryCore}`;
    const summaryLine = wrapToWidth(summaryText, summaryMaxW, fonts.body, 9);

    y = ensurePageSpace(state, y, summaryLine.length * (lineHmm + 1) + 8);

    const rowHmm = summaryLine.length * (lineHmm - 1) + 10;
    const bgR = mmRectTopLeft(pageHPt, marginMm, y - 4, A4_W_MM - marginMm * 2, rowHmm);
    state.page.drawRectangle({
      ...bgR,
      color: rgb255(241, 245, 249),
      borderColor: rgb255(226, 232, 240),
      borderWidth: 0.5,
    });
    const accR = mmRectTopLeft(pageHPt, marginMm, y - 4, ACCENT_BAR_W_MM, rowHmm);
    state.page.drawRectangle({ ...accR, color: rgb255(251, 191, 36) });

    let rowY = y;
    for (const ln of summaryLine) {
      state.page.drawText(ln, {
        x: mm(marginMm + ACCENT_BAR_W_MM + 5),
        y: baselineY(pageHPt, rowY),
        size: 9,
        font: fonts.body,
        color: rgb255(51, 65, 85),
      });
      rowY += lineHmm - 0.5;
    }
    y = rowY + lineHmm + 2;
  }

  state.page = pdfDoc.addPage([pageWPt, pageHPt]);
  y = marginMm;

  const detBar = mmRectTopLeft(pageHPt, marginMm, y - 5, ACCENT_BAR_W_MM, 10);
  state.page.drawRectangle({ ...detBar, color: rgb255(79, 70, 229) });
  state.page.drawText(params.pdfLabels.detailsTitle, {
    x: mm(marginMm + ACCENT_BAR_W_MM + 6),
    y: baselineY(pageHPt, y),
    size: 14,
    font: fonts.heading,
    color: rgb255(30, 41, 59),
  });
  y += lineHmm + 12;

  for (let idx = 0; idx < tripDays.length; idx++) {
    y = ensurePageSpace(state, y, lineHmm + 20);
    const day = tripDays[idx]!;
    const dayNum = idx + 1;
    state.page.drawLine({
      start: { x: mm(marginMm), y: baselineY(pageHPt, y - 4) },
      end: { x: pageWPt - mm(marginMm), y: baselineY(pageHPt, y - 4) },
      thickness: 0.3,
      color: rgb255(220, 220, 220),
    });
    state.page.drawText(params.formatScheduleDayHeading(dayNum, day), {
      x: mm(marginMm),
      y: baselineY(pageHPt, y),
      size: 13,
      font: fonts.heading,
      color: rgb255(30, 41, 59),
    });
    y += lineHmm + 4;

    for (const i of byDay.get(day) ?? []) {
      y = ensurePageSpace(state, y, lineHmm + 8);
      const label = params.getTypeLabel(i.type, i.transport_type);
      const timeStr =
        i.start_time || i.end_time ? `  ${i.start_time || '--'} ~ ${i.end_time || '--'}` : '';
      const pdfTitle = shortItineraryTitle(i.type, i.title, i.address);
      state.page.drawText(`[${label}] ${pdfTitle}${timeStr}`, {
        x: mm(marginMm),
        y: baselineY(pageHPt, y),
        size: 10,
        font: fonts.body,
        color: rgb255(55, 65, 81),
      });
      y += lineHmm;
      if (i.description && i.description.trim()) {
        const lines = wrapToWidth(i.description.trim(), pageWPt - mm(marginMm * 2 + 8), fonts.body, 9);
        for (const line of lines) {
          y = ensurePageSpace(state, y, 6);
          state.page.drawText(line, {
            x: mm(marginMm + 6),
            y: baselineY(pageHPt, y),
            size: 9,
            font: fonts.body,
            color: rgb255(55, 65, 81),
          });
          y += 5;
        }
        y += 2;
      }
      y += 2;
    }
    y += 6;
  }

  if (extraDays.length > 0 && params.pdfLabels.outsideTripSectionTitle) {
    y = ensurePageSpace(state, y, lineHmm + 20);
    state.page.drawText(params.pdfLabels.outsideTripSectionTitle, {
      x: mm(marginMm),
      y: baselineY(pageHPt, y),
      size: 14,
      font: fonts.heading,
      color: rgb255(30, 41, 59),
    });
    y += lineHmm + 8;

    for (const day of extraDays) {
      y = ensurePageSpace(state, y, lineHmm + 20);
      state.page.drawLine({
        start: { x: mm(marginMm), y: baselineY(pageHPt, y - 4) },
        end: { x: pageWPt - mm(marginMm), y: baselineY(pageHPt, y - 4) },
        thickness: 0.3,
        color: rgb255(220, 220, 220),
      });
      state.page.drawText(params.formatOutsideDayHeading?.(day) ?? `${day}`, {
        x: mm(marginMm),
        y: baselineY(pageHPt, y),
        size: 13,
        font: fonts.heading,
        color: rgb255(30, 41, 59),
      });
      y += lineHmm + 4;

      for (const i of byDay.get(day) ?? []) {
        y = ensurePageSpace(state, y, lineHmm + 8);
        const label = params.getTypeLabel(i.type, i.transport_type);
        const timeStr =
          i.start_time || i.end_time ? `  ${i.start_time || '--'} ~ ${i.end_time || '--'}` : '';
        const pdfTitle = shortItineraryTitle(i.type, i.title, i.address);
        state.page.drawText(`[${label}] ${pdfTitle}${timeStr}`, {
          x: mm(marginMm),
          y: baselineY(pageHPt, y),
          size: 10,
          font: fonts.body,
          color: rgb255(55, 65, 81),
        });
        y += lineHmm;
        if (i.description && i.description.trim()) {
          const lines = wrapToWidth(i.description.trim(), pageWPt - mm(marginMm * 2 + 8), fonts.body, 9);
          for (const line of lines) {
            y = ensurePageSpace(state, y, 6);
            state.page.drawText(line, {
              x: mm(marginMm + 6),
              y: baselineY(pageHPt, y),
              size: 9,
              font: fonts.body,
              color: rgb255(55, 65, 81),
            });
            y += 5;
          }
          y += 2;
        }
        y += 2;
      }
      y += 6;
    }
  }

  triggerDownload(await pdfDoc.save(), `itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
}
