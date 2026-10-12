// Renders the README demo (docs/demo-*.svg) from a made-up year, offline.
//   npm run demo
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planSweep } from '../src/plan-sweep';
import { renderSvg } from '../src/render-svg';
import { DARK, LIGHT } from '../src/palette';
import { fnv1a } from '../src/seed';
import { mulberry32 } from '../src/shuffle';
import type { ContributionGrid, ContributionLevel } from '../src/types';

const DATE = '2026-10-12';

/** A plausible, entirely synthetic year: quiet at first, busier towards the end. */
export function madeUpYear(): ContributionGrid {
  const rng = mulberry32(42);
  return {
    weeks: Array.from({ length: 53 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const lit = rng() < 0.08 + (w / 53) * 0.45;
        const level = (lit ? 1 + Math.floor(rng() * 4) : 0) as ContributionLevel;
        return { date: `w${w}d${d}`, count: level, level };
      }),
    ),
  };
}

const plan = planSweep(madeUpYear());
const dir = join(import.meta.dirname, '..', 'docs');
mkdirSync(dir, { recursive: true });
for (const palette of [DARK, LIGHT]) {
  const svg = renderSvg(plan, palette, { date: DATE, seed: fnv1a('demo'), title: '@your-login' });
  writeFileSync(join(dir, `demo-${palette.name}.svg`), svg, 'utf8');
  console.log(`docs/demo-${palette.name}.svg  (${plan.totalCells} invaders, ${(svg.length / 1024).toFixed(1)} KB)`);
}
