import { describe, it, expect } from 'vitest';
import { DEFAULT_OUTPUTS, parseOutputs, readInputs, validateLogin } from '../src/inputs';
import { toPixelText } from '../src/pixel-art';

describe('parseOutputs', () => {
  it('reads the default: a light and a dark file', () => {
    expect(parseOutputs(DEFAULT_OUTPUTS)).toEqual([
      { path: 'dist/invaders.svg', palette: 'light' },
      { path: 'dist/invaders-dark.svg', palette: 'dark' },
    ]);
  });

  it('ignores blank lines and surrounding spaces', () => {
    expect(parseOutputs('\n  a.svg  \r\n\n b.svg?palette=light \n')).toEqual([
      { path: 'a.svg', palette: 'light' },
      { path: 'b.svg', palette: 'light' },
    ]);
  });

  it('refuses unknown options, unknown palettes and empty lists', () => {
    expect(() => parseOutputs('a.svg?theme=dark')).toThrow(/unknown option "theme"/);
    expect(() => parseOutputs('a.svg?palette=neon')).toThrow(/palette must be one of/);
    expect(() => parseOutputs('  \n ')).toThrow(/outputs is empty/);
    expect(() => parseOutputs('?palette=dark')).toThrow(/no file name/);
  });
});

describe('validateLogin', () => {
  it('accepts GitHub logins, with or without a leading @', () => {
    expect(validateLogin('octocat')).toBe('octocat');
    expect(validateLogin(' @some-user42 ')).toBe('some-user42');
  });

  it('refuses an empty login: there is no fallback user', () => {
    expect(() => validateLogin('')).toThrow(/github_user_name is empty/);
  });

  it('refuses anything that is not a login', () => {
    for (const bad of ['-leading', 'has space', 'a/b', 'x'.repeat(40), '"quoted"']) {
      expect(() => validateLogin(bad)).toThrow(/not a valid GitHub login/);
    }
  });
});

describe('readInputs', () => {
  const env = (extra: Record<string, string>) => ({
    INPUT_GITHUB_USER_NAME: 'octocat',
    INPUT_GITHUB_TOKEN: 'test-token',
    ...extra,
  });

  it('reads the INPUT_* variables the runner sets, with defaults', () => {
    expect(readInputs(env({}))).toEqual({
      login: 'octocat',
      token: 'test-token',
      outputs: parseOutputs(DEFAULT_OUTPUTS),
      title: '',
      seed: 'daily',
    });
    expect(readInputs(env({ INPUT_TITLE: ' My year ', INPUT_SEED: 'fixed' }))).toMatchObject({
      title: 'My year',
      seed: 'fixed',
    });
  });

  it('needs a token', () => {
    expect(() => readInputs(env({ INPUT_GITHUB_TOKEN: '' }))).toThrow(/github_token is empty/);
  });
});

describe('toPixelText', () => {
  it('upper-cases, squeezes spaces and swaps undrawable characters for "?"', () => {
    expect(toPixelText('  hello   @octocat ')).toBe('HELLO @OCTOCAT');
    expect(toPixelText('héllo')).toBe('H?LLO');
    expect(toPixelText('x'.repeat(80))).toHaveLength(40);
  });
});
