import type { Browser } from 'puppeteer-core';

export async function renderHtmlToPdfBuffer(html: string): Promise<Uint8Array> {
  const isServerless = Boolean(process.env.AWS_REGION || process.env.VERCEL);

  let browser: Browser | null = null;
  try {
    if (isServerless) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = await import('puppeteer-core');
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 1 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // 로컬: puppeteer-core + 시스템 Chrome, 없으면 전체 puppeteer 시도
      const puppeteer = await import('puppeteer-core');
      const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
        'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ].filter(Boolean) as string[];

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
        throw lastErr ?? new Error('Chrome executable not found for PDF render');
      }
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
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
