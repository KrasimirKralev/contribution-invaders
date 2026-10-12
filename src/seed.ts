/** 32-bit FNV-1a over the UTF-8 bytes of a string. */
export function fnv1a(s: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The day's seed: a hash of the date and the login, so every day (and every
 * user) gets its own misses, bombs and stars, reproducible within the day.
 */
export function dailySeed(date: string, login: string): number {
  return fnv1a(`${date}:${login.toLowerCase()}`);
}

/** What the `seed` input accepts: `daily`, `fixed`, or a whole number. */
export function resolveSeed(input: string, date: string, login: string): number {
  const value = input.trim().toLowerCase() || 'daily';
  if (value === 'daily') return dailySeed(date, login);
  if (value === 'fixed') return fnv1a(login.toLowerCase());
  if (/^\d{1,10}$/.test(value) && Number(value) <= 0xffffffff) return Number(value);
  throw new Error(`seed must be "daily", "fixed" or a whole number up to 4294967295, got "${input}".`);
}
