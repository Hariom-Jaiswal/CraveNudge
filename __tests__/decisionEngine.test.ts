/**
 * decisionEngine.test.ts
 *
 * Unit tests for the CraveNudge decision engine (WORKFLOW.md §12).
 * All functions under test are pure — no mocking required.
 */
import {
  calculateHealthScore,
  calculateStreak,
  evaluateGoalAlignment,
  type NutritionData,
} from "../src/lib/decisionEngine";
import { determineNudgeMessage } from "../src/lib/nudgeEngine";
import type { Meal } from "../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeMeal = (
  overrides: Partial<Meal> & { healthScore: number; timestamp: number }
): Meal => ({
  id: "test",
  name: "Test Food",
  calories: 400,
  protein_g: 20,
  fat_g: 10,
  sugar_g: 5,
  fiber_g: 4,
  category: "other",
  nudgeMessage: "",
  inputType: "text",
  ...overrides,
});

// ─── calculateHealthScore ─────────────────────────────────────────────────────

describe("calculateHealthScore", () => {
  test("always returns a value between 0 and 100", () => {
    const edge: NutritionData = {
      calories: 0,
      protein_g: 0,
      sugar_g: 0,
      fat_g: 0,
      fiber_g: 0,
      category: "other",
    };
    const score = calculateHealthScore(edge, "MAINTENANCE");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("high sugar receives larger penalty for WEIGHT_LOSS than low sugar", () => {
    const base = {
      calories: 300,
      protein_g: 5,
      fat_g: 5,
      fiber_g: 1,
      category: "snack",
    };
    const highSugar: NutritionData = { ...base, sugar_g: 25 };
    const lowSugar: NutritionData = { ...base, sugar_g: 5 };
    expect(calculateHealthScore(lowSugar, "WEIGHT_LOSS")).toBeGreaterThan(
      calculateHealthScore(highSugar, "WEIGHT_LOSS")
    );
  });

  test("high-protein meal scores ≥ 75 for MUSCLE_GAIN", () => {
    const nutrition: NutritionData = {
      calories: 400,
      protein_g: 30,
      sugar_g: 5,
      fat_g: 10,
      fiber_g: 3,
      category: "protein",
    };
    expect(calculateHealthScore(nutrition, "MUSCLE_GAIN")).toBeGreaterThanOrEqual(75);
  });

  test("vegetable category receives +15 bonus", () => {
    const veg: NutritionData = {
      calories: 100,
      protein_g: 2,
      sugar_g: 3,
      fat_g: 1,
      fiber_g: 3,
      category: "vegetable",
    };
    const other: NutritionData = { ...veg, category: "other" };
    expect(calculateHealthScore(veg, null)).toBeGreaterThan(
      calculateHealthScore(other, null)
    );
  });

  test("score is clamped at 100 for an ideal meal", () => {
    const ideal: NutritionData = {
      calories: 300,
      protein_g: 30,
      sugar_g: 2,
      fat_g: 5,
      fiber_g: 8,
      category: "vegetable",
      confidence_score: 0.95,
    };
    expect(calculateHealthScore(ideal, "MUSCLE_GAIN")).toBeLessThanOrEqual(100);
  });
});

// ─── calculateStreak ──────────────────────────────────────────────────────────

describe("calculateStreak", () => {
  test("returns 0 for an empty meal list", () => {
    const { currentStreak, bestStreak } = calculateStreak([]);
    expect(currentStreak).toBe(0);
    expect(bestStreak).toBe(0);
  });

  test("correctly calculates bestStreak from 3 consecutive healthy days", () => {
    const meals: Meal[] = [
      makeMeal({ healthScore: 85, timestamp: new Date("2025-01-01T12:00:00Z").getTime() }),
      makeMeal({ healthScore: 70, timestamp: new Date("2025-01-02T12:00:00Z").getTime() }),
      makeMeal({ healthScore: 80, timestamp: new Date("2025-01-03T12:00:00Z").getTime() }),
    ];
    expect(calculateStreak(meals).bestStreak).toBeGreaterThanOrEqual(3);
  });

  test("streak breaks on a day with avg score < 60", () => {
    const meals: Meal[] = [
      makeMeal({ healthScore: 80, timestamp: new Date("2025-01-01T12:00:00Z").getTime() }),
      makeMeal({ healthScore: 30, timestamp: new Date("2025-01-02T12:00:00Z").getTime() }), // breaks
      makeMeal({ healthScore: 75, timestamp: new Date("2025-01-03T12:00:00Z").getTime() }),
    ];
    // Day 2 breaks the run; best streak is 1 (day 1 or day 3 independently)
    expect(calculateStreak(meals).bestStreak).toBe(1);
  });
});

// ─── evaluateGoalAlignment ────────────────────────────────────────────────────

describe("evaluateGoalAlignment", () => {
  test("marks meal as not aligned when it exceeds calorie budget", () => {
    const nutrition: NutritionData = {
      calories: 800,
      protein_g: 20,
      fat_g: 10,
      sugar_g: 5,
      fiber_g: 3,
      category: "other",
    };
    const result = evaluateGoalAlignment(
      nutrition,
      "WEIGHT_LOSS",
      1600,
      80,
      900, // already consumed 900
      30
    );
    expect(result.aligned).toBe(false);
    expect(result.overBudgetBy).toBeGreaterThan(0);
  });

  test("returns aligned=true when meal fits within budget", () => {
    const nutrition: NutritionData = {
      calories: 300,
      protein_g: 25,
      fat_g: 8,
      sugar_g: 4,
      fiber_g: 5,
      category: "protein",
    };
    const result = evaluateGoalAlignment(nutrition, "MAINTENANCE", 2200, 60, 400, 15);
    expect(result.aligned).toBe(true);
    expect(result.overBudgetBy).toBeNull();
  });

  test("is deterministic — same inputs always produce the same output", () => {
    const nutrition: NutritionData = {
      calories: 500,
      protein_g: 10,
      fat_g: 20,
      sugar_g: 10,
      fiber_g: 2,
      category: "snack",
    };
    const r1 = evaluateGoalAlignment(nutrition, "WEIGHT_LOSS", 1600, 80, 800, 30);
    const r2 = evaluateGoalAlignment(nutrition, "WEIGHT_LOSS", 1600, 80, 800, 30);
    expect(r1).toEqual(r2);
  });
});

// ─── determineNudgeMessage ────────────────────────────────────────────────────

describe("determineNudgeMessage", () => {
  const baseAlignment = {
    aligned: true,
    reason: "",
    remainingCalories: 800,
    remainingProtein: 30,
    overBudgetBy: null,
  };

  test("returns a defined string for any valid input", () => {
    const nutrition: NutritionData = {
      calories: 400,
      protein_g: 15,
      fat_g: 10,
      sugar_g: 8,
      fiber_g: 3,
      category: "grain",
    };
    const result = determineNudgeMessage(65, "MAINTENANCE", nutrition, 0, baseAlignment);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns a safe fallback when nutrition data is null/undefined", () => {
    // @ts-expect-error — testing runtime safety
    const result = determineNudgeMessage(50, "WEIGHT_LOSS", null, 0, baseAlignment);
    expect(typeof result).toBe("string");
  });

  test("references streak count in message when score ≥ 80 and streak ≥ 3", () => {
    const nutrition: NutritionData = {
      calories: 300,
      protein_g: 25,
      fat_g: 5,
      sugar_g: 3,
      fiber_g: 6,
      category: "vegetable",
    };
    const msg = determineNudgeMessage(90, "MAINTENANCE", nutrition, 5, baseAlignment);
    expect(msg).toContain("5");
  });
});
