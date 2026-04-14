/**
 * decisionEngine.ts
 *
 * Pure functions only — no side effects, fully testable.
 * All scoring logic is derived directly from WORKFLOW.md §5.
 */
import type { ActivityGoal, Meal } from "@/types";
import type { Timestamp } from "firebase/firestore";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NutritionData {
  calories: number;
  protein_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  category: string;
  confidence_score?: number;
}

export interface GoalAlignmentResult {
  aligned: boolean;
  reason: string;
  remainingCalories: number;
  remainingProtein: number;
  overBudgetBy: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Converts any Firestore Timestamp, epoch ms number, or Date to a plain Date. */
export const toDate = (ts: Timestamp | number | Date): Date => {
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  // Firestore Timestamp duck-typing
  if (ts && typeof (ts as Timestamp).seconds === "number") {
    return new Date((ts as Timestamp).seconds * 1000);
  }
  return new Date(ts as unknown as string);
};

/** Returns the ISO date string (YYYY-MM-DD) for a given timestamp value. */
const toDateString = (ts: Timestamp | number | Date): string =>
  toDate(ts).toISOString().split("T")[0];

// ─── Health Score ────────────────────────────────────────────────────────────

/**
 * Calculates a 0–100 health score for a meal given user goal.
 * Logic follows WORKFLOW.md §5.1 exactly.
 */
export const calculateHealthScore = (
  nutrition: NutritionData,
  goal: ActivityGoal | null
): number => {
  let score = 60; // Base score (neutral starting point)

  // ── Penalties
  if (nutrition.calories > 600) score -= 10;
  if (nutrition.sugar_g > 20) score -= 15;
  if (nutrition.fat_g > 25) score -= 10;
  if (nutrition.fiber_g < 2) score -= 5;
  if (nutrition.category === "snack") score -= 5;

  // ── Bonuses
  if (nutrition.protein_g > 20) score += 15;
  if (nutrition.fiber_g > 5) score += 10;
  if (nutrition.category === "vegetable") score += 15;
  if (nutrition.calories < 400) score += 10;
  if (
    nutrition.confidence_score !== undefined &&
    nutrition.confidence_score > 0.8
  ) {
    score += 5; // data reliability bonus
  }

  // ── Goal Modifiers
  if (goal === "WEIGHT_LOSS") {
    if (nutrition.calories < 400) score += 10;
    if (nutrition.sugar_g > 15) score -= 10;
  }

  if (goal === "MUSCLE_GAIN") {
    if (nutrition.protein_g > 25) score += 15;
    if (nutrition.calories < 300) score -= 10; // too low for bulking
  }

  return Math.max(0, Math.min(100, score));
};

// ─── Goal Alignment ──────────────────────────────────────────────────────────

/**
 * Evaluates how a new meal fits within the user's remaining daily budget.
 * Returns structured result — no side effects, fully deterministic.
 */
export const evaluateGoalAlignment = (
  nutrition: NutritionData,
  goal: ActivityGoal | null,
  dailyCalorieTarget: number,
  dailyProteinTarget: number,
  todayCaloriesSoFar: number,
  todayProteinSoFar: number
): GoalAlignmentResult => {
  const remainingCalories =
    dailyCalorieTarget - (todayCaloriesSoFar + nutrition.calories);
  const remainingProtein =
    dailyProteinTarget - (todayProteinSoFar + nutrition.protein_g);

  if (remainingCalories < 0) {
    return {
      aligned: false,
      reason: `This meal puts you over your daily calorie target by ${Math.abs(remainingCalories)} kcal.`,
      remainingCalories,
      remainingProtein,
      overBudgetBy: Math.abs(remainingCalories),
    };
  }

  if (
    goal === "MUSCLE_GAIN" &&
    todayProteinSoFar + nutrition.protein_g < dailyProteinTarget / 2
  ) {
    return {
      aligned: true,
      reason: `You still need ${Math.round(remainingProtein)}g of protein today to hit your target.`,
      remainingCalories,
      remainingProtein,
      overBudgetBy: null,
    };
  }

  return {
    aligned: true,
    reason: "This meal aligns with your daily budget.",
    remainingCalories,
    remainingProtein,
    overBudgetBy: null,
  };
};

// ─── Streak ──────────────────────────────────────────────────────────────────

export interface StreakResult {
  currentStreak: number;
  isStreakDay: boolean;
  bestStreak: number;
}

/**
 * Calculates current and best streak from a meal history array.
 *
 * Rules (WORKFLOW.md §5.3):
 *  - A "healthy day" = daily avg health score ≥ 60.
 *  - A day with ZERO meals does NOT break the streak.
 *  - Only a day that has meals AND avg score < 60 breaks it.
 */
export const calculateStreak = (meals: Meal[]): StreakResult => {
  if (!meals || meals.length === 0) {
    return { currentStreak: 0, isStreakDay: false, bestStreak: 0 };
  }

  // ── 1. Group meals by calendar date ──────────────────────────────────────
  const grouped: Record<string, Meal[]> = {};
  for (const meal of meals) {
    const key = toDateString(meal.timestamp);
    (grouped[key] ??= []).push(meal);
  }

  // ── 2. Sort dates descending (most recent first) for current-streak calc ─
  const descDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const todayStr = toDateString(new Date());

  // ── 3. Current streak — walk backwards until broken ──────────────────────
  let currentStreak = 0;
  let isStreakDay = false;

  for (const date of descDates) {
    const dailyMeals = grouped[date];
    const avgScore =
      dailyMeals.reduce((acc, m) => acc + m.healthScore, 0) /
      dailyMeals.length;

    if (date === todayStr) {
      isStreakDay = avgScore >= 60;
    }

    if (avgScore >= 60) {
      currentStreak++;
    } else {
      break; // day has meals and avg < 60 — streak broken
    }
  }

  // ── 4. Best streak — ascending pass (days with no meals are skipped, not counted) ─
  const ascDates = [...descDates].reverse();
  let bestStreak = 0;
  let runningBest = 0;

  for (const date of ascDates) {
    const dailyMeals = grouped[date];
    const avg =
      dailyMeals.reduce((acc, m) => acc + m.healthScore, 0) /
      dailyMeals.length;

    if (avg >= 60) {
      runningBest++;
      if (runningBest > bestStreak) bestStreak = runningBest;
    } else {
      runningBest = 0;
    }
  }

  return { currentStreak, isStreakDay, bestStreak };
};
