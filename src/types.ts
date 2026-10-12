/** Shared data model for the contribution invaders generator. */

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

/** One day cell in the contribution calendar. */
export interface Day {
  /** ISO date, yyyy-mm-dd ('' for a padding slot before the calendar starts). */
  date: string;
  /** Raw contribution count for the day. */
  count: number;
  /** GitHub quartile level 0 (none) .. 4 (highest). */
  level: ContributionLevel;
}

/**
 * The contribution grid. `weeks[w]` is one column (a calendar week, oldest
 * first); each column holds up to 7 `Day`s indexed by weekday (0 = Sunday).
 */
export interface ContributionGrid {
  weeks: Day[][];
}

/** A single lit cell: one invader. */
export interface SweepCell {
  /** Weekday row, 0..6. */
  row: number;
  level: ContributionLevel;
}

/** One populated column of the grid and its lit cells. */
export interface SweepStep {
  /** Week index (grid column). */
  column: number;
  /** Lit cells (level > 0) in this column, top-to-bottom. */
  cells: SweepCell[];
  /** Running count of lit cells up to and including this column. */
  cumulativeCells: number;
}

/**
 * Deterministic plan of the year: one step per populated column, left-to-right.
 * The renderer turns every lit cell into an invader.
 */
export interface SweepPlan {
  /** Grid width (number of weeks). */
  columns: number;
  /** Grid height (always 7). */
  rows: number;
  /** Ordered steps for populated columns only. */
  steps: SweepStep[];
  /** Total lit cells across the grid. */
  totalCells: number;
  /** True when nothing is lit: the renderer shows the idle SCANNING state. */
  isEmpty: boolean;
}
