import { describe, expect, it } from "vitest";
import { calculateAllScenarios } from "@/engine/scenario";
import { defaultState } from "@/state/defaultState";

describe("scenario snapshot", () => {
  it("produces deterministic scenario summaries", () => {
    const output = calculateAllScenarios(defaultState);

    const summary = output.scenarioResults.map((result) => ({
      label: result.scenarioLabel,
      borrowingPower: Math.round(result.borrowingPower),
      annualNetCashflow: Math.round(result.annualNetCashflow),
      servicingRatio: Number(result.servicingRatio.toFixed(4))
    }));

    expect(summary).toMatchInlineSnapshot(`
      [
        {
          "annualNetCashflow": 11121,
          "borrowingPower": 448607,
          "label": "Conservative",
          "servicingRatio": 0.25,
        },
        {
          "annualNetCashflow": 11368,
          "borrowingPower": 458577,
          "label": "Base",
          "servicingRatio": 0.26,
        },
        {
          "annualNetCashflow": 10356,
          "borrowingPower": 505683,
          "label": "Aggressive",
          "servicingRatio": 0.28,
        },
      ]
    `);
  });
});
