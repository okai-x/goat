import { describe, expect, it } from "vite-plus/test";

import { botProfileChanges } from "./channels.ts";

const initial = { name: "Helper", avatar: null, purpose: "", color: "#2F6FED" };
const draft = { name: "Helper", avatar: "", purpose: "" };

describe("botProfileChanges and a bot's color", () => {
  it("creates with a chosen color and without one when neutral or not offered", () => {
    expect(botProfileChanges("create", initial, { ...draft, color: "#0F8B8D" })).toHaveProperty(
      "color",
      "#0F8B8D",
    );
    expect(botProfileChanges("create", initial, { ...draft, color: null })).not.toHaveProperty(
      "color",
    );
    expect(botProfileChanges("create", initial, draft)).not.toHaveProperty("color");
  });

  it("edits send a changed color, null to clear it, and nothing for case or an absent picker", () => {
    expect(botProfileChanges("edit", initial, { ...draft, color: "#0F8B8D" })).toEqual({
      color: "#0F8B8D",
    });
    expect(botProfileChanges("edit", initial, { ...draft, color: null })).toEqual({ color: null });
    expect(botProfileChanges("edit", initial, { ...draft, color: "#2f6fed" })).toEqual({});
    expect(botProfileChanges("edit", initial, draft)).toEqual({});
  });
});

describe("botProfileChanges and a bot's portrait", () => {
  it("creates with a chosen portrait and without one when drawn from the name", () => {
    expect(botProfileChanges("create", initial, { ...draft, portrait: 7 })).toHaveProperty(
      "portrait",
      7,
    );
    expect(botProfileChanges("create", initial, { ...draft, portrait: 0 })).toHaveProperty(
      "portrait",
      0,
    );
    expect(botProfileChanges("create", initial, { ...draft, portrait: null })).not.toHaveProperty(
      "portrait",
    );
  });

  it("edits send a changed portrait, null to go back to the name's, and nothing when unchanged", () => {
    const chosen = { ...initial, portrait: 7 };
    expect(botProfileChanges("edit", chosen, { ...draft, portrait: 9 })).toEqual({ portrait: 9 });
    expect(botProfileChanges("edit", chosen, { ...draft, portrait: null })).toEqual({
      portrait: null,
    });
    expect(botProfileChanges("edit", chosen, { ...draft, portrait: 7 })).toEqual({});
    expect(botProfileChanges("edit", initial, { ...draft, portrait: null })).toEqual({});
    expect(botProfileChanges("edit", chosen, draft)).toEqual({});
  });
});
