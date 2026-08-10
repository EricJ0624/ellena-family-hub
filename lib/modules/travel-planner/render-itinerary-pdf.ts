import { existsSync } from 'fs';
import type { Browser } from 'puppeteer-core';

function isVercelRuntime(): boolean {
  // AWS_REGION alone is often set for S3 locally — do NOT treat as serverless Chromium.
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true';
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

export async function renderHtmlToPdfBuffer(html: string): Promise<Uint8Array> {
  let browser: Browser | null = null;
  try {
    const puppeteer = await import('puppeteer-core');

    if (isVercelRuntime()) {
      const chromium = (await import('@sparticuz/chromium')).default;
      // @sparticuz/chromium v133+ / v149: headless "shell" + await defaultArgs()
      const executablePath = await chromium.executablePath();
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
    // Prefer 'load' over networkidle0 — CDN fonts/images can keep connections open and time out on Vercel
    await page.setContent(html, { waitUntil: 'load', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
    // Give remote images (cover / static map) a short settle window
    await new Promise((r) => setTimeout(r, 800));
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
