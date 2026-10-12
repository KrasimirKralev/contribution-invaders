// Writes the synthetic contribution calendars in test/fixtures/, shaped like the
// GitHub GraphQL response. Everything here is made up; no real account's data.
//   npm run fixtures
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32 } from '../src/shuffle';

const LEVELS = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];

interface FakeDay {
  level: number;
  count: number;
}

/** A calendar from `start` for `days` days, grouped into Sunday-first weeks like GitHub's. */
function calendar(start: string, days: number, dayFor: (i: number) => FakeDay) {
  const weeks: { contributionDays: object[] }[] = [];
  const t0 = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(t0 + i * 86_400_000);
    const weekday = d.getUTCDay();
    if (weeks.length === 0 || weekday === 0) weeks.push({ contributionDays: [] });
    const { level, count } = dayFor(i);
    weeks.at(-1)!.contributionDays.push({
      date: d.toISOString().slice(0, 10),
      weekday,
      contributionCount: count,
      contributionLevel: LEVELS[level],
    });
  }
  return { data: { user: { contributionsCollection: { contributionCalendar: { weeks } } } } };
}

const rng = mulberry32(2026);
const fixtures: Record<string, object> = {
  // Nothing at all: the idle SCANNING screen.
  empty: calendar('2025-10-12', 365, () => ({ level: 0, count: 0 })),
  // A quiet year that starts on a Wednesday, so the first week is partial.
  sparse: calendar('2025-10-15', 362, () => {
    const lit = rng() < 0.06;
    return lit ? { level: 1 + Math.floor(rng() * 2), count: 1 + Math.floor(rng() * 3) } : { level: 0, count: 0 };
  }),
  // Every day of a 53-week year has something, at every level.
  'full-year': calendar('2025-10-12', 371, (i) => ({ level: 1 + (i % 4), count: 1 + (i % 9) })),
  // Every day at the top level with huge counts: the biggest score possible.
  'very-high': calendar('2025-10-12', 371, (i) => ({ level: 4, count: 500 + ((i * 37) % 500) })),
};

const dir = join(import.meta.dirname, '..', 'test', 'fixtures');
mkdirSync(dir, { recursive: true });
for (const [name, json] of Object.entries(fixtures)) {
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(json)}\n`, 'utf8');
  console.log(`test/fixtures/${name}.json`);
}
