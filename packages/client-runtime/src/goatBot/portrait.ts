/** A member bot's drawn portrait: ink lines on paper over a soft circle, built from its name. */
export const GOAT_BOT_PORTRAIT_VIEWBOX = "0 0 48 48";
export const GOAT_BOT_PORTRAIT_INK = "#1c1b1f";
export const GOAT_BOT_PORTRAIT_PAPER = "#ffffff";
export const GOAT_BOT_PORTRAIT_BLUSH = "#ff8a9a59";
/** Outlines, then the finer lines of brows, nose and folds, then the light strokes on dark hair. */
export const GOAT_BOT_PORTRAIT_STROKE_WIDTH = 1.4;
export const GOAT_BOT_PORTRAIT_DETAIL_WIDTH = 1.05;
export const GOAT_BOT_PORTRAIT_HIGHLIGHT_WIDTH = 0.8;

export interface GoatBotPortraitArt {
  /** Names the drawing, for callers that key on what an avatar shows. */
  readonly id: string;
  /** Ink shapes behind everything, such as long hair. */
  readonly back: string;
  /** The shoulders, outlined in ink and filled with ink or paper. */
  readonly body: { readonly d: string; readonly dark: boolean };
  /** Paper shapes outlined in ink, drawn in order: ears, then the head. */
  readonly skin: ReadonlyArray<string>;
  /** Soft color on the cheeks; may be "". */
  readonly blush: string;
  /** Ink shapes on top: hair, eyes, mouth. */
  readonly ink: string;
  /** Ink outlines on top: smile, glasses, collar on a light top. */
  readonly lines: string;
  /** Finer ink lines: brows, nose, ear folds. */
  readonly details: string;
  /** Paper lines over ink: strands of hair, the collar on a dark top. */
  readonly highlights: string;
  /** The circle behind a member without a color of its own. */
  readonly background: string;
}

const SHOULDERS = "M8 50 C8.6 42 14 38.2 20.6 37 L21 31 H27 L27.4 37 C34 38.2 39.4 42 40 50 Z";
const EARS = "M14.7 19.4 C11.9 18.6 11.5 25.4 15 24.9 Z M33.3 19.4 C36.1 18.6 36.5 25.4 33 24.9 Z";
const EAR_FOLDS = "M13.5 21 C14.1 21.5 14.2 22.6 13.7 23.3 M34.5 21 C33.9 21.5 33.8 22.6 34.3 23.3";
const HEAD =
  "M14.2 20.5 C14.2 13 18.6 9 24 9 C29.4 9 33.8 13 33.8 20.5 C33.8 26 31.6 30.6 27.8 32.8 C26.6 33.5 25.4 33.8 24 33.8 C22.6 33.8 21.4 33.5 20.2 32.8 C16.4 30.6 14.2 26 14.2 20.5 Z";
const NOSE = "M24.3 22.2 C23.7 24 23.4 24.9 24.7 25.2";

type Part = { readonly ink?: string; readonly lines?: string; readonly details?: string };

