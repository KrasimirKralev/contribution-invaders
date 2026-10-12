// Prints how big the SVG gets for each fixture year (no budget enforced yet).
//   npm run size
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg } from '../src/render-svg';
import { DARK, LIGHT } from '../src/palette';

const FIXTURES = ['empty', 'sparse', 'full-year', 'very-high'];
const dir = join(import.meta.dirname, '..', 'test', 'fixtures');

const rows = FIXTURES.map((name) => {
  const plan = planSweep(parseContributions(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))));
  const kb = (svg: string) => (Buffer.byteLength(svg) / 1024).toFixed(1);
  const opts = { date: '2026-10-12', seed: 7, login: 'octocat' };
  return `| ${name} | ${plan.totalCells} | ${kb(renderSvg(plan, LIGHT, opts))} | ${kb(renderSvg(plan, DARK, opts))} |`;
});

const table = ['| fixture | invaders | light KB | dark KB |', '|---|---:|---:|---:|', ...rows].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### SVG size report\n\n${table}\n`, 'utf8');
}
