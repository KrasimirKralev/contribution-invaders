// Entry point of the GitHub Action (bundled to dist/index.js).
import { run } from './run';

/** Escape a message for a workflow command, so a multi-line error stays one annotation. */
const escapeData = (s: string): string => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

try {
  await run({ env: process.env });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`::error title=Contribution Invaders::${escapeData(message)}`);
  process.exitCode = 1;
}
