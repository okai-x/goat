import {
  goatBotAccent,
  goatBotPortraitArt,
  goatBotPortraitArtForSeed,
  goatBotPortraitSeeds,
} from "@goat/client-runtime/goatBot";
import { useRef, useState, type KeyboardEvent } from "react";

import { Button } from "../ui/button";
import { cn } from "~/lib/utils";
import { GoatBotPortrait } from "./GoatBotPortrait";

const OFFERED = 11;

/**
 * A member bot's portrait: the one drawn from its name, or one picked from a shuffled set. Arrow
 * keys move the selection like the color swatches; Shuffle offers another set and keeps the choice.
 */
export function GoatBotPortraitField({
  value,
  name,
  color,
  emojiSet,
  onChange,
  disabled = false,
}: {
  /** The chosen seed; null draws the portrait from the name. */
  readonly value: number | null;
  readonly name: string;
  /** The member's color, which the circle takes as in the roster. */
  readonly color: string | null;
  /** An emoji is set and shows instead of any portrait. */
  readonly emojiSet: boolean;
  readonly onChange: (value: number | null) => void;
  readonly disabled?: boolean;
}) {
  const [offered, setOffered] = useState(() => goatBotPortraitSeeds(OFFERED));
  const options: ReadonlyArray<number | null> = [
    null,
    ...(value === null || offered.includes(value) ? [] : [value]),
    ...offered,
  ];
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined) return;
    onChange(option);
    buttons.current[index]?.focus();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = Math.max(0, options.indexOf(value));
    const next: Record<string, number> = {
      ArrowRight: (current + 1) % options.length,
      ArrowDown: (current + 1) % options.length,
      ArrowLeft: (current - 1 + options.length) % options.length,
      ArrowUp: (current - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    choose(target);
  };
  const accent = color === null ? null : goatBotAccent({ role: "member", color });
  return (
    <div className="grid gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden>Portrait</span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={disabled}
          onClick={() => setOffered(goatBotPortraitSeeds(OFFERED))}
        >
          Shuffle
        </Button>
      </div>
      <div
        role="radiogroup"
        aria-label="Bot portrait"
        className="flex flex-wrap gap-2"
        onKeyDown={handleKeyDown}
      >
        {options.map((option, index) => {
          const checked = option === value;
          const art =
            option === null ? goatBotPortraitArt(name) : goatBotPortraitArtForSeed(option);
          return (
            <button
              key={option ?? "name"}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option === null ? "Drawn from the name" : `Portrait ${index}`}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              onClick={() => choose(index)}
              style={{ backgroundColor: accent?.background ?? art.background }}
              className={cn(
                "size-10 overflow-hidden rounded-full disabled:opacity-60",
                checked ? "border-2 border-primary" : "border border-border",
              )}
            >
              <GoatBotPortrait art={art} className="size-full" />
            </button>
          );
        })}
      </div>
      {emojiSet ? (
        <p className="text-xs text-muted-foreground">The emoji shows instead while one is set.</p>
      ) : null}
    </div>
  );
}
