import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const travelPath = path.join(__dirname, '..', 'lib', 'translations', 'travel.ts');
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, '_travel-ui-keys.json'), 'utf8'));

const NEW_KEYS = Object.keys(keys);
const LANG_MARKERS = [
  ['ko', '\n  ko: {'],
  ['en', '\n  en: {'],
  ['ja', '\n  ja: {'],
  ['zh-CN', "\n  'zh-CN': {"],
  ['zh-TW', "\n  'zh-TW': {"],
  ['es', '\n  es: {'],
  ['fr', '\n  fr: {'],
  ['de', '\n  de: {'],
  ['it', '\n  it: {'],
];

function extractBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return { start: braceStart, end: i + 1, text: source.slice(braceStart, i + 1) };
    }
  }
  return null;
}

let source = fs.readFileSync(travelPath, 'utf8');
if (source.includes('confirm_delete_trip:')) {
  console.log('already patched');
  process.exit(0);
}

const typeInsert = NEW_KEYS.map((k) => `  ${k}: string;`).join('\n');
source = source.replace(
  /  diary_modal_later: string;\r?\n};/,
  `  diary_modal_later: string;\n${typeInsert}\n};`,
);

for (const [lang, marker] of LANG_MARKERS) {
  const block = extractBlock(source, marker);
  if (!block) throw new Error(`block not found: ${lang}`);
  const lines = NEW_KEYS.map((k) => {
    const v = keys[k][lang].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `    ${k}: '${v}',`;
  }).join('\n');
  const inner = block.text.replace(/\r?\n  \}$/, `\n${lines}\n  }`);
  source = source.slice(0, block.start) + inner + source.slice(block.end);
}

const helper = `
export function formatTravelTranslation(
  lang: LangCode,
  key: keyof TravelTranslations,
  vars: Record<string, string | number>,
): string {
  let text = getTravelTranslation(lang, key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(\`{\${name}}\`, String(value));
  }
  return text;
}
`;

source = source.replace(
  'export function getTravelTranslation(lang: LangCode, key: keyof TravelTranslations): string {\n  return travel[lang]?.[key] ?? travel.en[key] ?? (travel.ko[key] as string) ?? key;\n}',
  `export function getTravelTranslation(lang: LangCode, key: keyof TravelTranslations): string {\n  return travel[lang]?.[key] ?? travel.en[key] ?? (travel.ko[key] as string) ?? key;\n}\n${helper}`,
);

fs.writeFileSync(travelPath, source, 'utf8');
console.log('patched', NEW_KEYS.length, 'keys x', LANG_MARKERS.length, 'langs');
