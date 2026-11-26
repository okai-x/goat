import {
  goatBotAccent,
  goatBotPortraitArt,
  goatBotPortraitArtForSeed,
  goatBotPortraitSeeds,
} from "@goat/client-runtime/goatBot";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { GoatBotPortrait } from "./GoatBotFace";

const OFFERED = 11;

/**
 * A member bot's portrait, as on web: the one drawn from its name, or one picked from a shuffled
 * set. Shuffle offers another set and keeps the choice.
 */
export function MobileBotPortraitField(props: {
  /** The chosen seed; null draws the portrait from the name. */
  readonly value: number | null;
  readonly name: string;
  readonly color: string | null;
  readonly emojiSet: boolean;
  readonly onChange: (value: number | null) => void;
  readonly disabled?: boolean;
}) {
  const [offered, setOffered] = useState(() => goatBotPortraitSeeds(OFFERED));
  const value = props.value;
  const options: ReadonlyArray<number | null> = [
    null,
    ...(value === null || offered.includes(value) ? [] : [value]),
    ...offered,
  ];
  const accent =
    props.color === null ? null : goatBotAccent({ role: "member", color: props.color });
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground">Portrait</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shuffle"
          disabled={props.disabled}
          onPress={() => setOffered(goatBotPortraitSeeds(OFFERED))}
          className="min-h-[44px] justify-center px-2"
        >
          <Text className="text-primary">Shuffle</Text>
        </Pressable>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Bot portrait"
        className="flex-row flex-wrap gap-1"
      >
        {options.map((option, index) => {
          const checked = option === value;
          const art =
            option === null ? goatBotPortraitArt(props.name) : goatBotPortraitArtForSeed(option);
          return (
            <Pressable
              key={option ?? "name"}
              accessibilityRole="radio"
              accessibilityLabel={option === null ? "Drawn from the name" : `Portrait ${index}`}
              accessibilityState={{ checked, disabled: props.disabled === true }}
              disabled={props.disabled}
              onPress={() => props.onChange(option)}
              className="h-12 w-12 items-center justify-center"
            >
              <View
                className={`h-10 w-10 rounded-full border ${checked ? "border-2 border-foreground" : "border-border"}`}
                style={{ backgroundColor: accent?.background ?? art.background }}
              >
                <GoatBotPortrait art={art} inset={checked ? 2 : 1} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {props.emojiSet ? (
        <Text className="text-sm text-foreground-muted">
          The emoji shows instead while one is set.
        </Text>
      ) : null}
    </View>
  );
}
