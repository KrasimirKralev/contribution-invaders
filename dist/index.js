// src/run.ts
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

// src/version.ts
var VERSION = "0.1.0";
var USER_AGENT = `contribution-invaders/${VERSION}`;

// src/fetch-contributions.ts
var LEVEL = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4
};
var QUERY = `query($login:String!){
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
var EMPTY_SLOT = { date: "", count: 0, level: 0 };
function parseContributions(json) {
  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) {
    throw new Error("No contribution calendar in the response (check the login and the token).");
  }
  return {
    weeks: weeks.map((week) => {
      const days = week?.contributionDays ?? [];
      const placed = [];
      days.forEach((day, i) => {
        const weekday = Number.isInteger(day.weekday) && day.weekday >= 0 && day.weekday <= 6 ? day.weekday : i;
        while (placed.length < weekday) placed.push({ ...EMPTY_SLOT });
        placed[weekday] = {
          date: String(day.date),
          count: Number(day.contributionCount) || 0,
          level: LEVEL[day.contributionLevel] ?? 0
        };
      });
      return placed;
    })
  };
}
async function fetchContributions(login, token, fetchImpl = fetch) {
  const res = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    },
    body: JSON.stringify({ query: QUERY, variables: { login } })
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.errors) {
    const messages = json.errors.map((e) => e?.message ?? "unknown error");
    throw new Error(`GitHub GraphQL errors: ${messages.join("; ")}`);
  }
  if (!json?.data?.user) {
    throw new Error(`No GitHub user called "${login}".`);
  }
  return parseContributions(json);
}

// src/palette.ts
var PANEL = {
  top: "#1e2734",
  bottom: "#090c11",
  text: "#e6edf3",
  textDim: "#8b949e",
  track: "#1c2430"
};
var SCREEN = {
  bg: "#0a0620",
  nebulaA: "#ff2bd6",
  nebulaB: "#2bd9ff",
  dot: "#2c2552",
  invader: ["", "#3ad7ff", "#4dff6a", "#ffd23a", "#ff3ea5"],
  points: [0, 10, 20, 30, 50],
  stars: ["#ffffff", "#9ff3ff", "#ffb3ec", "#fff3a3"],
  laser: "#7df9ff",
  phosphor: "#4dff6a",
  white: "#eef2f6",
  red: "#ff2e63",
  gold: "#ffd23a",
  dim: "#a39fc9",
  /** The ship: a pale hull, cyan glass and a warm engine flame. */
  hull: "#e8ecf4",
  cockpit: "#2bd9ff",
  flame: "#ffb02e",
  /** The neon LED gradient: phosphor green through cyan and violet to magenta. */
  neon: ["#4dff6a", "#2bd9ff", "#7b5cff", "#ff2bd6"]
};
var DARK = {
  name: "dark",
  cabinet: "#252e3b",
  cabinetEdge: "#121720",
  accent: "#7b5cff",
  accentDark: "#4b33c4",
  hardware: "#9aa4b0"
};
var LIGHT = {
  name: "light",
  cabinet: "#fdfdfe",
  cabinetEdge: "#dfe3e9",
  accent: "#6a4bff",
  accentDark: "#3f28b0",
  hardware: "#9aa4b0"
};
var PALETTES = { dark: DARK, light: LIGHT };

// src/inputs.ts
var DEFAULT_OUTPUTS = "dist/invaders.svg\ndist/invaders-dark.svg?palette=dark";
var LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
function validateLogin(raw) {
  const login = raw.trim().replace(/^@/, "");
  if (!login) {
    throw new Error("github_user_name is empty: set it to the GitHub login whose graph to draw.");
  }
  if (!LOGIN.test(login)) {
    throw new Error(`github_user_name "${raw}" is not a valid GitHub login.`);
  }
  return login;
}
function parseOutputs(text) {
  const targets = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [path = "", query = ""] = line.split("?", 2);
    if (!path.trim()) throw new Error(`outputs line "${line}" has no file name.`);
    let palette = "light";
    for (const [key, value] of new URLSearchParams(query)) {
      if (key !== "palette") {
        throw new Error(`outputs line "${line}": unknown option "${key}" (supported: palette).`);
      }
      if (!(value in PALETTES)) {
        throw new Error(`outputs line "${line}": palette must be one of ${Object.keys(PALETTES).join(", ")}.`);
      }
      palette = value;
    }
    return { path: path.trim(), palette };
  });
  if (targets.length === 0) throw new Error("outputs is empty: list at least one .svg file to write.");
  return targets;
}
function readInputs(env) {
  const input = (name) => env[`INPUT_${name.toUpperCase()}`]?.trim() ?? "";
  const token = input("github_token");
  if (!token) {
    throw new Error("github_token is empty: the default is the workflow token, so pass one only to see private contributions.");
  }
  return {
    login: validateLogin(input("github_user_name")),
    token,
    outputs: parseOutputs(input("outputs") || DEFAULT_OUTPUTS),
    title: input("title"),
    seed: input("seed") || "daily"
  };
}

// src/plan-sweep.ts
function planSweep(grid) {
  const steps = [];
  let cumulativeCells = 0;
  grid.weeks.forEach((week, column) => {
    const cells = [];
    week.forEach((day, row) => {
      if (day.level > 0) {
        cells.push({ row, level: day.level });
      }
    });
    if (cells.length > 0) {
      cumulativeCells += cells.length;
      steps.push({ column, cells, cumulativeCells });
    }
  });
  return {
    columns: grid.weeks.length,
    rows: 7,
    steps,
    totalCells: cumulativeCells,
    isEmpty: cumulativeCells === 0
  };
}

// src/pixel-art.ts
var FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#.."],
  ":": [".....", "..#..", ".....", ".....", ".....", "..#..", "....."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".####"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"]
};
var ADVANCE = 6;
var hasGlyph = (ch) => ch === " " || ch in FONT;
function toPixelText(s, maxLength = 40) {
  const upper = s.toUpperCase().replace(/\s+/g, " ").trim();
  return [...upper].map((ch) => hasGlyph(ch) ? ch : "?").join("").slice(0, maxLength);
}
var INVADER = {
  w: 11,
  h: 8,
  a: [
    "##.......##",
    "#.........#",
    "##..#.#..##",
    ".#.#####.#.",
    "..##.#.##..",
    ".####.####.",
    "#..#####..#",
    ".#.#...#.#."
  ],
  b: [
    ".##.....##.",
    "##.#...#.##",
    ".#..#.#..#.",
    ".#.#####.#.",
    "..##.#.##..",
    ".####.####.",
    "#..#####..#",
    "..#.#.#.#.."
  ]
};
var BOOM = {
  w: 11,
  h: 9,
  rows: [
    ".....#.....",
    ".#...#...#.",
    "..#.###.#..",
    "...#####...",
    "##.#####.##",
    "...#####...",
    "..#.###.#..",
    ".#...#...#.",
    ".....#....."
  ]
};
var BOMB = { w: 3, h: 7, rows: ["#..", ".#.", "..#", ".#.", "#..", ".#.", "..#"] };
var SAUCER = {
  w: 17,
  h: 8,
  rows: [
    ".......###.......",
    ".....##...##.....",
    "....#.#...#.#....",
    "....#.......#....",
    "..#############..",
    "##.###.###.###.##",
    "...###########...",
    "..#..#.....#..#.."
  ]
};
var SHIP = {
  w: 15,
  h: 11,
  rows: [
    ".......#.......",
    "......###......",
    "......#c#......",
    ".....##c##.....",
    "..#..#####..#..",
    "..#.#######.#..",
    ".##.#######.##.",
    "###############",
    "####.#####.####",
    "##...##.##...##",
    ".....ff.ff....."
  ]
};
function bitmapPath(rows, on = "#") {
  const d = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== on) {
        x++;
        continue;
      }
      let run3 = 1;
      while (row[x + run3] === on) run3++;
      d.push(`M${x} ${y}h${run3}v1h-${run3}z`);
      x += run3;
    }
  });
  return d.join("");
}
var glyphId = (ch) => `g${ch.charCodeAt(0)}`;
function glyphDefs(texts) {
  const used = new Set(texts.join("").replace(/ /g, ""));
  return [...used].sort().map((ch) => {
    const bitmap = FONT[ch];
    if (!bitmap) throw new Error(`pixel font has no glyph for "${ch}"`);
    return `<path id="${glyphId(ch)}" d="${bitmapPath(bitmap)}" shape-rendering="crispEdges"/>`;
  }).join("");
}
var textWidth = (s, px2) => (s.length * ADVANCE - 1) * px2;
function pixelText(s, x, y, o) {
  const w = textWidth(s, o.px);
  const left = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  const uses = [...s].map((ch, i) => ch === " " ? "" : `<use href="#${glyphId(ch)}" x="${i * ADVANCE}"/>`).join("");
  const r = (n) => Math.round(n * 100) / 100;
  return `<g${o.cls ? ` class="${o.cls}"` : ""} fill="${o.fill}" transform="translate(${r(left)} ${r(y)}) scale(${o.px})">${uses}</g>`;
}
function glyphUse(ch, xFontPx, cls) {
  return `<use href="#${glyphId(ch)}" x="${xFontPx}"${cls ? ` class="${cls}"` : ""}/>`;
}

// src/shuffle.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// src/timeline.ts
var APPROACH = 3;
var SWEEP_END = 88;
var RESET_START = 94;
var MISS_ODDS = 12;
var BONUS_MIN = 8;
var DEATH_MIN = 20;
var DEATH_AFTER = [0.32, 0.71];
var SHIP_SPEED = 70;
var SETTLE = 0.08;
var LASER = 0.12;
var BOOM2 = 0.2;
var MISS_FLIGHT = 0.2;
var UPSET = 0.32;
var BONUS_WAIT = 1.2;
var BONUS_AFTER = 0.8;
var DEATH_FALL = 0.7;
var DEATH_BLOWN = 0.6;
var DEATH_BLINK = 1;
var MIN_LOOP_S = 20;
function pickMisses(count, seed) {
  const rng = mulberry32(seed ^ 24301);
  const misses = /* @__PURE__ */ new Set();
  for (let j = 0; j < count; j++) {
    if (rng() < 1 / MISS_ODDS && j > 0) misses.add(j);
  }
  return misses;
}
function planTimeline({ moves, reaimPx = 7.5 }, seed) {
  const count = moves.length;
  const misses = pickMisses(count, seed);
  const bonusBefore = count >= BONUS_MIN ? Math.floor(count / 2) : -1;
  const deathsAfter = count >= DEATH_MIN ? DEATH_AFTER.map((f) => Math.floor(count * f)) : [];
  const slots = [];
  for (let j = 0; j < count; j++) {
    if (j === bonusBefore) slots.push({ kind: "bonus" });
    slots.push({ kind: "shot", j });
    if (deathsAfter.includes(j)) slots.push({ kind: "death", after: j });
  }
  const travel = (px2) => px2 / SHIP_SPEED;
  const plans = slots.map((slot) => {
    if (slot.kind === "bonus") return [0, BONUS_WAIT, BONUS_WAIT + LASER, BONUS_WAIT + LASER + BONUS_AFTER];
    if (slot.kind === "death") return [0, DEATH_FALL, DEATH_FALL + DEATH_BLOWN, DEATH_FALL + DEATH_BLOWN + DEATH_BLINK];
    const move = travel(moves[slot.j]);
    if (!misses.has(slot.j)) {
      return [0, move, move + SETTLE, move + SETTLE + LASER, move + SETTLE + LASER + BOOM2];
    }
    const missFire = move + SETTLE;
    const missTop = missFire + MISS_FLIGHT;
    const reaim = missTop + UPSET;
    const aim = reaim + travel(reaimPx);
    return [0, move, missFire, missTop, reaim, aim, aim + SETTLE, aim + SETTLE + LASER, aim + SETTLE + LASER + BOOM2];
  });
  const totalS = plans.reduce((a, m) => a + m[m.length - 1], 0) || 1;
  const pct = (SWEEP_END - APPROACH) / totalS;
  const shots = [];
  const deaths = [];
  let bonus;
  let cursor = APPROACH;
  slots.forEach((slot, i) => {
    const m = plans[i].map((sec) => cursor + sec * pct);
    if (slot.kind === "bonus") {
      bonus = { before: bonusBefore, start: m[0], aim: m[0], fire: m[1], hit: m[2], done: m[3] };
    } else if (slot.kind === "death") {
      deaths.push({ after: slot.after, start: m[0], impact: m[1], respawn: m[2], done: m[3] });
    } else if (m.length === 5) {
      shots.push({ start: m[0], aim: m[1], fire: m[2], hit: m[3], done: m[4] });
    } else {
      shots.push({
        start: m[0],
        miss: { aim: m[1], fire: m[2], top: m[3], reaim: m[4] },
        aim: m[5],
        fire: m[6],
        hit: m[7],
        done: m[8]
      });
    }
    cursor = m[m.length - 1];
  });
  const durationS = Math.max(MIN_LOOP_S, totalS / ((SWEEP_END - APPROACH) / 100));
  return { shots, bonus, deaths, durationS };
}
var STEP_X = 3;
var STEPS_ACROSS = 5;
var DROP = 2;
var MAX_DROPS = 10;
var SLOWEST = 1.4;
var FASTEST = 0.18;
var MARCH_RANGE = { x: STEPS_ACROSS * STEP_X, y: MAX_DROPS * DROP };
function planMarch(t) {
  const hits = t.shots.map((s) => s.hit).sort((a, b) => a - b);
  const total = Math.max(1, hits.length);
  const steps = [];
  let at2 = 0;
  let downed = 0;
  for (let k = 0; at2 < RESET_START; k++) {
    while (downed < hits.length && hits[downed] <= at2) downed++;
    const phase = k % (STEPS_ACROSS * 2);
    steps.push({
      at: at2,
      x: (phase <= STEPS_ACROSS ? phase : STEPS_ACROSS * 2 - phase) * STEP_X,
      y: Math.min(Math.floor(k / STEPS_ACROSS), MAX_DROPS) * DROP,
      frame: k % 2
    });
    const alive = Math.max(1, total - downed) / total;
    at2 += Math.max(FASTEST, SLOWEST * alive ** 0.7);
  }
  return steps;
}
function marchAt(steps, pct) {
  if (pct >= RESET_START || steps.length === 0) return { x: 0, y: 0 };
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = lo + hi + 1 >> 1;
    if (steps[mid].at <= pct) lo = mid;
    else hi = mid - 1;
  }
  return { x: steps[lo].x, y: steps[lo].y };
}
var run = (dir) => dir < 0 ? "runLeft" : dir > 0 ? "runRight" : "idle";
function poseChanges(t, moves) {
  const changes = [{ at: 0, pose: "idle" }];
  t.shots.forEach((s, j) => {
    if (t.bonus && t.bonus.before === j) changes.push({ at: t.bonus.start, pose: "idle" });
    const d = moves.shots[j];
    if (s.miss) {
      changes.push(
        { at: s.start, pose: run(d.miss ?? 0) },
        { at: s.miss.aim, pose: "idle" },
        { at: s.miss.top, pose: "failed" },
        { at: s.miss.reaim, pose: run(d.main) }
      );
    } else {
      changes.push({ at: s.start, pose: run(d.main) });
    }
    changes.push({ at: s.aim, pose: "idle" });
    for (const death of t.deaths.filter((x) => x.after === j)) {
      changes.push({ at: death.impact, pose: "dead" }, { at: death.respawn, pose: "idle" });
    }
  });
  changes.push({ at: SWEEP_END, pose: "jump" }, { at: RESET_START, pose: run(moves.home) });
  const unique = changes.filter((c, i) => i === changes.length - 1 || changes[i + 1].at > c.at);
  return unique.filter((c, i) => i === 0 || c.pose !== unique[i - 1].pose);
}

// src/cabinet.ts
var round = (n) => String(Math.round(n * 100) / 100);
var CELL = 13;
var GAP = 2;
var PITCH = CELL + GAP;
var ROWS = 7;
var OUTER = 4;
var SIDE = 18;
var HEADER_H = 66;
var LED_GAP = 14;
var GAP_V = 10;
var GLASS_PAD_X = 20;
var GRID_DROP = 22;
var LASER_LANE = 56;
var SHIP_PX = 3;
var SHIP_W = SHIP.w * SHIP_PX;
var SHIP_H = SHIP.h * SHIP_PX;
var DECK_H = 64;
var LIVES_ROW = 22;
var INVADER_PX = 2;
var MARCH = 18;
var STARS = 80;
var TEXT = {
  tagline: "CONTRIBUTION INVADERS",
  score: "SCORE<1>",
  hiScore: "HI-SCORE",
  round: "WAVE",
  collected: "CLEARED",
  ready: "READY!",
  clear: "ROUND CLEAR!",
  scanning: "SCANNING...",
  credit: "CREDIT 01",
  hits: "HITS",
  accuracy: "ACCURACY",
  streak: "BEST STREAK",
  days: "DAYS",
  combo: "COMBO X",
  mystery: "MYSTERY",
  pts: "PTS",
  miss: "MISS"
};
var DATA_CHARS = "0123456789+%X!-=";
function layout(cols) {
  const cabX = OUTER;
  const header = { x: cabX + SIDE, y: OUTER + 10, w: 0, h: HEADER_H };
  const glassTop = header.y + HEADER_H + LED_GAP;
  const gridLeft = cabX + SIDE + GLASS_PAD_X;
  const gridTop = glassTop + GRID_DROP;
  const gridW = cols * PITCH - GAP;
  const gridH = ROWS * PITCH - GAP;
  const shipTop = gridTop + gridH + MARCH_RANGE.y + LASER_LANE;
  const groundY = shipTop + SHIP_H + 3;
  const glass = {
    x: cabX + SIDE,
    y: glassTop,
    w: GLASS_PAD_X + gridW + MARCH_RANGE.x + GLASS_PAD_X,
    h: groundY + LIVES_ROW - glassTop
  };
  header.w = glass.w;
  const deck = { x: glass.x, y: glass.y + glass.h + GAP_V, w: glass.w, h: DECK_H };
  const cabW = glass.x + glass.w + SIDE - cabX;
  const cabH = deck.y + DECK_H + 12 - OUTER;
  return {
    width: cabX + cabW + OUTER,
    height: OUTER + cabH + OUTER,
    cols,
    gridLeft,
    gridTop,
    gridW,
    gridH,
    shipTop,
    groundY,
    header,
    ledY: header.y + HEADER_H + LED_GAP / 2 - 1.5,
    glass,
    deck
  };
}
var scoreDigits = (total) => Math.max(4, String(total).length);
var SCORE_PX = 3;
var LABEL_PX = 1.4;
function hud(l) {
  const d = l.deck;
  return {
    scoreX: d.x + 20,
    scoreY: d.y + 24,
    scorePx: SCORE_PX,
    barX: d.x + 170,
    barY: d.y + 26,
    barW: Math.max(40, d.w - 340),
    legendY: d.y + 42
  };
}
function defs(l, p, texts = []) {
  const dark = p.name === "dark";
  const v = (id, stops) => `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">` + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === void 0 ? "" : ` stop-opacity="${a}"`}/>`).join("") + `</linearGradient>`;
  const h = (id, stops) => v(id, stops).replace('x2="0" y1="0" y2="1"', 'x2="1" y1="0" y2="0"');
  const clip = (id, r, rx) => `<clipPath id="${id}"><rect x="${r.x}" y="${round(r.y)}" width="${r.w}" height="${round(r.h)}" rx="${rx}"/></clipPath>`;
  return `<defs>` + glyphDefs([...Object.values(TEXT), DATA_CHARS, ...texts]) + `<g shape-rendering="crispEdges"><path id="invA" d="${bitmapPath(INVADER.a)}"/><path id="invB" d="${bitmapPath(INVADER.b)}"/><path id="saucer" d="${bitmapPath(SAUCER.rows)}"/><path id="boom" d="${bitmapPath(BOOM.rows)}"/><path id="bomb" d="${bitmapPath(BOMB.rows)}"/><path id="hull" d="${bitmapPath(SHIP.rows, "#")}"/><path id="cockpit" d="${bitmapPath(SHIP.rows, "c")}"/><path id="flame" d="${bitmapPath(SHIP.rows, "f")}"/></g>` + v("body", [[0, p.cabinet], [1, p.cabinetEdge]]) + v("chrome", [[0, "#f5f7fa"], [0.42, "#a3acb9"], [0.5, "#5f6a7a"], [1, "#d9dee5"]]) + // Panel edges: the same metal, darker, so a border reads as trim rather than an outline.
  v("trim", dark ? [[0, "#8d97a6"], [0.5, "#3a4351"], [1, "#6b7584"]] : [[0, "#d5dae1"], [0.5, "#9aa3af"], [1, "#c3c9d1"]]) + v("panel", [[0, PANEL.top], [1, PANEL.bottom]]) + v("acrylic", [[0, "#fff", 0.1], [1, "#fff", 0]]) + h("sweep", [[0, "#fff", 0], [0.5, "#fff", 0.95], [1, "#fff", 0]]) + h("shine", [[0, "#fff", 0], [0.5, "#fff", 0.06], [1, "#fff", 0]]) + h("neonH", SCREEN.neon.map((c, i) => [i / (SCREEN.neon.length - 1), c])) + v("neonV", SCREEN.neon.map((c, i) => [i / (SCREEN.neon.length - 1), c])) + `<radialGradient id="nebulaA" cx=".22" cy=".25" r=".45"><stop offset="0" stop-color="${SCREEN.nebulaA}" stop-opacity=".28"/><stop offset="1" stop-color="${SCREEN.nebulaA}" stop-opacity="0"/></radialGradient><radialGradient id="nebulaB" cx=".8" cy=".8" r=".5"><stop offset="0" stop-color="${SCREEN.nebulaB}" stop-opacity=".22"/><stop offset="1" stop-color="${SCREEN.nebulaB}" stop-opacity="0"/></radialGradient><radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient><filter id="glow" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="3"/></filter><filter id="bloom" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><pattern id="scanlines" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".32"/></pattern><pattern id="segments" x="${round(hud(l).barX)}" width="7" height="8" patternUnits="userSpaceOnUse"><rect x="5" width="2" height="8" fill="${PANEL.bottom}"/></pattern>` + clip("glassClip", l.glass, 8) + clip("headerClip", l.header, 12) + `<clipPath id="ledClip"><rect x="${l.header.x + 10}" y="${round(l.ledY)}" width="${l.header.w - 20}" height="3"/></clipPath><pattern id="sockets" x="${l.gridLeft}" y="${round(l.gridTop)}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse"><rect x="${(CELL - 3) / 2}" y="${(CELL - 3) / 2}" width="3" height="3" fill="${SCREEN.dot}"/></pattern></defs>`;
}
function shipMarkup(w, cls, flame = true) {
  return `<g${cls ? ` class="${cls}"` : ""}><g transform="scale(${round(w / SHIP.w)})"><use href="#hull" fill="${SCREEN.hull}"/><use href="#cockpit" fill="${SCREEN.cockpit}"/>` + (flame ? `<use href="#flame" class="flame" fill="${SCREEN.flame}"/>` : "") + `</g></g>`;
}
function shipCss() {
  return `.flame{animation:flame .24s steps(1) infinite}@keyframes flame{50%{opacity:.35}}`;
}
function cabinetBody(l, p) {
  const { glass, deck } = l;
  const stripY = glass.y;
  const stripH = deck.y + deck.h - glass.y;
  const strip = (x) => `<rect x="${x}" y="${stripY}" width="3" height="${round(stripH)}" rx="1.5" fill="url(#neonV)" filter="url(#glow)" opacity=".9"/><rect x="${x}" y="${stripY}" width="3" height="${round(stripH)}" rx="1.5" fill="url(#neonV)"/>`;
  return `<rect class="cabinet" x="4" y="4" width="${l.width - 8}" height="${round(l.height - 8)}" rx="18" fill="url(#body)" stroke="url(#trim)" stroke-width="1.5"/><rect x="7" y="7" width="${l.width - 14}" height="${round(l.height - 14)}" rx="15" fill="none" stroke="#fff" stroke-opacity=".08"/>` + // LED strips down both sides.
  strip(11) + strip(l.width - 14);
}
var invaderCellW = INVADER.w * INVADER_PX + 8;
var formationWidth = (cols) => cols * invaderCellW - 8;
function formation(x, y, cols, rows, colors) {
  const cellH = INVADER.h * INVADER_PX + 6;
  const frame = (id, cls) => `<g class="${cls}">` + Array.from(
    { length: rows },
    (_, r) => Array.from(
      { length: cols },
      (_2, c) => `<use href="#${id}" x="${c * invaderCellW / INVADER_PX}" y="${r * cellH / INVADER_PX}" fill="${colors[r % colors.length]}"/>`
    ).join("")
  ).join("") + `</g>`;
  return `<g class="march"><g transform="translate(${round(x)} ${round(y)}) scale(${INVADER_PX})">` + frame("invA", "fa") + frame("invB", "fb") + `</g></g>`;
}
var titlePx = (title, headerW) => Math.min(3, Math.round(headerW * 0.4 / Math.max(1, textWidth(title, 1)) * 100) / 100);
function headerMarkup(l, p, title) {
  const m = l.header;
  const cx = m.x + m.w / 2;
  const px2 = titlePx(title, m.w);
  const logoW = textWidth(title, px2);
  const side = (m.w - logoW) / 2;
  const cols = Math.max(1, Math.min(5, Math.floor((side - 60) / invaderCellW)));
  const fw = formationWidth(cols);
  const fy = m.y + 14;
  const leftX = m.x + side / 2 - fw / 2 - MARCH / 2;
  const rightX = cx + logoW / 2 + side / 2 - fw / 2 - MARCH / 2;
  const colors = [SCREEN.invader[4], SCREEN.invader[1]];
  return `<g class="header"><rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="12" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/><g clip-path="url(#headerClip)">` + formation(leftX, fy, cols, 2, colors) + formation(rightX, fy, cols, 2, colors) + `<g class="saucer"><use href="#saucer" transform="translate(${m.x} ${m.y + 3}) scale(1.5)" fill="${SCREEN.red}"/></g><g class="title" filter="url(#bloom)">${pixelText(title, cx, m.y + 23 - 3.5 * px2, { px: px2, fill: SCREEN.white, anchor: "middle" })}</g><g filter="url(#bloom)">${pixelText(TEXT.tagline, cx, m.y + m.h - 15, { px: 1.2, fill: SCREEN.gold, anchor: "middle" })}</g><rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="url(#scanlines)"/></g><rect x="${m.x + 14}" y="${m.y + 2.5}" width="${m.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".16"/></g><g class="led"><rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="url(#neonH)" filter="url(#glow)"/><rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="url(#neonH)"/><g clip-path="url(#ledClip)"><rect class="sweep" x="${m.x}" y="${round(l.ledY)}" width="140" height="3" fill="url(#sweep)"/></g></g>`;
}
function headerCss(l) {
  const m = l.header;
  return (
    // The classic step: the formation hops across, turns, hops back; the legs swap each hop.
    `.march{animation:march 6s steps(9) infinite}@keyframes march{0%,100%{transform:translateX(0)}50%{transform:translateX(${MARCH}px)}}.fa,.fb{animation:flip .66s steps(1) infinite}.fb{animation-delay:-.33s}@keyframes flip{0%{opacity:1}50%{opacity:0}}.saucer{animation:saucer 17s linear infinite}@keyframes saucer{0%{transform:translateX(-40px)}38%,100%{transform:translateX(${round(m.w + 40)}px)}}.sweep{animation:sweep 4.5s ease-in-out infinite}@keyframes sweep{0%{transform:translateX(-160px)}60%,100%{transform:translateX(${round(m.w + 20)}px)}}`
  );
}
function screenMarkup(l, seed) {
  const g = l.glass;
  const rng = mulberry32(seed ^ 22437);
  const stars = Array.from({ length: STARS }, (_, i) => {
    const x = g.x + 6 + rng() * (g.w - 12);
    const y = g.y + 6 + rng() * (g.h - 12);
    const s = rng() < 0.2 ? 2 : 1.2;
    return `<rect class="star s${i % 3}" x="${round(x)}" y="${round(y)}" width="${s}" height="${s}" fill="${SCREEN.stars[i % SCREEN.stars.length]}"/>`;
  }).join("");
  return `<rect class="glass" x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" rx="8" fill="${SCREEN.bg}" stroke="url(#trim)" stroke-width="1.5"/><g clip-path="url(#glassClip)"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#nebulaA)"/><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#nebulaB)"/>` + stars + `<rect class="ground" x="${g.x + 10}" y="${round(l.groundY)}" width="${g.w - 20}" height="2" fill="${SCREEN.phosphor}" opacity=".9"/>` + pixelText(TEXT.credit, g.x + g.w - 16, l.groundY + 8, { px: 1.2, fill: SCREEN.dim, anchor: "end" }) + `</g>`;
}
function screenOverlay(l) {
  const g = l.glass;
  return `<g clip-path="url(#glassClip)" class="crt"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#scanlines)"/><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#vignette)"/><g class="shine"><polygon points="${g.x},${round(g.y + g.h)} ${g.x + 60},${g.y} ${g.x + 130},${g.y} ${g.x + 70},${round(g.y + g.h)}" fill="url(#shine)"/></g></g>`;
}
function screenCss(l) {
  return `.star{animation:twinkle 3.2s steps(1) infinite}.s1{animation-delay:-1.1s}.s2{animation-delay:-2.2s}@keyframes twinkle{0%{opacity:.9}40%{opacity:.25}70%{opacity:.6}}.shine{animation:shine 9s ease-in-out infinite}@keyframes shine{0%{transform:translateX(-160px)}55%,100%{transform:translateX(${round(l.glass.w + 40)}px)}}.blink{animation:blink 1.2s steps(1) infinite}@keyframes blink{50%{opacity:.15}}`;
}
function socketsMarkup(l) {
  return `<rect x="${l.gridLeft}" y="${round(l.gridTop)}" width="${l.gridW}" height="${l.gridH}" fill="url(#sockets)"/>`;
}
function banner(l, text, cls, fill) {
  const px2 = 3;
  const cx = l.gridLeft + l.gridW / 2;
  const cy = l.gridTop + l.gridH / 2;
  const w = textWidth(text, px2);
  const h = 7 * px2;
  return `<g class="${cls}"><rect x="${round(cx - w / 2 - 14)}" y="${round(cy - h / 2 - 10)}" width="${round(w + 28)}" height="${h + 20}" rx="4" fill="${SCREEN.bg}" opacity=".85"/><g filter="url(#bloom)">${pixelText(text, cx, cy - h / 2, { px: px2, fill, anchor: "middle" })}</g></g>`;
}
function panel(l, lines, cls) {
  const cx = l.gridLeft + l.gridW / 2;
  const gap = 8;
  const height = lines.reduce((a, ln) => a + ln.px * 7, 0) + gap * (lines.length - 1);
  const width = Math.max(...lines.map((ln) => textWidth(ln.text, ln.px)));
  let y = l.gridTop + l.gridH / 2 - height / 2 + 10;
  const rows = lines.map((ln) => {
    const row = pixelText(ln.text, cx, y, { px: ln.px, fill: ln.fill, anchor: "middle", cls: ln.cls });
    y += ln.px * 7 + gap;
    return row;
  });
  return `<g class="${cls}"><rect x="${round(cx - width / 2 - 22)}" y="${round(l.gridTop + l.gridH / 2 - height / 2 - 4)}" width="${round(width + 44)}" height="${round(height + 28)}" rx="6" fill="${SCREEN.bg}" opacity=".9" stroke="url(#neonH)" stroke-width="1.5"/><g filter="url(#bloom)">${rows.join("")}</g></g>`;
}
function deckMarkup(l, p, total, date) {
  const d = l.deck;
  const s = hud(l);
  const right = d.x + d.w - 20;
  const bar = `x="${round(s.barX)}" y="${round(s.barY)}" width="${round(s.barW)}" height="8" rx="1"`;
  const hi = String(total).padStart(scoreDigits(total), "0");
  return `<rect x="${d.x}" y="${round(d.y)}" width="${d.w}" height="${d.h}" rx="10" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/><rect x="${d.x + 14}" y="${round(d.y + 2.5)}" width="${d.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".12"/><g class="hud" filter="url(#bloom)">` + pixelText(TEXT.score, s.scoreX, d.y + 11, { px: LABEL_PX, fill: SCREEN.white }) + pixelText(TEXT.hiScore, right, d.y + 11, { px: LABEL_PX, fill: SCREEN.white, anchor: "end" }) + pixelText(hi, right, s.scoreY, { px: SCORE_PX, fill: SCREEN.gold, anchor: "end" }) + pixelText(date ? `${TEXT.round} ${date}` : TEXT.round, s.barX, d.y + 14, { px: LABEL_PX, fill: SCREEN.dim }) + pixelText(TEXT.collected, s.barX + s.barW, d.y + 14, { px: LABEL_PX, fill: SCREEN.dim, anchor: "end" }) + `</g><g class="progress-meter"><rect ${bar} fill="${PANEL.track}"/><rect class="progress" ${bar} fill="url(#neonH)" filter="url(#glow)"/><rect class="progress" ${bar} fill="url(#neonH)"/><rect ${bar} fill="url(#segments)"/></g>` + pointsTable(s.barX, s.legendY, s.barW);
}
function pointsTable(x, y, w) {
  const cols = SCREEN.invader.length - 1;
  const step = w / cols;
  return `<g class="points-table">` + Array.from({ length: cols }, (_, i) => {
    const level = i + 1;
    const cx = x + step * i + step / 2 - 22;
    return `<use href="#invA" transform="translate(${round(cx)} ${round(y)}) scale(1.1)" fill="${SCREEN.invader[level]}"/>` + pixelText(`= ${SCREEN.points[level]} ${TEXT.pts}`, cx + 18, y + 1.5, { px: 1.1, fill: SCREEN.dim });
  }).join("") + `</g>`;
}
function deckCss() {
  return `.progress{transform-box:fill-box;transform-origin:0 50%}`;
}

