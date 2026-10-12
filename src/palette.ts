/** Colour palettes for the two README themes. */

export interface Palette {
  name: 'dark' | 'light';
  /** Cabinet body, top and bottom of its gradient. */
  cabinet: string;
  cabinetEdge: string;
  /** Accent for the fireworks and other small highlights. */
  accent: string;
  /** Darker accent for depth/shadow. */
  accentDark: string;
  /** Neutral metal. */
  hardware: string;
}

/**
 * The header and the control deck are dark glass in both themes, like a lit
 * sign and a screen, so their colours do not change with the theme.
 */
export const PANEL = {
  top: '#1e2734',
  bottom: '#090c11',
  text: '#e6edf3',
  textDim: '#8b949e',
  track: '#1c2430',
};

/**
 * The play field: a neon arcade screen, the same in both themes. Invaders are
 * coloured by contribution level, cool to hot, and worth more the hotter they are.
 */
export const SCREEN = {
  bg: '#0a0620',
  nebulaA: '#ff2bd6',
  nebulaB: '#2bd9ff',
  dot: '#2c2552',
  invader: ['', '#3ad7ff', '#4dff6a', '#ffd23a', '#ff3ea5'] as const,
  points: [0, 10, 20, 30, 50] as const,
  stars: ['#ffffff', '#9ff3ff', '#ffb3ec', '#fff3a3'] as const,
  laser: '#7df9ff',
  phosphor: '#4dff6a',
  white: '#eef2f6',
  red: '#ff2e63',
  gold: '#ffd23a',
  dim: '#a39fc9',
  /** The ship: a pale hull, cyan glass and a warm engine flame. */
  hull: '#e8ecf4',
  cockpit: '#2bd9ff',
  flame: '#ffb02e',
  /** The neon LED gradient: phosphor green through cyan and violet to magenta. */
  neon: ['#4dff6a', '#2bd9ff', '#7b5cff', '#ff2bd6'] as const,
};

export const DARK: Palette = {
  name: 'dark',
  cabinet: '#252e3b',
  cabinetEdge: '#121720',
  accent: '#7b5cff',
  accentDark: '#4b33c4',
  hardware: '#9aa4b0',
};

export const LIGHT: Palette = {
  name: 'light',
  cabinet: '#fdfdfe',
  cabinetEdge: '#dfe3e9',
  accent: '#6a4bff',
  accentDark: '#3f28b0',
  hardware: '#9aa4b0',
};

export const PALETTES = { dark: DARK, light: LIGHT } as const;
export type PaletteName = keyof typeof PALETTES;
