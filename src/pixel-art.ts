/**
 * Pixel art for the arcade look: a 5x7 bitmap font and the sprites.
 * Everything is drawn as paths, never as <text>, so it looks the same on every
 * device (an SVG inside a README image cannot load a web font).
 */

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
};

/** Advance per character, in font pixels (5 wide + 1 space). */
export const ADVANCE = 6;
export const GLYPH_H = 7;

/** True when the pixel font can draw this character (a space is always fine). */
export const hasGlyph = (ch: string): boolean => ch === ' ' || ch in FONT;

/**
 * Make free text drawable in the pixel font: upper case, one space between
 * words, and a "?" for anything the font has no glyph for.
 */
export function toPixelText(s: string, maxLength = 40): string {
  const upper = s.toUpperCase().replace(/\s+/g, ' ').trim();
  return [...upper]
    .map((ch) => (hasGlyph(ch) ? ch : '?'))
    .join('')
    .slice(0, maxLength);
}

/** Pixel invaders with hooked pincers, two frames: pincers open, pincers closing. */
export const INVADER = {
  w: 11,
  h: 8,
  a: [
    '##.......##',
    '#.........#',
    '##..#.#..##',
    '.#.#####.#.',
    '..##.#.##..',
    '.####.####.',
    '#..#####..#',
    '.#.#...#.#.',
  ],
  b: [
    '.##.....##.',
    '##.#...#.##',
    '.#..#.#..#.',
    '.#.#####.#.',
    '..##.#.##..',
    '.####.####.',
    '#..#####..#',
    '..#.#.#.#..',
  ],
};

/** An invader going up: a hot core with sparks flying out. */
export const BOOM = {
  w: 11,
  h: 9,
  rows: [
    '.....#.....',
    '.#...#...#.',
    '..#.###.#..',
    '...#####...',
    '##.#####.##',
    '...#####...',
    '..#.###.#..',
    '.#...#...#.',
    '.....#.....',
  ],
};

/** An invader's zig-zag bomb. */
export const BOMB = { w: 3, h: 7, rows: ['#..', '.#.', '..#', '.#.', '#..', '.#.', '..#'] };

/** The mystery saucer: a glass dome with its pilot's two eyes, a lit rim and landing legs. */
export const SAUCER = {
  w: 17,
  h: 8,
  rows: [
    '.......###.......',
    '.....##...##.....',
    '....#.#...#.#....',
    '....#.......#....',
    '..#############..',
    '##.###.###.###.##',
    '...###########...',
    '..#..#.....#..#..',
  ],
};

/**
 * The player's ship: a small fighter seen from behind, nose up. One bitmap,
 * three layers: `#` hull, `c` cockpit glass, `f` engine flame.
 */
export const SHIP = {
  w: 15,
  h: 11,
  rows: [
    '.......#.......',
    '......###......',
    '......#c#......',
    '.....##c##.....',
    '..#..#####..#..',
    '..#.#######.#..',
    '.##.#######.##.',
    '###############',
    '####.#####.####',
    '##...##.##...##',
    '.....ff.ff.....',
  ],
};

/** A bitmap as one path, one subpath per horizontal run of `on` pixels. */
export function bitmapPath(rows: string[], on = '#'): string {
  const d: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== on) {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run] === on) run++;
      d.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return d.join('');
}

const glyphId = (ch: string): string => `g${ch.charCodeAt(0)}`;

/** <defs> entries for every character the given strings use (and nothing else). */
export function glyphDefs(texts: string[]): string {
  const used = new Set(texts.join('').replace(/ /g, ''));
  return [...used]
    .sort()
    .map((ch) => {
      const bitmap = FONT[ch];
      if (!bitmap) throw new Error(`pixel font has no glyph for "${ch}"`);
      return `<path id="${glyphId(ch)}" d="${bitmapPath(bitmap)}" shape-rendering="crispEdges"/>`;
    })
    .join('');
}

export interface PixelTextOptions {
  /** Size of one font pixel. */
  px: number;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  cls?: string;
}

/** Width of a string in screen pixels. */
export const textWidth = (s: string, px: number): number => (s.length * ADVANCE - 1) * px;

/** A string in the pixel font; (x, y) is the top of the line at its anchor. */
export function pixelText(s: string, x: number, y: number, o: PixelTextOptions): string {
  const w = textWidth(s, o.px);
  const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
  const uses = [...s]
    .map((ch, i) => (ch === ' ' ? '' : `<use href="#${glyphId(ch)}" x="${i * ADVANCE}"/>`))
    .join('');
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    `<g${o.cls ? ` class="${o.cls}"` : ''} fill="${o.fill}" ` +
    `transform="translate(${r(left)} ${r(y)}) scale(${o.px})">${uses}</g>`
  );
}

/** One glyph at a font-pixel offset, for building counters digit by digit. */
export function glyphUse(ch: string, xFontPx: number, cls?: string): string {
  return `<use href="#${glyphId(ch)}" x="${xFontPx}"${cls ? ` class="${cls}"` : ''}/>`;
}
