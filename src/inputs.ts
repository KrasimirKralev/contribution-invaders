import { PALETTES, type PaletteName } from './palette';

/** One SVG to write: where, and in which theme. */
export interface OutputTarget {
  path: string;
  palette: PaletteName;
}

export interface ActionInputs {
  login: string;
  token: string;
  outputs: OutputTarget[];
  title: string;
  seed: string;
}

export const DEFAULT_OUTPUTS = 'dist/invaders.svg\ndist/invaders-dark.svg?palette=dark';

/** GitHub logins: letters, digits and hyphens, up to 39 characters. */
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

export function validateLogin(raw: string): string {
  const login = raw.trim().replace(/^@/, '');
  if (!login) {
    throw new Error('github_user_name is empty: set it to the GitHub login whose graph to draw.');
  }
  if (!LOGIN.test(login)) {
    throw new Error(`github_user_name "${raw}" is not a valid GitHub login.`);
  }
  return login;
}

/**
 * The `outputs` input: one file per line, with options after a "?", e.g.
 * `dist/invaders-dark.svg?palette=dark`. Blank lines are ignored.
 */
export function parseOutputs(text: string): OutputTarget[] {
  const targets = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): OutputTarget => {
      const [path = '', query = ''] = line.split('?', 2);
      if (!path.trim()) throw new Error(`outputs line "${line}" has no file name.`);
      let palette: PaletteName = 'light';
      for (const [key, value] of new URLSearchParams(query)) {
        if (key !== 'palette') {
          throw new Error(`outputs line "${line}": unknown option "${key}" (supported: palette).`);
        }
        if (!(value in PALETTES)) {
          throw new Error(`outputs line "${line}": palette must be one of ${Object.keys(PALETTES).join(', ')}.`);
        }
        palette = value as PaletteName;
      }
      return { path: path.trim(), palette };
    });
  if (targets.length === 0) throw new Error('outputs is empty: list at least one .svg file to write.');
  return targets;
}

/** Action inputs as the runner passes them: INPUT_<NAME> environment variables. */
export function readInputs(env: Record<string, string | undefined>): ActionInputs {
  const input = (name: string): string => env[`INPUT_${name.toUpperCase()}`]?.trim() ?? '';
  const token = input('github_token');
  if (!token) {
    throw new Error('github_token is empty: the default is the workflow token, so pass one only to see private contributions.');
  }
  return {
    login: validateLogin(input('github_user_name')),
    token,
    outputs: parseOutputs(input('outputs') || DEFAULT_OUTPUTS),
    title: input('title'),
    seed: input('seed') || 'daily',
  };
}
