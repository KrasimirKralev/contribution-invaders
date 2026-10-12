import type { ContributionGrid, ContributionLevel, Day } from './types';
import { USER_AGENT } from './version';

const LEVEL: Record<string, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{
        weeks{
          contributionDays{ date weekday contributionCount contributionLevel }
        }
      }
    }
  }
}`;

const EMPTY_SLOT: Day = { date: '', count: 0, level: 0 };

/**
 * Map a GitHub GraphQL contributions response into a ContributionGrid.
 * Days are placed by their weekday, so a first week that starts mid-week
 * keeps its days on the right rows.
 */
export function parseContributions(json: unknown): ContributionGrid {
  const weeks = (json as any)?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) {
    throw new Error('No contribution calendar in the response (check the login and the token).');
  }
  return {
    weeks: weeks.map((week: any) => {
      const days = (week?.contributionDays ?? []) as any[];
      const placed: Day[] = [];
      days.forEach((day, i) => {
        const weekday = Number.isInteger(day.weekday) && day.weekday >= 0 && day.weekday <= 6 ? day.weekday : i;
        while (placed.length < weekday) placed.push({ ...EMPTY_SLOT });
        placed[weekday] = {
          date: String(day.date),
          count: Number(day.contributionCount) || 0,
          level: LEVEL[day.contributionLevel] ?? 0,
        };
      });
      return placed;
    }),
  };
}

/** Fetch a user's contribution calendar via the GitHub GraphQL API. */
export async function fetchContributions(
  login: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ContributionGrid> {
  const res = await fetchImpl('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if ((json as any).errors) {
    const messages = ((json as any).errors as any[]).map((e) => e?.message ?? 'unknown error');
    throw new Error(`GitHub GraphQL errors: ${messages.join('; ')}`);
  }
  if (!(json as any)?.data?.user) {
    throw new Error(`No GitHub user called "${login}".`);
  }
  return parseContributions(json);
}