const HAIR: ReadonlyArray<{
  readonly back?: string;
  readonly front: string;
  readonly highlights?: string;
}> = [
  // Side part
  {
    front:
      "M14 21.5 C13 13 17.2 7.8 24.6 7.8 C31.4 7.8 35.4 12.6 34 21.5 C33.4 18.6 32.6 16.6 31.2 15.4 C29.6 16.4 27.4 16.6 25.6 15.8 C23.2 17.4 18.6 17.8 15.8 16.2 C15 17.8 14.4 19.6 14 21.5 Z",
    highlights: "M26.6 10.4 C29.2 10.8 31 12 32 13.8 M19.4 11.4 C20.8 10.6 22.4 10.2 24 10.2",
  },
  // Tousled
  {
    front:
      "M14.2 21 C13.4 16.2 13.8 12.8 15.8 10.8 C15.6 9.6 16.2 8.6 17.6 8.6 C18.4 7.2 20 6.6 21.6 7.4 C22.8 6 25.2 5.8 26.6 7.2 C28.4 6.6 30.4 7.6 30.8 9.2 C32.6 9.6 33.6 11.2 33 12.6 C34.4 14.8 34.6 17.8 33.8 21 C32.8 17.4 30.8 15.2 28.6 14.6 C26 16 21.8 16.2 18.8 14.8 C16.6 15.8 15 17.8 14.2 21 Z",
    highlights: "M18.6 10.4 C19.8 9.8 21 9.8 22 10.4 M25.8 9.6 C27.2 9.4 28.6 10 29.4 11.2",
  },
  // Curls
  {
    front: [
      "M12.6 18.6 a3.4 3.4 0 1 1 6.8 0 a3.4 3.4 0 1 1 -6.8 0 Z",
      "M14.6 13.4 a3.6 3.6 0 1 1 7.2 0 a3.6 3.6 0 1 1 -7.2 0 Z",
      "M19.2 10 a3.8 3.8 0 1 1 7.6 0 a3.8 3.8 0 1 1 -7.6 0 Z",
      "M25 10.6 a3.7 3.7 0 1 1 7.4 0 a3.7 3.7 0 1 1 -7.4 0 Z",
      "M27.8 15 a3.5 3.5 0 1 1 7 0 a3.5 3.5 0 1 1 -7 0 Z",
      "M29.2 19.4 a2.9 2.9 0 1 1 5.8 0 a2.9 2.9 0 1 1 -5.8 0 Z",
      "M17.8 14.6 C20.6 15.6 27.4 15.6 30.4 14.4 L30 12 L18.4 12 Z",
    ].join(" "),
    highlights:
      "M16.6 12.4 C17.4 11.8 18.4 11.8 19 12.4 M21.6 8.8 C22.4 8.2 23.6 8.2 24.2 8.8 M27.6 9.4 C28.4 8.8 29.6 9 30 9.8 M30.4 14 C31.2 13.6 32.2 14 32.4 14.8",
  },
  // Long, parted in the middle
  {
    back: "M12.8 21 C12 10.6 17.6 7 24 7 C30.4 7 36 10.6 35.2 21 L35.8 33.6 C35.8 35.8 33.4 36.8 31.2 36 H16.8 C14.6 36.8 12.2 35.8 12.2 33.6 Z",
    front:
      "M14.4 21 C14.4 12.8 18.6 8.6 24 8.6 C29.4 8.6 33.6 12.8 33.6 21 C32.6 16.6 29.6 13.6 24.6 12.4 L24 12.2 L23.4 12.4 C18.4 13.6 15.4 16.6 14.4 21 Z",
    highlights:
      "M13.4 24.6 C13.3 28.4 13.6 31.4 14.2 34 M34.6 24.6 C34.7 28.4 34.4 31.4 33.8 34 M20.6 10.4 C21.6 9.8 22.6 9.6 23.4 9.6",
  },
  // Bun
  {
    back: "M20 6.6 a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0 Z",
    front:
      "M14.4 20 C14 12.4 18.4 8.6 24 8.6 C29.6 8.6 34 12.4 33.6 20 C31.8 15.8 28.6 13.4 24 13.2 C19.4 13.4 16.2 15.8 14.4 20 Z",
    highlights: "M22.4 4.8 C23.4 4.2 24.8 4.2 25.6 4.8 M18.6 11 C20 10.2 21.6 9.8 23 9.8",
  },
  // Bob with a fringe
  {
    back: "M12.8 22 C12 11.8 17.6 7.6 24 7.6 C30.4 7.6 36 11.8 35.2 22 L35.6 28.8 C33.4 30 31.6 29.4 31 27.8 H17 C16.4 29.4 14.6 30 12.4 28.8 Z",
    front:
      "M14.4 19.6 C14.4 12.6 18.6 9.4 24 9.4 C29.4 9.4 33.6 12.6 33.6 19.6 C29.4 18.6 25.6 17 23 14.8 C21 17.2 18 18.8 14.4 19.6 Z",
    highlights: "M26 11.6 C28.4 12 30.4 13.2 31.6 15 M13.6 23.4 C13.6 25 13.8 26.4 14.2 27.6",
  },
  // Beanie
  {
    front:
      "M13.6 18 C13.4 10.6 18.2 6.4 24 6.4 C29.8 6.4 34.6 10.6 34.4 18 Z M22.4 4.4 a1.6 1.6 0 1 1 3.2 0 a1.6 1.6 0 1 1 -3.2 0 Z",
    highlights: "M14.2 15.6 H33.8 M18.4 15.6 V17.6 M22 15.6 V17.6 M26 15.6 V17.6 M29.6 15.6 V17.6",
  },
];

