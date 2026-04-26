import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'app');
const allowlistPath = path.join(repoRoot, 'config', 'inline-style-allowlist.json');

function walkTsxFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsxFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(fullPath);
    }
  }
  return out;
}

function countInlineStyles(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  return (src.match(/style=\{\{/g) || []).length;
}

if (!fs.existsSync(allowlistPath)) {
  console.error('[inline-style-guard] Missing allowlist:', allowlistPath);
  process.exit(1);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const tsxFiles = walkTsxFiles(appRoot);

const issues = [];
for (const absPath of tsxFiles) {
  const relPath = path.relative(repoRoot, absPath).replaceAll('\\', '/');
  const actual = countInlineStyles(absPath);
  const expected = allowlist[relPath] ?? 0;
  if (actual > expected) {
    issues.push({ relPath, actual, expected });
  }
}

if (issues.length > 0) {
  console.error('[inline-style-guard] Found inline style regressions:');
  for (const issue of issues) {
    console.error(`- ${issue.relPath}: actual ${issue.actual} > allowed ${issue.expected}`);
  }
  process.exit(1);
}

console.log('[inline-style-guard] OK: no inline style regressions.');

