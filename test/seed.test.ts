import { describe, it, expect } from 'vitest';
import { dailySeed, fnv1a, resolveSeed } from '../src/seed';

describe('fnv1a', () => {
  it('matches the reference 32-bit FNV-1a values', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});

describe('dailySeed', () => {
  it('gives (almost) every day of a year its own seed', () => {
    const t0 = Date.parse('2026-01-01T00:00:00Z');
    const seeds = new Set(
      Array.from({ length: 365 }, (_, i) => dailySeed(new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), 'octocat')),
    );
    expect(seeds.size).toBeGreaterThanOrEqual(364);
  });

  it('differs between users on the same day, and ignores the login case', () => {
    expect(dailySeed('2026-10-12', 'octocat')).not.toBe(dailySeed('2026-10-12', 'hubot'));
    expect(dailySeed('2026-10-12', 'OctoCat')).toBe(dailySeed('2026-10-12', 'octocat'));
  });
});

describe('resolveSeed', () => {
  it('daily changes with the date, fixed does not', () => {
    expect(resolveSeed('daily', '2026-10-12', 'octocat')).not.toBe(resolveSeed('daily', '2026-10-13', 'octocat'));
    expect(resolveSeed('fixed', '2026-10-12', 'octocat')).toBe(resolveSeed('fixed', '2026-10-13', 'octocat'));
    expect(resolveSeed('', '2026-10-12', 'octocat')).toBe(resolveSeed('daily', '2026-10-12', 'octocat'));
  });

  it('takes a whole number as is, and refuses anything else', () => {
    expect(resolveSeed('42', '2026-10-12', 'octocat')).toBe(42);
    expect(resolveSeed(' 4294967295 ', '2026-10-12', 'octocat')).toBe(4294967295);
    for (const bad of ['-1', '1.5', 'weekly', '4294967296', '0x10']) {
      expect(() => resolveSeed(bad, '2026-10-12', 'octocat')).toThrow(/seed must be/);
    }
  });
});