const BROWS: ReadonlyArray<string> = [
  "M18.4 18.3 C19.4 17.6 20.9 17.5 22 17.9 M26 17.9 C27.1 17.5 28.6 17.6 29.6 18.3",
  "M18.6 18 L21.8 17.6 M26.2 17.6 L29.4 18",
  "M18.6 17.4 C19.6 16.6 21 16.8 21.8 17.6 M26.2 17.6 C27 16.8 28.4 16.6 29.4 17.4",
];

const EYES: ReadonlyArray<Part> = [
  {
    ink: "M19.2 21.6 a1.05 1.35 0 1 1 2.1 0 a1.05 1.35 0 1 1 -2.1 0 Z M26.7 21.6 a1.05 1.35 0 1 1 2.1 0 a1.05 1.35 0 1 1 -2.1 0 Z",
  },
  { lines: "M18.8 22 C19.6 20.8 21 20.8 21.8 22 M26.2 22 C27 20.8 28.4 20.8 29.2 22" },
  {
    ink: "M19.2 21.8 a1.05 1.2 0 1 1 2.1 0 a1.05 1.2 0 1 1 -2.1 0 Z M26.7 21.8 a1.05 1.2 0 1 1 2.1 0 a1.05 1.2 0 1 1 -2.1 0 Z",
    details: "M19 20.4 L18.2 19.8 M29 20.4 L29.8 19.8",
  },
];

const MOUTHS: ReadonlyArray<Part> = [
  { lines: "M21.2 27.6 C22.8 29.2 25.2 29.2 26.8 27.6" },
  { lines: "M22.4 28.2 C23.4 28.8 24.6 28.8 25.6 28.2" },
  { ink: "M21.2 27.2 C22.6 27.6 25.4 27.6 26.8 27.2 C26.4 30.4 21.6 30.4 21.2 27.2 Z" },
  { lines: "M22 28.2 H25.6", details: "M26.4 27.4 C26.8 27.8 26.8 28.4 26.4 28.8" },
];

const EXTRAS: ReadonlyArray<Part> = [
  {},
  {},
  {
    lines:
      "M16.9 21.6 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 M24.7 21.6 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 M23.3 21.2 C23.8 20.8 24.2 20.8 24.7 21.2",
  },
  {
    lines:
      "M16.6 19.4 C16.6 18.9 17 18.6 17.4 18.6 H22.6 C23 18.6 23.4 18.9 23.4 19.4 V23 C23.4 23.6 23 24 22.4 24 H17.6 C17 24 16.6 23.6 16.6 23 Z M24.6 19.4 C24.6 18.9 25 18.6 25.4 18.6 H30.6 C31 18.6 31.4 18.9 31.4 19.4 V23 C31.4 23.6 31 24 30.4 24 H25.6 C25 24 24.6 23.6 24.6 23 Z M23.4 20.2 H24.6",
  },
  {
    ink: "M20.4 26.6 C22 24.8 23.4 25.2 24 25.8 C24.6 25.2 26 24.8 27.6 26.6 C25.8 26.2 22.2 26.2 20.4 26.6 Z",
  },
  {
    ink: "M18.2 25.2 a0.45 0.45 0 1 1 0.9 0 a0.45 0.45 0 1 1 -0.9 0 Z M19.6 26.2 a0.45 0.45 0 1 1 0.9 0 a0.45 0.45 0 1 1 -0.9 0 Z M27.5 25.2 a0.45 0.45 0 1 1 0.9 0 a0.45 0.45 0 1 1 -0.9 0 Z M28.9 26.2 a0.45 0.45 0 1 1 0.9 0 a0.45 0.45 0 1 1 -0.9 0 Z",
  },
  {
    lines:
      "M13.6 25.4 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0 M32.2 25.4 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0",
  },
];

