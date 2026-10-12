import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fetchContributions } from './fetch-contributions';
import { readInputs } from './inputs';
import { PALETTES } from './palette';
import { planSweep } from './plan-sweep';
import { renderSvg } from './render-svg';
import { resolveSeed } from './seed';

export interface RunDeps {
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: Date;
  cwd?: string;
  log?: (line: string) => void;
}

/** Write a step output the way the runner expects (a heredoc in $GITHUB_OUTPUT). */
export function setOutput(env: Record<string, string | undefined>, name: string, value: string): void {
  const file = env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, 'utf8');
}

/** Fetch the graph, render every requested SVG, and report the files written. */
export async function run({ env, fetchImpl, now = new Date(), cwd = process.cwd(), log = console.log }: RunDeps): Promise<string[]> {
  const inputs = readInputs(env);
  const date = now.toISOString().slice(0, 10);
  const seed = resolveSeed(inputs.seed, date, inputs.login);

  log(`Fetching the contribution calendar of @${inputs.login}`);
  const grid = await fetchContributions(inputs.login, inputs.token, fetchImpl);
  const plan = planSweep(grid);
  log(
    `${plan.totalCells} active days across ${plan.steps.length}/${plan.columns} weeks` +
      (plan.isEmpty ? ' (an empty year: the idle SCANNING screen)' : ''),
  );

  const written: string[] = [];
  for (const target of inputs.outputs) {
    const svg = renderSvg(plan, PALETTES[target.palette], { date, seed, login: inputs.login, title: inputs.title });
    const path = resolve(cwd, target.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, svg, 'utf8');
    log(`${target.path}  (${target.palette}, ${(svg.length / 1024).toFixed(1)} KB)`);
    written.push(target.path);
  }
  setOutput(env, 'files', written.join('\n'));
  return written;
}
