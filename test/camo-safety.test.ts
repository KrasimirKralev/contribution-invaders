import { describe, it, expect } from 'vitest';
import { parseContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg } from '../src/render-svg';
import { DARK, LIGHT } from '../src/palette';
import { FIXTURES, loadFixture } from './helpers';

/**
 * GitHub serves README images through its camo proxy, which drops SVGs that
 * script, embed or fetch anything. Every output must be self-contained.
 */
const TITLES = [undefined, 'Hello, world!', '<script>alert(1)</script>', 'x" onload="alert(1)', 'привет 🚀'];

const renders = FIXTURES.flatMap((name) => {
  const plan = planSweep(parseContributions(loadFixture(name)));
  return [DARK, LIGHT].flatMap((palette) =>
    TITLES.map((title) => ({
      name: `${name}/${palette.name}/${title ?? 'default'}`,
      svg: renderSvg(plan, palette, { date: '2026-10-12', seed: 3, login: 'octocat', title }),
    })),
  );
});

describe('camo safety', () => {
  it.each(renders)('$name: no scripts, handlers, external references or embedded images', ({ svg }) => {
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i);
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).not.toMatch(/href\s*=\s*["'](?!#)/i); // only same-document references
    expect(svg).not.toMatch(/url\(\s*["']?(?!#)/i);
    expect(svg).not.toMatch(/@import/i);
    expect(svg).not.toMatch(/<image|<foreignObject|<iframe/i);
  });

  it.each(renders)('$name: every reference points at something defined', ({ svg }) => {
    const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const refs = [...svg.matchAll(/href="#([^"]+)"|url\(#([^)]+)\)/g)].map((m) => m[1] ?? m[2]);
    for (const ref of refs) expect(ids.has(ref)).toBe(true);
  });

  it.each(renders)('$name: groups open and close in balance', ({ svg }) => {
    expect((svg.match(/<g[\s>]/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
    expect(svg.match(/<svg[\s>]/g)).toHaveLength(1);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