const CLOTHES: ReadonlyArray<{ readonly dark: boolean; readonly collar: string }> = [
  { dark: false, collar: "M20.4 37.2 C22 39.2 26 39.2 27.6 37.2" },
  { dark: false, collar: "M20.6 36.8 L22.6 41.2 L24 38.8 L25.4 41.2 L27.4 36.8 M24 38.8 V48" },
  { dark: true, collar: "M20.8 37 C22.2 39.6 25.8 39.6 27.2 37 M22.6 39.4 V43.4 M25.4 39.4 V43.4" },
  { dark: true, collar: "M20.4 37.4 L24 42 L27.6 37.4" },
];

const BLUSH =
  "M16.8 25.8 a1.9 1.15 0 1 1 3.8 0 a1.9 1.15 0 1 1 -3.8 0 Z M27.4 25.8 a1.9 1.15 0 1 1 3.8 0 a1.9 1.15 0 1 1 -3.8 0 Z";

const BACKGROUNDS = ["#cdeccf", "#f9cfe0", "#fbd9c0", "#cfe3f8", "#e0d8fa", "#f6ecb4"] as const;

function hashName(name: string): number {
  let hash = 0x811c9dc5;
  for (const char of name.trim().toLocaleLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function pick<T>(items: ReadonlyArray<T>, hash: number, salt: number): T {
  const mixed = Math.imul(hash ^ (salt * 0x9e3779b1), 0x85ebca6b) >>> 0;
  return items[(mixed >>> 8) % items.length] as T;
}

const join = (...parts: ReadonlyArray<string | undefined>) =>
  parts.filter((part) => part !== undefined && part !== "").join(" ");

// Same object for the same name, so memoized rows keep their props; a few hundred names at most.
const drawn = new Map<number, GoatBotPortraitArt>();
const DRAWN_LIMIT = 256;

/** The same name always draws the same portrait; case and surrounding spaces do not matter. */
export function goatBotPortraitArt(name: string): GoatBotPortraitArt {
  return goatBotPortraitArtForSeed(hashName(name));
}

/** The portrait a stored seed draws; every client draws the same one. */
export function goatBotPortraitArtForSeed(seed: number): GoatBotPortraitArt {
  const hash = seed >>> 0;
  const known = drawn.get(hash);
  if (known !== undefined) return known;
  if (drawn.size >= DRAWN_LIMIT) drawn.clear();
  const art = drawPortrait(hash);
  drawn.set(hash, art);
  return art;
}

/** Fresh seeds to offer in a picker, each drawing a different portrait. */
export function goatBotPortraitSeeds(count: number, random: () => number = Math.random) {
  const seeds: number[] = [];
  const looks = new Set<string>();
  for (let attempt = 0; seeds.length < count && attempt < count * 20; attempt++) {
    const seed = Math.floor(random() * 0x100000000) >>> 0;
    const art = goatBotPortraitArtForSeed(seed);
    const look = [art.back, art.body.dark, art.ink, art.lines, art.details, art.background].join();
    if (looks.has(look)) continue;
    looks.add(look);
    seeds.push(seed);
  }
  return seeds;
}

function drawPortrait(hash: number): GoatBotPortraitArt {
  const hair = pick(HAIR, hash, 1);
  const eyes = pick(EYES, hash, 2);
  const mouth = pick(MOUTHS, hash, 3);
  const extra = pick(EXTRAS, hash, 4);
  const clothes = pick(CLOTHES, hash, 6);
  const brows = pick(BROWS, hash, 7);
  return {
    id: `portrait-${hash.toString(36)}`,
    back: hair.back ?? "",
    body: { d: SHOULDERS, dark: clothes.dark },
    skin: [EARS, HEAD],
    blush: pick([BLUSH, BLUSH, ""], hash, 8),
    ink: join(hair.front, eyes.ink, mouth.ink, extra.ink),
    lines: join(eyes.lines, mouth.lines, extra.lines, clothes.dark ? "" : clothes.collar),
    details: join(EAR_FOLDS, NOSE, brows, eyes.details, mouth.details, extra.details),
    highlights: join(hair.highlights, clothes.dark ? clothes.collar : ""),
    background: pick(BACKGROUNDS, hash, 5),
  };
}