// src/render-svg.ts
var LASER_H = 9;
var EPS = 0.02;
var BOOM_SPAN = 0.45;
var POPUP_SPAN = 1.2;
var COMBO_EVERY = 10;
var COMBO_SPAN = 1.6;
var ROW_STAGGER = 0.7;
var LIVES = 3;
var MYSTERY_POINTS = 300;
var BOMB_EVERY = 2.2;
var BOMB_FALL = 1.4;
var BOMB_CLEAR = 36;
var SAUCER_PX = 2;
var SAUCER_CROSS = 7;
var MIN_STEP = 2;
var PLAN_PASSES = 4;
var CONFETTI = 22;
var HOP = 8;
var px = (n) => String(Math.round(n * 10) / 10);
var at = (x, y) => `transform:translate(${px(x)}px,${px(y)}px)`;
var keyframes = (name, stops) => `@keyframes ${name}{${stops.map(([t, css]) => `${round(t)}%{${css}}`).join("")}}`;
var shownBetween = (from, to) => [
  [0, "opacity:0"],
  [from, "opacity:1"],
  [to, "opacity:0"]
];
function renderSvg(plan, p, opts = {}) {
  const l = layout(plan.columns);
  const seed = opts.seed ?? 1;
  const h = hud(l);
  const login = opts.login ?? "";
  const title = toPixelText(opts.title ?? "") || toPixelText(login ? `@${login}` : "PLAYER 1");
  const who = login ? `@${login}'s` : "A";
  const ship = (body, homeX2) => `<g class="ship" transform="translate(${round(homeX2)} 0)"><g class="respawn"><g transform="translate(${round(-SHIP_W / 2)} ${round(l.shipTop)})"><g class="recoil"><g class="hop"><g class="alive">${body}</g></g></g></g></g></g>`;
  const staticCss = [headerCss(l), deckCss(), screenCss(l), shipCss()];
  const livesText = (lives2) => pixelText(String(lives2), l.glass.x + 16, l.groundY + 8, { px: 1.2, fill: SCREEN.white });
  const lifeIcons = Array.from(
    { length: LIVES },
    (_, i) => `<g transform="translate(${round(l.glass.x + 30 + i * 20)} ${round(l.groundY + 6)})">${shipMarkup(14, `life l${i}`, false)}</g>`
  ).join("");
  if (plan.isEmpty) {
    const digits2 = scoreDigits(0);
    const style2 = [
      ...staticCss,
      `.progress{transform:scaleX(0)}`,
      `.ship{animation:patrol 6s ease-in-out infinite}`,
      `@keyframes patrol{0%,100%{transform:translateX(${round(l.gridLeft + 30)}px)}50%{transform:translateX(${round(l.gridLeft + l.gridW - 30)}px)}}`
    ].join("");
    return [
      svgOpen(l, `${who} contribution graph as an arcade game: no contributions yet, so no invaders today`),
      `<style>${style2}</style>`,
      defs(l, p, [opts.date ?? "", title]),
      cabinetBody(l, p),
      headerMarkup(l, p, title),
      screenMarkup(l, seed),
      deckMarkup(l, p, 0, opts.date),
      pixelText("0".repeat(digits2), h.scoreX, h.scoreY, { px: h.scorePx, fill: SCREEN.phosphor, cls: "score" }),
      livesText(LIVES),
      lifeIcons,
      socketsMarkup(l),
      ship(shipMarkup(SHIP_W), l.glass.x + l.glass.w / 2),
      banner(l, TEXT.scanning, "scanning blink", SCREEN.dim),
      screenOverlay(l),
      `</svg>`
    ].join("");
  }
  const all = plan.steps.flatMap(
    (step) => step.cells.map((cell) => ({ column: step.column, row: cell.row, level: cell.level }))
  );
  const order = firingOrder(all);
  const { t, march, homeX } = planShots(order, l, seed);
  const dur = `${round(t.durationS)}s`;
  const g = geometry(l, march);
  const play = playWave(order, t, g, homeX, seed);
  const changes = poseChanges(t, play.moves);
  const points = order.map((c) => SCREEN.points[c.level]);
  const scoreEvents = [
    ...t.shots.map((s, j) => [s.hit, points[j]]),
    ...t.bonus ? [[t.bonus.hit, MYSTERY_POINTS]] : []
  ].sort((a, b) => a[0] - b[0]);
  const maxScore = scoreEvents.reduce((a, [, v]) => a + v, 0);
  const digits = scoreDigits(maxScore);
  const invaders = order.map((c, j) => {
    const x = round(g.cellLeft(c.column) + (CELL - INVADER.w) / 2);
    const y = round(g.cellTop(c.row) + (CELL - INVADER.h) / 2);
    const fill = SCREEN.invader[c.level];
    return `<g class="h${j}"><use href="#invA" class="la" x="${x}" y="${y}" fill="${fill}"/><use href="#invB" class="lb" x="${x}" y="${y}" fill="${fill}"/></g>`;
  }).join("");
  const booms = order.map(
    (c, j) => `<use href="#boom" class="ex x${j}" x="${round(g.cellLeft(c.column) + (CELL - BOOM.w) / 2)}" y="${round(g.cellTop(c.row) + (CELL - BOOM.h) / 2)}" fill="${SCREEN.invader[c.level]}"/>`
  ).join("");
  const popups = [];
  const popupCss = [];
  const texts = [opts.date ?? "", title];
  const float = (cls, from) => `.${cls}{animation:${cls} ${dur} linear infinite}` + keyframes(cls, [
    [0, `opacity:0;${at(0, 0)}`],
    [from - EPS, `opacity:0;${at(0, 0)}`],
    [from, `opacity:1;${at(0, 0)}`],
    [from + POPUP_SPAN, `opacity:0;${at(0, -14)}`]
  ]);
  t.shots.forEach((s, j) => {
    const text = `+${points[j]}`;
    texts.push(text);
    const [x, y] = play.hitAt[j];
    popups.push(`<g class="pp p${j}">${pixelText(text, x, y - 16, { px: 1.2, fill: SCREEN.invader[order[j].level], anchor: "middle" })}</g>`);
    popupCss.push(float(`p${j}`, s.hit));
  });
  t.shots.forEach((s, j) => {
    const x = play.missAt[j];
    if (!s.miss || x === void 0) return;
    popups.push(`<g class="pp m${j}">${pixelText(TEXT.miss, x, l.shipTop - 18, { px: 1.2, fill: SCREEN.red, anchor: "middle" })}</g>`);
    popupCss.push(float(`m${j}`, s.miss.top));
  });
  if (t.bonus && play.bonusAt) {
    const text = `+${MYSTERY_POINTS}`;
    texts.push(text);
    popups.push(`<g class="pp pbonus">${pixelText(text, play.bonusAt[0], play.bonusAt[1] + 4, { px: 2, fill: SCREEN.gold, anchor: "middle" })}</g>`);
    popupCss.push(float("pbonus", t.bonus.hit));
  }
  const combos = comboMoments(t);
  combos.forEach(([moment, streak], k) => {
    const text = `${TEXT.combo}${streak}!`;
    texts.push(text);
    popups.push(
      pixelText(text, l.gridLeft + l.gridW / 2, l.gridTop + l.gridH + MARCH_RANGE.y + 18, {
        px: 2,
        fill: SCREEN.nebulaA,
        anchor: "middle",
        cls: `cb c${k}x`
      })
    );
    popupCss.push(`.c${k}x{animation:c${k}x ${dur} step-end infinite}` + keyframes(`c${k}x`, shownBetween(moment, moment + COMBO_SPAN)));
  });
  const misses = t.shots.filter((s) => s.miss).length;
  const accuracy = Math.round(100 * t.shots.length / (t.shots.length + misses));
  const statLines = [
    { text: TEXT.clear, px: 3, fill: SCREEN.gold, cls: "blink" },
    { text: `${TEXT.hits} ${t.shots.length}  ${TEXT.accuracy} ${accuracy}%`, px: 1.6, fill: SCREEN.white },
    { text: `${TEXT.streak} ${longestStreak(plan)} ${TEXT.days}`, px: 1.6, fill: SCREEN.invader[1] },
    ...t.bonus ? [{ text: `${TEXT.mystery} +${MYSTERY_POINTS}`, px: 1.6, fill: SCREEN.red }] : []
  ];
  texts.push(...statLines.map((s) => s.text));
  const lifeCss = Array.from({ length: LIVES }, (_, i) => {
    const lost = t.deaths[LIVES - 1 - i];
    return lost ? `.l${i}{animation:l${i} ${dur} step-end infinite}` + keyframes(`l${i}`, [[0, "opacity:1"], [lost.impact, "opacity:0"]]) : "";
  }).join("");
  const livesEvents = t.deaths.map((d) => [d.impact, -1]);
  const score = digitCounter("s", scoreEvents, 0, digits);
  const lives = digitCounter("v", livesEvents, LIVES, 1);
  const fireworks = confettiBurst(l, p, seed);
  const style = [
    ...staticCss,
    `.wave{animation:wave ${dur} step-end infinite}`,
    `.la{animation:legs-a ${dur} step-end infinite}.lb{animation:legs-b ${dur} step-end infinite}`,
    // Linear: the ship walks at one steady pace; each move's time already matches its distance.
    `.ship{animation:ship ${dur} linear infinite}`,
    `.respawn{animation:respawn ${dur} step-end infinite}`,
    `.recoil{animation:recoil ${dur} linear infinite}`,
    `.alive{animation:alive ${dur} step-end infinite}`,
    `.hop{animation:hop ${dur} linear infinite}`,
    `.laser{animation:laser ${dur} linear infinite}`,
    `.ufo{animation:ufo ${dur} linear infinite}`,
    `.progress{animation:progress ${dur} linear infinite}`,
    `.ready{opacity:0;animation:ready ${dur} step-end infinite}`,
    `.round-clear{opacity:0;animation:clear ${dur} step-end infinite}`,
    `.ex,.pp,.cb,.bomb,.splat{opacity:0}`,
    ...order.map((_, j) => `.h${j}{animation:h${j} ${dur} step-end infinite}.x${j}{animation:x${j} ${dur} step-end infinite}`),
    score.css(dur),
    lives.css(dur),
    lifeCss,
    fireworks.css(dur),
    play.bombs.css(dur),
    ...popupCss,
    keyframes("wave", waveFrames(march)),
    keyframes("legs-a", legFrames(march, 0)),
    keyframes("legs-b", legFrames(march, 1)),
    keyframes("ship", play.ship),
    keyframes("respawn", respawnFrames(t)),
    keyframes("recoil", play.recoil),
    keyframes("alive", aliveFrames(changes)),
    keyframes("hop", hopFrames(changes)),
    keyframes("laser", play.laser),
    keyframes("ufo", play.ufo),
    keyframes("progress", progressFrames(t)),
    keyframes("ready", [[0, "opacity:1"], [APPROACH, "opacity:0"]]),
    keyframes("clear", shownBetween(SWEEP_END, RESET_START)),
    ...order.map((c, j) => invaderFrames(j, c, t))
  ].join("");
  return [
    svgOpen(l, `${who} contribution graph as an arcade game: a ship shoots down ${plan.totalCells} invaders, one per active day`),
    `<style>${style}</style>`,
    defs(l, p, texts),
    cabinetBody(l, p),
    headerMarkup(l, p, title),
    screenMarkup(l, seed),
    deckMarkup(l, p, maxScore, opts.date),
    score.markup(h.scoreX, h.scoreY, h.scorePx, SCREEN.phosphor),
    lives.markup(l.glass.x + 16, l.groundY + 8, 1.2, SCREEN.white),
    lifeIcons,
    // The whole year marches as one formation: empty days, invaders and their explosions.
    `<g class="wave">${socketsMarkup(l)}${invaders}${booms}</g>`,
    play.ufoMarkup,
    play.bombs.markup,
    `<rect class="laser" x="-1" y="0" width="2" height="${LASER_H}" fill="${SCREEN.laser}" filter="url(#bloom)"/>`,
    ship(shipMarkup(SHIP_W), homeX),
    play.deathMarkup,
    popups.join(""),
    fireworks.markup,
    banner(l, TEXT.ready, "ready", SCREEN.white),
    panel(l, statLines, "round-clear"),
    // The CRT glass goes over everything on the screen.
    screenOverlay(l),
    `</svg>`
  ].join("");
}
function geometry(l, march) {
  const cellLeft = (col) => l.gridLeft + col * PITCH;
  const cellTop = (row) => l.gridTop + row * PITCH;
  return {
    l,
    march,
    cellLeft,
    cellTop,
    invaderAt: (c, pct) => {
      const m = marchAt(march, pct);
      return [cellLeft(c.column) + CELL / 2 + m.x, cellTop(c.row) + CELL / 2 + m.y];
    }
  };
}
function playWave(order, t, g, homeX, seed) {
  const { l } = g;
  const laserTop = l.shipTop - LASER_H + 2;
  const offTop = l.glass.y - LASER_H - 4;
  const x = (v) => `transform:translateX(${px(v)}px)`;
  const ship = [[0, x(homeX)]];
  const track = [[0, homeX]];
  const laser = [[0, `opacity:0;${at(homeX, laserTop)}`]];
  const recoil = [[0, "transform:translateY(0px)"]];
  const moves = { shots: [], home: 0 };
  const hitAt = [];
  const missAt = [];
  const moveTo = (when, toX) => {
    ship.push([when, x(toX)]);
    track.push([when, toX]);
  };
  const bolt = (bx, fire, end, endY) => {
    laser.push(
      [fire - EPS, `opacity:0;${at(bx, laserTop)}`],
      [fire, `opacity:1;${at(bx, laserTop)}`],
      [end, `opacity:1;${at(bx, endY)}`],
      [end + EPS, `opacity:0;${at(bx, endY)}`]
    );
    recoil.push([fire - 0.1, "transform:translateY(0px)"], [fire, "transform:translateY(2px)"], [fire + 0.15, "transform:translateY(0px)"]);
  };
  const saucerW = SAUCER.w * SAUCER_PX;
  const saucerY = l.glass.y + 5;
  const ufo = [[0, `opacity:0;${at(l.glass.x - saucerW, saucerY)}`]];
  let ufoMarkup = "";
  let bonusAt;
  const saucerStart = l.glass.x - saucerW;
  const saucerSpeed = (l.glass.w + saucerW) / SAUCER_CROSS;
  const deathParts = [];
  const deathCss = [];
  const lethal = [];
  let prev = homeX;
  t.shots.forEach((s, j) => {
    const b = t.bonus;
    if (b && b.before === j) {
      const hitX = prev;
      const hitLeft = hitX - saucerW / 2;
      const enter = Math.max(APPROACH, b.hit - (hitLeft - saucerStart) / saucerSpeed);
      moveTo(b.start, prev);
      bolt(hitX, b.fire, b.hit, saucerY + SAUCER.h * SAUCER_PX - 2);
      ufo.push(
        [enter - EPS, `opacity:0;${at(saucerStart, saucerY)}`],
        [enter, `opacity:1;${at(saucerStart, saucerY)}`],
        [b.hit, `opacity:1;${at(hitLeft, saucerY)}`],
        [b.hit + EPS, `opacity:0;${at(hitLeft, saucerY)}`]
      );
      bonusAt = [hitX, saucerY];
      deathParts.push(
        `<use href="#boom" class="ex xufo" transform="translate(${round(hitX - BOOM.w)} ${round(saucerY)}) scale(2)" fill="${SCREEN.red}"/>`
      );
      deathCss.push(`.xufo{animation:xufo DUR step-end infinite}` + keyframes("xufo", shownBetween(b.hit, b.hit + BOOM_SPAN * 2)));
    }
    const c = order[j];
    const [fireX, cy] = g.invaderAt(c, s.hit);
    const hitY = cy + INVADER.h / 2 - 2;
    hitAt.push([fireX, cy]);
    moveTo(s.start, prev);
    if (s.miss) {
      const wrongX = missSpot(fireX, j);
      missAt[j] = wrongX;
      moveTo(s.miss.aim, wrongX);
      moveTo(s.miss.reaim, wrongX);
      bolt(wrongX, s.miss.fire, s.miss.top, offTop);
      moves.shots.push({ miss: Math.sign(wrongX - prev), main: Math.sign(fireX - wrongX) });
    } else {
      moves.shots.push({ main: Math.sign(fireX - prev) });
    }
    moveTo(s.aim, fireX);
    bolt(fireX, s.fire, s.hit, hitY);
    prev = fireX;
    for (const d of t.deaths.filter((dd) => dd.after === j)) {
      const k = lethal.length;
      const fromY = formationBottom(order, t, g, d.start);
      lethal.push([
        [0, `opacity:0;${at(prev, fromY)}`],
        [d.start - EPS, `opacity:0;${at(prev, fromY)}`],
        [d.start, `opacity:1;${at(prev, fromY)}`],
        [d.impact, `opacity:1;${at(prev, l.shipTop + 10)}`],
        [d.impact + EPS, `opacity:0;${at(prev, l.shipTop + 10)}`]
      ]);
      deathParts.push(
        `<use href="#boom" class="ex xd${k}" transform="translate(${round(prev - BOOM.w * 1.5)} ${round(l.shipTop + 4)}) scale(3)" fill="${SCREEN.red}"/>`
      );
      deathCss.push(`.xd${k}{animation:xd${k} DUR step-end infinite}` + keyframes(`xd${k}`, shownBetween(d.impact, d.respawn - 0.1)));
      moveTo(d.start, prev);
    }
  });
  moves.home = Math.sign(homeX - prev);
  moveTo(RESET_START, prev);
  moveTo(100, homeX);
  laser.push([100, `opacity:0;${at(homeX, laserTop)}`]);
  recoil.push([100, "transform:translateY(0px)"]);
  ufo.push([100, `opacity:0;${at(l.glass.x - saucerW, saucerY)}`]);
  if (t.bonus) {
    ufoMarkup = `<g class="ufo"><use href="#saucer" transform="scale(${SAUCER_PX})" fill="${SCREEN.red}"/></g>`;
  }
  const bombs = invaderBombs(order, t, g, track, lethal, seed);
  return {
    ship,
    laser,
    recoil,
    ufo,
    ufoMarkup,
    moves,
    hitAt,
    missAt,
    bonusAt,
    bombs: {
      markup: bombs.markup,
      css: (dur) => bombs.css(dur) + deathCss.join("").replace(/DUR/g, dur)
    },
    deathMarkup: deathParts.join("")
  };
}
var missSpot = (x, j) => x + (j % 2 === 0 ? PITCH / 2 : -PITCH / 2);
function planShots(order, l, seed) {
  const baseX = order.map((c) => l.gridLeft + c.column * PITCH + CELL / 2);
  const misses = pickMisses(order.length, seed);
  const walks = (xs2) => xs2.map((x, j) => {
    const target = misses.has(j) ? missSpot(x, j) : x;
    return Math.max(MIN_STEP, Math.abs(target - (j === 0 ? xs2[0] : xs2[j - 1])));
  });
  let xs = baseX;
  let t = planTimeline({ moves: walks(xs), reaimPx: PITCH / 2 }, seed);
  for (let pass = 0; pass < PLAN_PASSES; pass++) {
    const march2 = planMarch(t);
    xs = order.map((_, j) => baseX[j] + marchAt(march2, t.shots[j].hit).x);
    t = planTimeline({ moves: walks(xs), reaimPx: PITCH / 2 }, seed);
  }
  const march = planMarch(t);
  return { t, march, homeX: baseX[0] + marchAt(march, t.shots[0].hit).x };
}
function firingOrder(all) {
  const columns = [...new Set(all.map((c) => c.column))].sort((a, b) => a - b);
  const sweep = [...columns.filter((c) => c % 2 === 0), ...columns.filter((c) => c % 2 === 1).reverse()];
  return sweep.flatMap((col) => all.filter((c) => c.column === col).sort((a, b) => b.row - a.row));
}
function formationBottom(order, t, g, pct) {
  let bottom = -Infinity;
  order.forEach((c, j) => {
    if (t.shots[j].hit > pct) bottom = Math.max(bottom, g.invaderAt(c, pct)[1] + INVADER.h / 2);
  });
  return Number.isFinite(bottom) ? bottom : g.l.gridTop + g.l.gridH;
}
function shipXAt(track, pct) {
  let i = 0;
  while (i < track.length - 1 && track[i + 1][0] <= pct) i++;
  const [t0, x0] = track[i];
  const next = track[i + 1];
  if (!next) return x0;
  const [t1, x1] = next;
  return t1 === t0 ? x1 : x0 + (x1 - x0) * (pct - t0) / (t1 - t0);
}
function invaderBombs(order, t, g, track, lethal, seed) {
  const { l } = g;
  const rng = mulberry32(seed ^ 2827);
  const markup = [];
  const rules = [];
  const busy = t.deaths.map((d) => [d.start - 1, d.done]);
  const addBomb = (cls, stops, fill) => {
    markup.push(`<g class="bomb ${cls}"><use href="#bomb" transform="scale(1.6)" fill="${fill}"/></g>`);
    rules.push((dur) => `.${cls}{animation:${cls} ${dur} linear infinite}` + keyframes(cls, stops));
  };
  lethal.forEach((stops, k2) => addBomb(`bl${k2}`, stops, SCREEN.red));
  let k = 0;
  for (let tb = APPROACH + 2; tb < SWEEP_END - BOMB_FALL; tb += BOMB_EVERY * (0.7 + rng() * 0.6)) {
    const land = tb + BOMB_FALL;
    if (busy.some(([a, b]) => land >= a && tb <= b)) continue;
    const standing = order.map((c, j) => [c, j]).filter(([, j]) => t.shots[j].hit > tb + 0.3);
    if (standing.length === 0) break;
    const [pick] = standing[Math.floor(rng() * standing.length)];
    const lowest = standing.filter(([c]) => c.column === pick.column).reduce((a, b) => b[0].row > a[0].row ? b : a);
    const [bx, by] = g.invaderAt(lowest[0], tb);
    if (Math.abs(bx - shipXAt(track, land)) < BOMB_CLEAR) continue;
    const groundY = l.groundY - BOMB_CLEAR / 4;
    addBomb(
      `bb${k}`,
      [
        [0, `opacity:0;${at(bx - 2, by)}`],
        [tb - EPS, `opacity:0;${at(bx - 2, by)}`],
        [tb, `opacity:1;${at(bx - 2, by)}`],
        [land, `opacity:1;${at(bx - 2, groundY)}`],
        [land + EPS, `opacity:0;${at(bx - 2, groundY)}`]
      ],
      SCREEN.gold
    );
    markup.push(
      `<use href="#boom" class="splat s${k}x" transform="translate(${round(bx - 5)} ${round(l.groundY - 6)}) scale(.9)" fill="${SCREEN.red}"/>`
    );
    const kk = k;
    rules.push((dur) => `.s${kk}x{animation:s${kk}x ${dur} step-end infinite}` + keyframes(`s${kk}x`, shownBetween(land, land + 0.5)));
    k++;
  }
  return { markup: markup.join(""), css: (dur) => rules.map((r) => r(dur)).join("") };
}
function waveFrames(march) {
  return [
    ...march.map((s) => [s.at, `transform:translate(${s.x}px,${s.y}px)`]),
    [RESET_START, "transform:translate(0px,0px)"]
  ];
}
function legFrames(march, frame) {
  return [
    ...march.map((s) => [s.at, `opacity:${s.frame === frame ? 1 : 0}`]),
    [RESET_START, `opacity:${frame === 0 ? 1 : 0}`]
  ];
}
function invaderFrames(j, c, t) {
  const s = t.shots[j];
  return keyframes(`h${j}`, [
    [0, "opacity:1"],
    [s.hit, "opacity:0"],
    [RESET_START + c.row * ROW_STAGGER, "opacity:1"]
  ]) + keyframes(`x${j}`, shownBetween(s.hit, Math.min(s.hit + BOOM_SPAN, s.done)));
}
function respawnFrames(t) {
  const stops = [[0, "opacity:1"]];
  for (const d of t.deaths) {
    let on = false;
    for (let m = d.respawn; m < d.done; m += 0.25) {
      stops.push([m, `opacity:${on ? 1 : 0.15}`]);
      on = !on;
    }
    stops.push([d.done, "opacity:1"]);
  }
  return stops;
}
function aliveFrames(changes) {
  const stops = [];
  let shown;
  for (const c of changes) {
    const now = c.pose !== "dead";
    if (now !== shown) stops.push([c.at, `opacity:${now ? 1 : 0}`]);
    shown = now;
  }
  stops.push([100, "opacity:1"]);
  return stops;
}
function hopFrames(changes) {
  const jump = changes.find((c) => c.pose === "jump");
  const ground = "transform:translateY(0px)";
  if (!jump) return [[0, ground], [100, ground]];
  const up = `transform:translateY(-${HOP}px)`;
  const a = jump.at;
  return [[0, ground], [a, ground], [a + 0.8, up], [a + 1.6, ground], [a + 2.4, up], [a + 3.2, ground], [100, ground]];
}
function progressFrames(t) {
  const total = t.shots.length;
  return [
    [0, "transform:scaleX(0)"],
    ...t.shots.map((s, j) => [s.hit, `transform:scaleX(${round((j + 1) / total)})`]),
    [RESET_START, "transform:scaleX(1)"],
    [100, "transform:scaleX(0)"]
  ];
}
function comboMoments(t) {
  const out = [];
  let streak = 0;
  t.shots.forEach((s, j) => {
    if (s.miss) streak = 0;
    streak++;
    if (streak % COMBO_EVERY === 0) out.push([s.hit, streak]);
    if (t.deaths.some((d) => d.after === j)) streak = 0;
  });
  return out;
}
function longestStreak(plan) {
  const days = plan.steps.flatMap((s) => s.cells.map((c) => s.column * 7 + c.row)).sort((a, b) => a - b);
  let best = 0;
  let run3 = 0;
  days.forEach((d, i) => {
    run3 = i > 0 && d === days[i - 1] + 1 ? run3 + 1 : 1;
    best = Math.max(best, run3);
  });
  return best;
}
function digitCounter(prefix, deltas, start, digits) {
  const values = [[0, start]];
  let v = start;
  for (const [moment, delta] of deltas) values.push([moment, v += delta]);
  const uses = [];
  const rules = [];
  for (let place = 0; place < digits; place++) {
    const pow = 10 ** (digits - 1 - place);
    const digitOf = (n) => Math.floor(n / pow) % 10;
    for (let d = 0; d <= 9; d++) {
      const stops = [];
      let shown;
      for (const [moment, n] of values) {
        const now = digitOf(n) === d;
        if (now !== shown) stops.push([moment, `opacity:${now ? 1 : 0}`]);
        shown = now;
      }
      if (!stops.some(([, css]) => css === "opacity:1")) continue;
      const cls = `${prefix}${place}${d}`;
      uses.push(glyphUse(String(d), place * ADVANCE, `${prefix}g ${cls}`));
      rules.push(
        stops.length === 1 ? `.${cls}{opacity:1}` : `.${cls}{animation:${cls} DUR step-end infinite}` + keyframes(cls, [...stops, [100, `opacity:${digitOf(start) === d ? 1 : 0}`]])
      );
    }
  }
  return {
    markup: (x, y, scale, fill) => `<g class="${prefix === "s" ? "score" : "lives"}" fill="${fill}" transform="translate(${round(x)} ${round(y)}) scale(${scale})">${uses.join("")}</g>`,
    css: (dur) => `.${prefix}g{opacity:0}` + rules.join("").replace(/DUR/g, dur)
  };
}
function confettiBurst(l, p, seed) {
  const rng = mulberry32(seed ^ 3087);
  const x0 = l.gridLeft + l.gridW / 2;
  const y0 = l.gridTop + l.gridH / 2;
  const colors = [p.accent, ...SCREEN.invader.slice(1), SCREEN.white];
  const markup = [];
  const frames = [];
  for (let i = 0; i < CONFETTI; i++) {
    const a = i / CONFETTI * Math.PI * 2;
    const r = 80 + rng() * 110;
    const dx = Math.cos(a) * r * 2;
    const dy = Math.sin(a) * r * 0.6;
    markup.push(
      `<rect class="cf cf${i}" x="${round(x0 - 2)}" y="${round(y0 - 2)}" width="4" height="4" fill="${colors[i % colors.length]}"/>`
    );
    frames.push(
      keyframes(`cf${i}`, [
        [0, "opacity:0;transform:translate(0,0)"],
        [SWEEP_END, "opacity:0;transform:translate(0,0)"],
        [SWEEP_END + 0.3, "opacity:1;transform:translate(0,0)"],
        [SWEEP_END + 2.4, `opacity:1;transform:translate(${round(dx)}px,${round(dy)}px)`],
        [RESET_START, `opacity:0;transform:translate(${round(dx * 1.1)}px,${round(dy + 30)}px)`],
        [100, "opacity:0;transform:translate(0,0)"]
      ])
    );
  }
  return {
    markup: `<g class="fireworks">${markup.join("")}</g>`,
    css: (dur) => `.cf{opacity:0}` + Array.from({ length: CONFETTI }, (_, i) => `.cf${i}{animation:cf${i} ${dur} linear infinite}`).join("") + frames.join("")
  };
}
var escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function svgOpen(l, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}" height="${round(l.height)}" viewBox="0 0 ${l.width} ${round(l.height)}" role="img" aria-label="${escapeAttr(label)}">`;
}

