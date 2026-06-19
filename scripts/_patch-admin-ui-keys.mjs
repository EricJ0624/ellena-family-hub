import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminPath = path.join(__dirname, '..', 'lib', 'translations', 'admin.ts');
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, '_admin-ui-keys.json'), 'utf8'));

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

let source = fs.readFileSync(adminPath, 'utf8');
if (source.includes('recent_inquiries_title:')) {
  console.log('already patched');
  process.exit(0);
}

const typeInsert = NEW_KEYS.map((k) => `  ${k}: string;`).join('\n');
source = source.replace(
  /  view_transactions_btn: string;\r?\n};/,
  `  view_transactions_btn: string;\n${typeInsert}\n};`,
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
export function formatAdminTranslation(
  lang: LangCode,
  key: keyof AdminTranslations,
  vars: Record<string, string | number>,
): string {
  let text = getAdminTranslation(lang, key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(\`{\${name}}\`, String(value));
  }
  return text;
}
`;

source = source.replace(
  'export function getAdminAuditHeaders(lang: LangCode): string[] {\n  return admin[lang]?.audit_headers ?? admin.en.audit_headers ?? admin.ko.audit_headers;\n}',
  `export function getAdminAuditHeaders(lang: LangCode): string[] {\n  return admin[lang]?.audit_headers ?? admin.en.audit_headers ?? admin.ko.audit_headers;\n}\n${helper}`,
);

fs.writeFileSync(adminPath, source, 'utf8');
console.log('patched', NEW_KEYS.length, 'keys x', LANG_MARKERS.length, 'langs');
