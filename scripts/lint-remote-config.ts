/**
 * lint-remote-config — Module-level remoteConfig.get() kullanim kontrolu.
 *
 * Sprint 2 Kural 6: Module-level `const X = remoteConfig.get(...)` YASAK.
 * JS module re-eval olmaz — import zamaninda evaluate olan constant
 * hydrate sonrasi guncellenmez, feature flag kalici stale kalir.
 *
 * Dogru pattern: Lazy getter
 *   const useFlag = (): boolean => remoteConfig.get('flag');
 *
 * Kullanim:
 *   npm run lint:config
 *   npx tsx scripts/lint-remote-config.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/** Taranan dizinler */
const SCAN_DIRS = ['services', 'app', 'components', 'contexts', 'hooks'];

/** Module-level remoteConfig.get pattern — fonksiyon govdesi disinda */
const FORBIDDEN_PATTERN = /^(?:export\s+)?const\s+\w+\s*=\s*remoteConfig\.get\s*\(/;

/** Lazy getter pattern — bu OK */
const ALLOWED_PATTERN = /=>\s*remoteConfig\.get\s*\(/;

interface Violation {
  file: string;
  line: number;
  text: string;
}

function scanFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // Basit heuristik: fonksiyon govdesi icinde olup olmadigini
  // brace depth ile takip et. depth=0 → module scope.
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Brace tracking (basit — string literal icindeki brace'leri sayar ama
    // pratikte remoteConfig.get satirlarinda sorun olmaz)
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    }

    // Module scope (depth 0) veya top-level object (depth 1 — config objesi icinde)
    if (braceDepth <= 1 && FORBIDDEN_PATTERN.test(line.trim())) {
      // Lazy getter ise OK
      if (ALLOWED_PATTERN.test(line)) continue;

      violations.push({
        file: path.relative(ROOT, filePath),
        line: i + 1,
        text: line.trim(),
      });
    }
  }

  return violations;
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
  console.log('\x1b[32m✓\x1b[0m No module-level remoteConfig.get() violations found.');
  process.exit(0);
} else {
  console.error(`\x1b[31m✗\x1b[0m Found ${allViolations.length} module-level remoteConfig.get() violation(s):\n`);
  for (const v of allViolations) {
    console.error(`  \x1b[33m${v.file}:${v.line}\x1b[0m`);
    console.error(`    ${v.text}\n`);
  }
  console.error('Fix: Use lazy getter pattern instead:');
  console.error('  const useFlag = (): boolean => remoteConfig.get(\'flag\');\n');
  process.exit(1);
}
