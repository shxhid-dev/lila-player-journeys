import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, parseViewState, serializeViewState, type ViewState } from "./url-state";

const parse = (qs: string) => parseViewState(new URLSearchParams(qs));

describe("url state", () => {
  it("parses an empty query to the defaults", () => {
    expect(parse("")).toEqual(DEFAULT_VIEW);
  });

  it("serializes the defaults to an empty string", () => {
    expect(serializeViewState(DEFAULT_VIEW)).toBe("");
  });

  it("round-trips a fully customised view", () => {
    const view: ViewState = {
      map: "Lockdown",
      dates: ["2026-02-11", "2026-02-12"],
      matches: ["d0a38c30-d476-4305-857d-ece9e65f72e6", "de5aa1ae-6246-4cfb-9941-adf5996ef678"],
      players: ["human"],
      events: ["kill", "storm"],
      heat: "deaths",
      heatScope: "selected",
      heatOpacity: 0.45,
      heatBin: 16,
      calibration: true,
      t: 312,
    };
    const qs = serializeViewState(view);
    expect(qs).toContain("dates=2026-02-11,2026-02-12");
    expect(parse(qs)).toEqual(view);
  });

  it("distinguishes 'no match specified' from 'explicitly none selected'", () => {
    expect(parse("").matches).toBeNull();
    const none = parse("match=none");
    expect(none.matches).toEqual([]);
    expect(serializeViewState(none)).toBe("match=none");
  });

  it("caps the selection at the compare limit", () => {
    const ids = [
      "d0a38c30-d476-4305-857d-ece9e65f72e6",
      "de5aa1ae-6246-4cfb-9941-adf5996ef678",
      "d3a3297e-2cdf-4a49-8450-09119b91a779",
      "a7a60c42-249b-4fab-855c-7c0a969b5f76",
    ];
    expect(parse(`match=${ids.join(",")}`).matches).toEqual(ids.slice(0, 3));
  });

  it("keeps an explicitly empty player or event filter (everything hidden)", () => {
    const s = parse("players=&events=");
    expect(s.players).toEqual([]);
    expect(s.events).toEqual([]);
    expect(parse(serializeViewState(s))).toEqual(s);
  });

  it("ignores malformed values instead of crashing", () => {
    const s = parse(
      "map=Atlantis&dates=yesterday&match=../../etc&players=alien&heat=fire&opacity=7&bin=3&t=-4",
    );
    expect(s).toEqual({ ...DEFAULT_VIEW, matches: [], players: [] });
  });
});
