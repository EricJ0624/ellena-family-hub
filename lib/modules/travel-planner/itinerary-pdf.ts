/**
 * 여행 일정 PDF (jsPDF). 클라이언트 전용 — 인증/API/DB와 무관.
 * 한글: Noto Sans KR subset OTF를 VFS에 넣어 Identity-H로 출력. 실패 시 Helvetica 유지.
 */
import type { jsPDF } from 'jspdf';
import { shortItineraryTitle } from './short-itinerary-title';

const VFS_FONT_FILE = 'NotoSansKR-Regular.otf';
const FONT_FAMILY = 'NotoSansKR';

/** 인디고 계열 (Tailwind indigo-600 근사) */
const BRAND_R = 79;
const BRAND_G = 70;
const BRAND_B = 229;

let cachedFontBase64: string | null = null;

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

async function fetchFontBase64(): Promise<string | null> {
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

function tryRegisterNotoSansKr(doc: jsPDF): boolean {
  try {
    if (!cachedFontBase64) return false;
    doc.addFileToVFS(VFS_FONT_FILE, cachedFontBase64);
    doc.addFont(VFS_FONT_FILE, FONT_FAMILY, 'normal', 'Identity-H');
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[itinerary-pdf] Noto Sans KR 등록 실패, Helvetica 사용:', e);
    }
    cachedFontBase64 = null;
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

function setHeadingFont(doc: jsPDF, hasKo: boolean, size: number) {
  doc.setFontSize(size);
  if (hasKo) {
    doc.setFont(FONT_FAMILY, 'normal');
  } else {
    doc.setFont('helvetica', 'bold');
  }
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\u3131-\uD7A3]/g, '-');
}

/**
 * 일정 PDF 생성 후 브라우저 저장 대화상자.
 */
export async function buildAndSaveTravelItineraryPdf(params: {
  trip: ItineraryPdfTrip;
  items: ItineraryPdfItem[];
  getTypeLabel: (type: ItineraryPdfItem['type'], transport_type?: ItineraryPdfItem['transport_type']) => string;
  emptyItineraryMessage: string;
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const lineH = 6;

  const base64 = await fetchFontBase64();
  const hasKo = Boolean(base64 && tryRegisterNotoSansKr(doc));

  if (!hasKo && process.env.NODE_ENV === 'development') {
    console.warn('[itinerary-pdf] 한글 폰트를 불러오지 못했습니다. Helvetica로 저장됩니다.');
  }

  setHeadingFont(doc, hasKo, 20);
  const titleLines = doc.splitTextToSize(params.trip.title, pageW - margin * 2);
  const titleLineHeight = lineH + 2;
  const headerBarH = Math.max(44, 26 + titleLines.length * titleLineHeight + 12);

  doc.setFillColor(BRAND_R, BRAND_G, BRAND_B);
  doc.rect(0, 0, pageW, headerBarH, 'F');

  doc.setTextColor(255, 255, 255);
  setHeadingFont(doc, hasKo, 20);
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
  doc.text('ITINERARY', margin, yMeta);
  doc.setTextColor(55, 65, 81);

  if (params.items.length === 0) {
    setBodyFont(doc, hasKo, 10);
    doc.text(params.emptyItineraryMessage, margin, yMeta + 10);
    doc.save(`itinerary-${sanitizeFilename(params.trip.title)}.pdf`);
    return;
  }

  doc.addPage();
  let y = 20;

  const byDay = new Map<string, ItineraryPdfItem[]>();
  for (const i of params.items) {
    const day = i.day_date || '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  }
  const days = Array.from(byDay.keys()).sort();

  for (let idx = 0; idx < days.length; idx++) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    const day = days[idx];
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pageW - margin, y - 4);
    setHeadingFont(doc, hasKo, 13);
    doc.setTextColor(30, 41, 59);
    doc.text(`Day ${idx + 1}  ·  ${day}`, margin, y);
    y += lineH + 4;
    doc.setTextColor(55, 65, 81);
    setBodyFont(doc, hasKo, 10);

    for (const i of byDay.get(day)!) {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
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
          if (y > 272) {
            doc.addPage();
            y = 20;
          }
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
