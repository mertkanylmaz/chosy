/**
 * lint-optimistic-ui — Toast/UI feedback backend insert'siz kullanim kontrolu.
 *
 * Sprint 2 Kural 7: Optimistic UI ONCE backend insert.
 * "Saved to watchlist" toast'u gostermeden ONCE addToWatchlist INSERT
 * tamamlanmis olmali. Insert atlanirsa kullaniciya yalan soylenmis olur.
 *
 * Pattern: setShowSaveToast(true) veya toast cagrisi, ayni fonksiyon icinde
 * addToWatchlist cagrisi OLMADAN kullanilmamali.
 *
 * Kullanim:
 *   npm run lint:ui
 *   npx tsx scripts/lint-optimistic-ui.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/** Taranan dizinler */
const SCAN_DIRS = ['app', 'components'];

/** Toast/UI feedback cagrilari */
const TOAST_PATTERNS = [
  /setShowSaveToast\s*\(\s*true\s*\)/,
  /setToast\s*\(\s*['"`].*[Ss]aved/,
  /showToast\s*\(\s*['"`].*[Ss]aved/,
];

/** Backend insert cagrilari — ayni fonksiyon blogu icinde bulunmali */
const INSERT_PATTERNS = [
  /await\s+addToWatchlist/,
  /addToWatchlist\s*\(/,
  /await\s+supabase\s*\.\s*from\s*\(\s*['"`]watchlist/,
];

interface Violation {
  file: string;
  line: number;
  text: string;
  issue: string;
}

/**
 * Basit fonksiyon-scope analizi:
 * - Toast pattern bulunca, ayni fonksiyon blogu icinde insert pattern arar
 * - Bulamazsa violation raporlar
 */
function scanFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // Fonksiyon bloklarini bul (basit brace tracking)
  // Her toast pattern icin en yakin kapsayici fonksiyonu kontrol et
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchingToast = TOAST_PATTERNS.find((p) => p.test(line));
    if (!matchingToast) continue;

    // Bu satirin kapsayici fonksiyonunu bul (geriye dogru scan)
    // ve o fonksiyonun tamaminda insert pattern ara
    const funcDeclStart = findFunctionStart(lines, i);
    const funcStart = findFirstBrace(lines, funcDeclStart);
    const funcEnd = findFunctionEnd(lines, funcStart);
    const funcBody = lines.slice(funcStart, funcEnd + 1).join('\n');

    const hasInsert = INSERT_PATTERNS.some((p) => p.test(funcBody));
    if (!hasInsert) {
      violations.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        text: line.trim(),
        issue: 'Toast/UI feedback without addToWatchlist in same function scope',
      });
    }
  }

  return violations;
}

/** Geriye dogru en yakin fonksiyon baslangicini bul */
function findFunctionStart(lines: string[], fromLine: number): number {
  const funcPatterns = [
    /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:use)?[Cc]allback/,
    /(?:async\s+)?function\s+\w+/,
    /(?:const|let|var)\s+\w+\s*=\s*async\s*\(/,
  ];
  for (let i = fromLine; i >= 0; i--) {
    if (funcPatterns.some((p) => p.test(lines[i]))) return i;
  }
  return 0;
}

/** Fonksiyon icindeki ilk '{' satirini bul — brace matching buradan baslar */
function findFirstBrace(lines: string[], fromLine: number): number {
  for (let i = fromLine; i < lines.length; i++) {
    if (lines[i].includes('{')) return i;
  }
  return fromLine;
}

/** Ileriye dogru fonksiyon sonunu bul (brace matching) */
function findFunctionEnd(lines: string[], fromLine: number): number {
  let depth = 0;
  let foundFirst = false;
  for (let i = fromLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundFirst = true; }
      if (ch === '}') depth--;
      if (foundFirst && depth === 0) return i;
    }
  }
  return lines.length - 1;
}

function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const allViolations: Violation[] = [];

for (const dirName of SCAN_DIRS) {
  const dirPath = path.join(ROOT, dirName);
  const files = walkDir(dirPath, ['.ts', '.tsx']);
  for (const file of files) {
    allViolations.push(...scanFile(file));
  }
}

if (allViolations.length === 0) {
  console.log('\x1b[32m✓\x1b[0m No optimistic UI violations found.');
  process.exit(0);
} else {
  console.error(`\x1b[31m✗\x1b[0m Found ${allViolations.length} optimistic UI violation(s):\n`);
  for (const v of allViolations) {
    console.error(`  \x1b[33m${v.file}:${v.line}\x1b[0m`);
    console.error(`    ${v.text}`);
    console.error(`    Issue: ${v.issue}\n`);
  }
  console.error('Fix: Ensure addToWatchlist() is called BEFORE showing toast.\n');
  process.exit(1);
}
