import {
  GOAT_BOT_PORTRAIT_BLUSH,
  GOAT_BOT_PORTRAIT_DETAIL_WIDTH,
  GOAT_BOT_PORTRAIT_HIGHLIGHT_WIDTH,
  GOAT_BOT_PORTRAIT_INK,
  GOAT_BOT_PORTRAIT_PAPER,
  GOAT_BOT_PORTRAIT_STROKE_WIDTH,
  GOAT_BOT_PORTRAIT_VIEWBOX,
  type GoatBotPortraitArt,
} from "@goat/client-runtime/goatBot";

const INK = GOAT_BOT_PORTRAIT_INK;
const PAPER = GOAT_BOT_PORTRAIT_PAPER;

/** A member's drawn portrait; it fills its box and the caller clips it to a circle. */
export function GoatBotPortrait({
  art,
  className,
}: {
  readonly art: GoatBotPortraitArt;
  readonly className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox={GOAT_BOT_PORTRAIT_VIEWBOX}
      className={className}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {art.back === "" ? null : <path d={art.back} fill={INK} />}
      <path
        d={art.body.d}
        fill={art.body.dark ? INK : PAPER}
        stroke={INK}
        strokeWidth={GOAT_BOT_PORTRAIT_STROKE_WIDTH}
      />
      {art.skin.map((d) => (
        <path
          key={d}
          d={d}
          fill={PAPER}
          stroke={INK}
          strokeWidth={GOAT_BOT_PORTRAIT_STROKE_WIDTH}
        />
      ))}
      {art.blush === "" ? null : <path d={art.blush} fill={GOAT_BOT_PORTRAIT_BLUSH} />}
      <path d={art.ink} fill={INK} />
      <path d={art.lines} fill="none" stroke={INK} strokeWidth={GOAT_BOT_PORTRAIT_STROKE_WIDTH} />
      <path d={art.details} fill="none" stroke={INK} strokeWidth={GOAT_BOT_PORTRAIT_DETAIL_WIDTH} />
      {art.highlights === "" ? null : (
        <path
          d={art.highlights}
          fill="none"
          stroke={PAPER}
          strokeWidth={GOAT_BOT_PORTRAIT_HIGHLIGHT_WIDTH}
        />
      )}
    </svg>
  );
}
