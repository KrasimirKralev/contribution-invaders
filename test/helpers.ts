import { readFileSync } from 'node:fs';
import type { ContributionGrid, ContributionLevel } from '../src/types';

/** Build a grid from a list of weeks, each week a list of day levels. */
export function gridFromLevels(weeks: number[][]): ContributionGrid {
  return {
    weeks: weeks.map((week, w) =>
      week.map((level, d) => ({
        date: `2026-01-${String(((w * 7 + d) % 28) + 1).padStart(2, '0')}`,
        count: level,
        level: level as ContributionLevel,
      })),
    ),
  };
}

/** A synthetic GraphQL calendar response from test/fixtures (see scripts/make-fixtures.ts). */
export function loadFixture(name: 'empty' | 'sparse' | 'full-year' | 'very-high'): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

export const FIXTURES = ['empty', 'sparse', 'full-year', 'very-high'] as const;
