// main.ts — the Vice Legend submission program (Node 22, standard library only).
// It hands the entry in: copy this repository's app/ and screenshots/ into the output
// directory, then write <out>/dossier.json as the exact bytes the vendored make.fun
// library's buildDossier returns. The repository root is resolved from this file's own
// URL, never the working directory, so the program behaves the same wherever it is run.
// Output is deterministic: no timestamps, no random values, a clean copy each run.
//
// Run it with Node 22.18+ (which executes .ts directly):
//   MAKEFUN_OUTPUT_DIR=out node main.ts        (outside the grader, out/ stands in for /output)

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The scorer's caps: text_max_bytes shapes the dossier text; the rest only refuse an
// entry the scorer would refuse, so passing them makes this program fail where it would.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

const MIN_TROPHIES = 55;

// The repository root is the directory holding this file, derived from its URL.
function resolveRepoRoot(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

// Fail loudly unless the guide's essential files are present and the trophy data is
// sound: app/index.html and app/data/trophies.json must exist, the JSON must parse,
// and it must hold at least the official 55 trophies.
function assertGuideData(appDir: string): void {
  const indexHtml = join(appDir, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`submission refused: missing ${indexHtml}`);
  }
  const trophiesPath = join(appDir, 'data', 'trophies.json');
  if (!existsSync(trophiesPath)) {
    throw new Error(`submission refused: missing ${trophiesPath}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(trophiesPath, 'utf8'));
  } catch (err) {
    throw new Error(`submission refused: ${trophiesPath} is not valid JSON (${(err as Error).message})`);
  }
  const trophies = (data as { trophies?: unknown })?.trophies;
  if (!Array.isArray(trophies)) {
    throw new Error(`submission refused: ${trophiesPath} has no "trophies" array`);
  }
  if (trophies.length < MIN_TROPHIES) {
    throw new Error(`submission refused: ${trophiesPath} holds ${trophies.length} trophies, need at least ${MIN_TROPHIES}`);
  }
}

// Replace a destination tree with a fresh copy of the source, so a previous run's
// leftovers can never change the dossier. A missing source is simply skipped.
function copyTree(src: string, dest: string): void {
  rmSync(dest, { recursive: true, force: true });
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  }
}

// Copy the entry's files into out/ and write the dossier the judge reads.
function buildSubmission(repoRoot: string, outDir: string): void {
  const appSrc = join(repoRoot, 'app');
  assertGuideData(appSrc);

  mkdirSync(outDir, { recursive: true });
  copyTree(appSrc, join(outDir, 'app'));
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

function main(): void {
  const repoRoot = resolveRepoRoot();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  buildSubmission(repoRoot, outDir);
  console.log(`submission written to ${outDir} (app/, screenshots/, dossier.json)`);
}

try {
  main();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}