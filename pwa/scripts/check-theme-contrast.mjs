#!/usr/bin/env node
/* OS1 theme accessibility gate.
 *
 * Resolves every theme in public/themes/ exactly the way the browser will (same
 * theme-core.js, same derivations), flattens each translucent ink onto the stack of
 * surfaces actually painted beneath it, and computes real WCAG 2.1 contrast ratios.
 *
 * The pair list below is not generic advice: each row is a place in os1.css where
 * that token pair really renders text, at the size it really renders.
 *
 *   node scripts/check-theme-contrast.mjs            check every theme
 *   node scripts/check-theme-contrast.mjs default    check one
 *
 * Exit 1 if any non-baseline theme misses AA.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = join(__dirname, '..', 'public', 'themes');
const CORE_PATH = join(__dirname, '..', 'public', 'js', 'theme-core.js');

const AA_TEXT = 4.5;   // WCAG 2.1 1.4.3, normal-size text
const AA_NONTEXT = 3;  // WCAG 2.1 1.4.11, UI component / state indicator

/* Contrast deviations are reported for manual design review and are not changed automatically. */
const BASELINE = new Set(['default']);

/* fg over layers[0] over layers[1] ... over the page. Bottom of the stack is first. */
const PAIRS = [
  { where: '.card / .ticket / topbar body text', fg: 'on-brand', layers: ['brand'], kind: 'text' },
  { where: '.card .meta, .t-meta, .topbar-right (11-13px)', fg: 'on-brand-secondary', layers: ['brand'], kind: 'text' },
  { where: 'body copy on the page', fg: 'on-surface', layers: ['surface'], kind: 'text' },
  { where: '.empty / .loading / .kanban-col h4', fg: 'on-surface-secondary', layers: ['surface'], kind: 'text' },
  { where: '.section-title (13px)', fg: 'on-surface-muted', layers: ['surface'], kind: 'text' },
  { where: '.tab label (11px)', fg: 'on-surface-muted', layers: ['surface', 'tabbar-bg'], kind: 'text' },
  { where: '.tab.active label (11px)', fg: 'brand-strong', layers: ['surface', 'tabbar-bg'], kind: 'text' },
  { where: '.error-box text', fg: 'brand-strong', layers: ['surface'], kind: 'text' },
  { where: '.card.cream heading', fg: 'on-surface', layers: ['surface', 'card-alt-bg'], kind: 'text' },
  { where: '.card.cream .meta (13px)', fg: 'on-surface-secondary', layers: ['surface', 'card-alt-bg'], kind: 'text' },
  { where: '.kanban-col h4 (13px)', fg: 'on-surface-secondary', layers: ['surface', 'col-bg'], kind: 'text' },
  { where: '.voice-input typed text', fg: 'on-brand', layers: ['brand', 'input-bg'], kind: 'text' },
  { where: '.voice-input placeholder', fg: 'on-brand-secondary', layers: ['brand', 'input-bg'], kind: 'text' },
  { where: '.btn label', fg: 'on-brand', layers: ['brand', 'glass-fill'], kind: 'text' },
  { where: '.offline-banner text (13px)', fg: 'on-warning', layers: ['warning'], kind: 'text' },
  { where: 'status dot, connected', fg: 'success', layers: ['brand'], kind: 'nontext' },
  { where: 'status dot, error', fg: 'warning', layers: ['brand'], kind: 'nontext' },
  { where: 'status dot, idle', fg: 'on-brand-muted', layers: ['brand'], kind: 'nontext' }
];

async function loadCore() {
  const src = await readFile(CORE_PATH, 'utf8');
  const scope = {};
  return new Function('self', src + '\nreturn self.OS1ThemeCore;')(scope);
}

function flatten(core, tokens, layers) {
  let bg = tokens[layers[0]];
  for (let i = 1; i < layers.length; i++) bg = core.over(tokens[layers[i]], bg);
  return bg;
}

function checkPalette(core, tokens) {
  return PAIRS.map((p) => {
    const bg = flatten(core, tokens, p.layers);
    const fg = core.over(tokens[p.fg], bg);
    const ratio = core.contrast(fg, bg);
    const min = p.kind === 'text' ? AA_TEXT : AA_NONTEXT;
    return {
      ...p,
      bg,
      fgFlat: fg,
      ratio: Math.round(ratio * 100) / 100,
      min,
      pass: ratio >= min
    };
  });
}

function fmt(n) {
  return (Math.round(n * 100) / 100).toFixed(2).padStart(5);
}

async function main() {
  const core = await loadCore();
  const only = process.argv[2];
  const files = (await readdir(THEMES_DIR))
    .filter((f) => f.endsWith('.json') && f !== 'theme.schema.json')
    .sort();

  let failed = 0;
  let baselineNotes = 0;

  for (const file of files) {
    const theme = JSON.parse(await readFile(join(THEMES_DIR, file), 'utf8'));
    if (only && theme.id !== only) continue;

    const isBaseline = BASELINE.has(theme.id);
    const schemes = Object.keys(theme.colors || {});

    for (const scheme of schemes) {
      const { tokens, errors } = core.resolve(theme.colors[scheme], theme.radius);
      if (!tokens) {
        console.log(`\n${theme.id} (${scheme}): UNRESOLVABLE`);
        errors.forEach((e) => console.log(`   ${e}`));
        failed++;
        continue;
      }

      const rows = checkPalette(core, tokens);
      const bad = rows.filter((r) => !r.pass);
      const worst = rows.filter((r) => r.kind === 'text')
        .reduce((m, r) => Math.min(m, r.ratio), Infinity);

      const verdict = bad.length === 0 ? 'AA PASS'
        : isBaseline ? `BASELINE (${bad.length} documented)` : `FAIL (${bad.length})`;
      console.log(`\n${theme.id} · ${scheme} · "${theme.name}" -> ${verdict}`);
      console.log(`  lowest text ratio ${fmt(worst)}  (AA needs ${AA_TEXT.toFixed(2)})`);

      for (const r of rows) {
        const mark = r.pass ? 'ok  ' : isBaseline ? 'note' : 'FAIL';
        console.log(
          `  ${mark} ${fmt(r.ratio)}:1  min ${r.min.toFixed(1)}  ${r.fgFlat} on ${r.bg}  ${r.where}`
        );
      }

      if (bad.length) {
        if (isBaseline) baselineNotes += bad.length;
        else failed += bad.length;
      }
    }
  }

  console.log('');
  if (failed) {
    console.log(`RESULT: ${failed} contrast failure(s) outside the documented baseline.`);
    process.exit(1);
  }
  console.log(`RESULT: every shippable theme meets WCAG 2.1 AA` +
    (baselineNotes ? ` (${baselineNotes} documented baseline note(s) on the house palette).` : '.'));
}

main().catch((e) => { console.error(e); process.exit(1); });
