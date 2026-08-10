import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Browser } from 'puppeteer-core';

/** Keep in sync with @sparticuz/chromium-min package version. */
const CHROMIUM_PACK_VERSION = '149.0.0';

const FONT_FAMILY = 'ItineraryDocSans';
const FONT_FACES: Array<{ weight: number; fileName: string }> = [
  { weight: 400, fileName: 'noto-sans-kr-korean-400-normal.woff2' },
  { weight: 700, fileName: 'noto-sans-kr-korean-700-normal.woff2' },
];

let cachedEmbeddedFontCss: string | null = null;

function isVercelRuntime(): boolean {
  // AWS_REGION alone is often set for S3 locally — do NOT treat as serverless Chromium.
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true';
}

function chromiumPackUrl(): string {
  if (process.env.CHROMIUM_PACK_URL?.trim()) {
    return process.env.CHROMIUM_PACK_URL.trim();
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_PACK_VERSION}/chromium-v${CHROMIUM_PACK_VERSION}-pack.${arch}.tar`;
}

function localChromeCandidates(): string[] {
  const fromEnv = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  const defaults = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  return [...fromEnv, ...defaults].filter((p) => existsSync(p));
}

function resolveFontPath(fileName: string): string {
  const candidates = [
    join(process.cwd(), 'lib', 'modules', 'travel-planner', 'fonts', fileName),
    join(__dirname, 'fonts', fileName),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(`Itinerary PDF font missing: ${fileName}`);
}

/** Embed bundled Korean subset fonts — no CDN (Vercel Chromium has no CJK system fonts). */
function buildEmbeddedKoreanFontCss(): string {
  if (cachedEmbeddedFontCss) return cachedEmbeddedFontCss;

  const parts = FONT_FACES.map((face) => {
    const buf = readFileSync(resolveFontPath(face.fileName));
    const b64 = buf.toString('base64');
    return `@font-face {
  font-family: "${FONT_FAMILY}";
  font-style: normal;
  font-weight: ${face.weight};
  font-display: block;
  src: url("data:font/woff2;base64,${b64}") format("woff2");
}`;
  });

  cachedEmbeddedFontCss = parts.join('\n');
  return cachedEmbeddedFontCss;
}

function injectEmbeddedFonts(html: string, fontCss: string): string {
  if (html.includes('/*__ITIN_EMBEDDED_FONTS__*/')) {
    return html.replace('/*__ITIN_EMBEDDED_FONTS__*/', fontCss);
  }
  return html.replace('<style>', `<style>\n${fontCss}\n`);
}

export async function renderHtmlToPdfBuffer(html: string): Promise<Uint8Array> {
  let browser: Browser | null = null;
  try {
    // Sync local read — avoids CDN timeout that can fail the whole Vercel function
    const htmlWithFonts = injectEmbeddedFonts(html, buildEmbeddedKoreanFontCss());
    const puppeteer = await import('puppeteer-core');

    if (isVercelRuntime()) {
      // Full @sparticuz/chromium often exceeds Vercel function size / NFT tracing.
      // Official approach: chromium-min + remote pack extracted to /tmp at runtime.
      const chromium = (await import('@sparticuz/chromium-min')).default;
      chromium.setGraphicsMode = false;
      const executablePath = await chromium.executablePath(chromiumPackUrl());
      const args = await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' });
      browser = await puppeteer.launch({
        args,
        defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 1 },
        executablePath,
        headless: 'shell',
      });
    } else {
      const candidates = localChromeCandidates();
      let lastErr: unknown;
      for (const executablePath of candidates) {
        try {
          browser = await puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
          });
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!browser) {
        throw lastErr ?? new Error(
          'Chrome/Edge executable not found for PDF render. Install Chrome or set PUPPETEER_EXECUTABLE_PATH.',
        );
      }
    }

    const page = await browser.newPage();
    await page.setContent(htmlWithFonts, { waitUntil: 'load', timeout: 45000 });
    await page
      .evaluate(async () => {
        await document.fonts.ready;
        await document.fonts.load('400 16px ItineraryDocSans');
        await document.fonts.load('700 16px ItineraryDocSans');
      })
      .catch(() => undefined);
    // Give remote images (cover / static map) a short settle window
    await new Promise((r) => setTimeout(r, 500));
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    return pdf;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
