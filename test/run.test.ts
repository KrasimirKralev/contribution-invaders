import { afterAll, describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContributions } from '../src/fetch-contributions';
import { run } from '../src/run';
import { USER_AGENT, VERSION } from '../src/version';
import { loadFixture } from './helpers';

const OUT = join(import.meta.dirname, '..', '.test-output');
afterAll(() => rmSync(OUT, { recursive: true, force: true }));

/** A fetch that answers with a fixture and remembers what it was asked. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, statusText: status === 200 ? 'OK' : 'Unauthorized' });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('version', () => {
  it('matches package.json and names itself in the User-Agent', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(VERSION).toBe(pkg.version);
    expect(USER_AGENT).toBe(`contribution-invaders/${pkg.version}`);
  });
});

describe('fetchContributions', () => {
  it('sends the token, the login and its own User-Agent', async () => {
    const { impl, calls } = fakeFetch(loadFixture('sparse'));
    await fetchContributions('octocat', 'test-token', impl);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.url).toBe('https://api.github.com/graphql');
    expect(headers['User-Agent']).toBe(USER_AGENT);
    expect(headers.Authorization).toBe('bearer test-token');
    expect(JSON.parse(String(calls[0]!.init.body)).variables).toEqual({ login: 'octocat' });
  });

  it('says clearly when the request fails or the user does not exist', async () => {
    await expect(fetchContributions('octocat', 't', fakeFetch({}, 401).impl)).rejects.toThrow(/401/);
    await expect(fetchContributions('nobody', 't', fakeFetch({ data: { user: null } }).impl)).rejects.toThrow(
      /No GitHub user called "nobody"/,
    );
    await expect(
      fetchContributions('octocat', 't', fakeFetch({ errors: [{ message: 'Bad credentials' }] }).impl),
    ).rejects.toThrow(/Bad credentials/);
  });
});

describe('run', () => {
  it('writes every requested SVG and reports them as the step output', async () => {
    mkdirSync(OUT, { recursive: true });
    const outputFile = join(OUT, 'github-output.txt');
    writeFileSync(outputFile, '');
    const lines: string[] = [];
    const written = await run({
      env: {
        INPUT_GITHUB_USER_NAME: 'octocat',
        INPUT_GITHUB_TOKEN: 'test-token',
        INPUT_OUTPUTS: 'out/light.svg\nout/nested/dark.svg?palette=dark',
        GITHUB_OUTPUT: outputFile,
      },
      fetchImpl: fakeFetch(loadFixture('full-year')).impl,
      now: new Date('2026-10-12T06:00:00Z'),
      cwd: OUT,
      log: (line) => lines.push(line),
    });
    expect(written).toEqual(['out/light.svg', 'out/nested/dark.svg']);
    for (const file of written) {
      const svg = readFileSync(join(OUT, file), 'utf8');
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('@octocat');
    }
    expect(readFileSync(outputFile, 'utf8')).toMatch(/^files<<(ghadelimiter_[\w-]+)\nout\/light\.svg\nout\/nested\/dark\.svg\n\1\n$/);
    expect(lines.join('\n')).not.toContain('test-token');
  });

  it('writes nothing when the inputs are wrong', async () => {
    await expect(
      run({
        env: { INPUT_GITHUB_USER_NAME: '', INPUT_GITHUB_TOKEN: 't', INPUT_OUTPUTS: 'never.svg' },
        fetchImpl: fakeFetch(loadFixture('sparse')).impl,
        cwd: OUT,
        log: () => {},
      }),
    ).rejects.toThrow(/github_user_name is empty/);
    expect(existsSync(join(OUT, 'never.svg'))).toBe(false);
  });
});
