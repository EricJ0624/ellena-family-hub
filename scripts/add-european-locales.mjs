/**
 * One-off: insert es/fr/de/it blocks into lib/translations/*.ts from en + JSON overlays.
 * Run: node scripts/add-european-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const translationsDir = path.join(root, 'lib', 'translations');
const overlayPath = path.join(__dirname, 'eu-locale-overlays.json');
const euByEnPath = path.join(__dirname, 'eu-by-en.json');

const NEW_LANGS = ['es', 'fr', 'de', 'it'];

function extractLangBlock(source, langKey) {
  const marker =
    langKey === 'zh-CN' || langKey === 'zh-TW'
      ? `\n  '${langKey}': {`
      : `\n  ${langKey}: {`;
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const braceStart = source.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { start: braceStart, end: i + 1, text: source.slice(braceStart, i + 1) };
      }
    }
  }
  return null;
}

function parseObjectLiteral(objText) {
  try {
    return /** @type {Record<string, string>} */ (Function(`"use strict"; return (${objText});`)());
  } catch {
    /** @type {Record<string, string>} */
    const out = {};
    const re = /(\w+):\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g;
    let m;
    while ((m = re.exec(objText))) {
      const key = m[1];
      const raw = m[2];
      try {
        out[key] = Function(`"use strict"; return (${raw});`)();
      } catch {
        out[key] = raw.slice(1, -1);
      }
    }
    return out;
  }
}

function serializeObjectLiteral(entries) {
  const lines = Object.entries(entries).map(([k, v]) => {
    if (k === 'audit_headers' && String(v).startsWith('[')) {
      return `    ${k}: ${v},`;
    }
    const escaped = String(v)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    return `    ${k}: '${escaped}',`;
  });
  return `{\n${lines.join('\n')}\n  }`;
}

function buildLocaleBlock(enEntries, locale, fileBase, overlays, euByEn, enBlockText) {
  /** @type {Record<string, string>} */
  const block = {};
  const fileOverlay = overlays?.[fileBase]?.[locale] ?? {};
  for (const [key, enVal] of Object.entries(enEntries)) {
    block[key] =
      fileOverlay[key] ??
      overlays?.['*']?.[locale]?.[key] ??
      euByEn?.[enVal]?.[locale] ??
      overlays?.['*']?.[locale]?.[enVal] ??
      enVal;
  }
  if (fileBase === 'admin' && enBlockText.includes('audit_headers:')) {
    const m = enBlockText.match(/audit_headers:\s*(\[[^\]]+\])/);
    if (m) block.audit_headers = m[1];
  }
  return block;
}

function insertLocales(filePath, overlays) {
  const base = path.basename(filePath, '.ts');
  let source = fs.readFileSync(filePath, 'utf8');

function hasLangBlock(source, lang) {
  const marker = lang === 'zh-CN' || lang === 'zh-TW' ? `'${lang}':` : `${lang}:`;
  return source.includes(`\n  ${marker} {`);
}

  const enBlock = extractLangBlock(source, 'en');
  if (!enBlock) {
    console.warn(`skip (no en block): ${base}`);
    return;
  }

  const enEntries = parseObjectLiteral(enBlock.text);
  if (!Object.keys(enEntries).length) {
    console.warn(`skip (empty en): ${base}`);
    return;
  }

  const zhTwBlock = extractLangBlock(source, 'zh-TW');
  if (!zhTwBlock) {
    console.warn(`skip (no zh-TW anchor): ${base}`);
    return;
  }

  const insertAt = source.lastIndexOf('\n};');
  if (insertAt === -1) {
    console.warn(`skip (no closing };): ${base}`);
    return;
  }
  let insertion = '';
  for (const lang of NEW_LANGS) {
    if (hasLangBlock(source, lang)) continue;
    const block = buildLocaleBlock(enEntries, lang, base, overlays, euByEn, enBlock.text);
    insertion += (insertion ? ',\n' : '\n') + `  ${lang}: ${serializeObjectLiteral(block)}`;
  }

  if (!insertion) {
    console.log(`already has EU locales: ${base}`);
    return;
  }

  const next = source.slice(0, insertAt) + insertion + source.slice(insertAt);
  fs.writeFileSync(filePath, next, 'utf8');
  console.log(`updated: ${base} (+${NEW_LANGS.filter((l) => !hasLangBlock(source, l)).length} locales, ${Object.keys(enEntries).length} keys each)`);
}

const overlays = fs.existsSync(overlayPath)
  ? JSON.parse(fs.readFileSync(overlayPath, 'utf8'))
  : {};
const euByEn = fs.existsSync(euByEnPath)
  ? JSON.parse(fs.readFileSync(euByEnPath, 'utf8'))
  : {};

for (const name of fs.readdirSync(translationsDir)) {
  if (!name.endsWith('.ts')) continue;
  insertLocales(path.join(translationsDir, name), overlays);
}

console.log('done');