// src/seed.ts
function fnv1a(s) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(s)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function dailySeed(date, login) {
  return fnv1a(`${date}:${login.toLowerCase()}`);
}
function resolveSeed(input, date, login) {
  const value = input.trim().toLowerCase() || "daily";
  if (value === "daily") return dailySeed(date, login);
  if (value === "fixed") return fnv1a(login.toLowerCase());
  if (/^\d{1,10}$/.test(value) && Number(value) <= 4294967295) return Number(value);
  throw new Error(`seed must be "daily", "fixed" or a whole number up to 4294967295, got "${input}".`);
}

// src/run.ts
function setOutput(env, name, value) {
  const file = env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delimiter}
${value}
${delimiter}
`, "utf8");
}
async function run2({ env, fetchImpl, now = /* @__PURE__ */ new Date(), cwd = process.cwd(), log = console.log }) {
  const inputs = readInputs(env);
  const date = now.toISOString().slice(0, 10);
  const seed = resolveSeed(inputs.seed, date, inputs.login);
  log(`Fetching the contribution calendar of @${inputs.login}`);
  const grid = await fetchContributions(inputs.login, inputs.token, fetchImpl);
  const plan = planSweep(grid);
  log(
    `${plan.totalCells} active days across ${plan.steps.length}/${plan.columns} weeks` + (plan.isEmpty ? " (an empty year: the idle SCANNING screen)" : "")
  );
  const written = [];
  for (const target of inputs.outputs) {
    const svg = renderSvg(plan, PALETTES[target.palette], { date, seed, login: inputs.login, title: inputs.title });
    const path = resolve(cwd, target.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, svg, "utf8");
    log(`${target.path}  (${target.palette}, ${(svg.length / 1024).toFixed(1)} KB)`);
    written.push(target.path);
  }
  setOutput(env, "files", written.join("\n"));
  return written;
}

// src/action.ts
var escapeData = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
try {
  await run2({ env: process.env });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`::error title=Contribution Invaders::${escapeData(message)}`);
  process.exitCode = 1;
}
