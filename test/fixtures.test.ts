import { describe, it, expect } from 'vitest';
import { parseContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg } from '../src/render-svg';
import { DARK, LIGHT } from '../src/palette';
import { FIXTURES, loadFixture } from './helpers';

const OPTS = { date: '2026-10-12', seed: 7, login: 'octocat' };
const planOf = (name: (typeof FIXTURES)[number]) => planSweep(parseContributions(loadFixture(name)));
const invaders = (svg: string): number => (svg.match(/<g class="h\d+">/g) ?? []).length;

describe('fixture renders', () => {
  it('an empty year: the idle SCANNING screen, no invaders', () => {
    const plan = planOf('empty');
    expect(plan.isEmpty).toBe(true);
    const svg = renderSvg(plan, DARK, OPTS);
    expect(svg).toContain('class="scanning blink"');
    expect(invaders(svg)).toBe(0);
    expect(svg).toContain("aria-label=\"@octocat's contribution graph as an arcade game: no contributions yet");
  });

  it('a sparse year that starts mid-week: one invader per active day, first week on the right rows', () => {
    const plan = planOf('sparse');
    expect(plan.totalCells).toBeGreaterThan(5);
    expect(plan.totalCells).toBeLessThan(60);
    // The calendar starts on a Wednesday: nothing can sit on Sunday..Tuesday of week one.
    const first = plan.steps.find((s) => s.column === 0);
    for (const cell of first?.cells ?? []) expect(cell.row).toBeGreaterThanOrEqual(3);
    const svg = renderSvg(plan, LIGHT, OPTS);
    expect(invaders(svg)).toBe(plan.totalCells);
  });

  it('a full year: 371 invaders, the saucer, and two lives lost', () => {
    const plan = planOf('full-year');
    expect(plan.totalCells).toBe(371);
    const svg = renderSvg(plan, DARK, OPTS);
    expect(invaders(svg)).toBe(371);
    expect(svg).toContain('class="ufo"');
    expect(svg.match(/class="bomb bl\d+"/g)).toHaveLength(2);
  });

  it('very high counts: every invader at the top level, and the score grows a digit', () => {
    const plan = planOf('very-high');
    expect(plan.steps.every((s) => s.cells.every((c) => c.level === 4))).toBe(true);
    const svg = renderSvg(plan, DARK, OPTS);
    expect(invaders(svg)).toBe(371);
    // 371 invaders x 50 points + the 300-point saucer = 18850: the score counter grows a fifth digit.
    expect(svg).toMatch(/class="sg s4\d"/);
    expect(renderSvg(planOf('sparse'), DARK, OPTS)).not.toMatch(/class="sg s4\d"/);
  });

  it('is deterministic: the same year, day and seed give the same file', () => {
    for (const name of FIXTURES) {
      const plan = planOf(name);
      expect(renderSvg(plan, DARK, OPTS)).toBe(renderSvg(plan, DARK, OPTS));
    }
  });

  it('changes with the seed, but not the invaders', () => {
    const plan = planOf('full-year');
    const a = renderSvg(plan, DARK, { ...OPTS, seed: 1 });
    const b = renderSvg(plan, DARK, { ...OPTS, seed: 2 });
    expect(a).not.toBe(b);
    expect(invaders(a)).toBe(invaders(b));
  });
});
