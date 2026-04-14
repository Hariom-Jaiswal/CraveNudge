/**
 * patternDetector.ts
 *
 * Behavioural pattern analysis over a user's meal history.
 * Triggers after 5+ meals are logged. Pure functions — no side effects.
 * Logic follows WORKFLOW.md §7.
 */
import type { Meal, ActivityGoal } from "@/types";
import { toDate } from "./decisionEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatternInsight {
  type: "time_pattern" | "frequency_pattern" | "score_trend" | "goal_drift";
  severity: "warning" | "positive" | "info";
  title: string;
  message: string;
  suggestion: string;
}

export interface PatternAnalysisResult {
  patterns: PatternInsight[];
  weeklyAvgScore: number;
  scoreTrend: "improving" | "declining" | "stable";
  insightCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EVENING_SUGAR_THRESHOLD = 18;
const EVENING_SUGAR_MIN_ENTRIES = 3;
const SNACK_FREQUENCY_THRESHOLD = 4;
const VEG_FREQUENCY_MIN = 2;
const SCORE_TREND_DELTA = 10;

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Analyses up to 100 meals (last ~30 days) and returns behavioural patterns.
 * Returns an empty result if fewer than 5 meals have been logged.
 */
export const detectPatterns = (
  meals: Meal[],
  goal: ActivityGoal | null,
  targetCal: number,
  targetProtein: number
): PatternAnalysisResult => {
  const EMPTY: PatternAnalysisResult = {
    patterns: [],
    weeklyAvgScore: 0,
    scoreTrend: "stable",
    insightCount: 0,
  };

  if (meals.length < 5) return EMPTY;

  const now = Date.now();
  const sevenDaysAgo = now - 7 * MS_PER_DAY;
  const fourteenDaysAgo = now - 14 * MS_PER_DAY;

  // Buckets — populated in a single pass
  const morning: Meal[] = [];   // 06:00–11:59
  const evening: Meal[] = [];   // 18:00–23:59
  const recentWeek: Meal[] = [];

  let week1ScoreSum = 0;
  let week1Count = 0;
  let week2ScoreSum = 0;
  let week2Count = 0;

  for (const m of meals) {
    const ts = toDate(m.timestamp).getTime();
    const hour = new Date(ts).getHours();

    if (hour >= 6 && hour < 12) morning.push(m);
    else if (hour >= 18 && hour < 24) evening.push(m);

    if (ts >= sevenDaysAgo) {
      recentWeek.push(m);
      week1ScoreSum += m.healthScore;
      week1Count++;
    } else if (ts >= fourteenDaysAgo) {
      week2ScoreSum += m.healthScore;
      week2Count++;
    }
  }

  const patterns: PatternInsight[] = [];

  // ── 1. TIME PATTERNS ──────────────────────────────────────────────────────
  if (evening.length >= EVENING_SUGAR_MIN_ENTRIES) {
    const evSugarAvg =
      evening.reduce((acc, m) => acc + m.sugar_g, 0) / evening.length;
    if (evSugarAvg > EVENING_SUGAR_THRESHOLD) {
      patterns.push({
        type: "time_pattern",
        severity: "warning",
        title: "High-sugar evenings",
        message:
          "You consume high-sugar foods most evenings. This may affect your weight management goal.",
        suggestion:
          "Try replacing your evening snack with a handful of nuts or a piece of fruit.",
      });
    }
  }

  // ── 2. FREQUENCY PATTERNS ────────────────────────────────────────────────
  if (recentWeek.length >= 5) {
    const snackCount = recentWeek.filter((m) => m.category === "snack").length;
    const vegCount = recentWeek.filter((m) => m.category === "vegetable").length;

    if (snackCount >= SNACK_FREQUENCY_THRESHOLD) {
      patterns.push({
        type: "frequency_pattern",
        severity: "warning",
        title: "Frequent Snacking",
        message: `You've logged ${snackCount} snacks this week.`,
        suggestion:
          "Ensure your main meals are satiating enough to reduce between-meal cravings.",
      });
    }

    if (vegCount < VEG_FREQUENCY_MIN) {
      patterns.push({
        type: "frequency_pattern",
        severity: "warning",
        title: "Low Vegetable Intake",
        message: "You've logged very few vegetables this week.",
        suggestion:
          "Try adding a side salad or substituting a carb portion with veggies at your next meal.",
      });
    }
  }

  // ── 3. SCORE TREND ────────────────────────────────────────────────────────
  const w1Avg = week1Count > 0 ? week1ScoreSum / week1Count : 0;
  const w2Avg = week2Count > 0 ? week2ScoreSum / week2Count : 0;
  let scoreTrend: "improving" | "declining" | "stable" = "stable";

  if (w1Avg > 0 && w2Avg > 0) {
    if (w2Avg - w1Avg > SCORE_TREND_DELTA) {
      scoreTrend = "declining";
      patterns.push({
        type: "score_trend",
        severity: "warning",
        title: "Declining Health Score",
        message: `Your average health score dropped by over ${SCORE_TREND_DELTA} points compared to last week.`,
        suggestion:
          "Reflect on recent choices and try incorporating more whole foods.",
      });
    } else if (w1Avg - w2Avg > SCORE_TREND_DELTA) {
      scoreTrend = "improving";
      patterns.push({
        type: "score_trend",
        severity: "positive",
        title: "Improving Score Trend",
        message: "Your health score improved significantly this week. Great work!",
        suggestion: "Keep it up — your consistency is paying off.",
      });
    }
  }

  // ── 4. GOAL DRIFT ─────────────────────────────────────────────────────────
  if (recentWeek.length > 0) {
    // Compare per-meal averages against one-third of daily targets
    const avgMealCal =
      recentWeek.reduce((acc, m) => acc + m.calories, 0) / recentWeek.length;
    const avgMealProtein =
      recentWeek.reduce((acc, m) => acc + m.protein_g, 0) / recentWeek.length;
    const idealMealCal = targetCal / 3;
    const idealMealProtein = targetProtein / 3;

    if (goal === "WEIGHT_LOSS" && avgMealCal > idealMealCal + 200) {
      patterns.push({
        type: "goal_drift",
        severity: "warning",
        title: "Calorie Drift",
        message:
          "Your meals are consistently higher in calories than optimal for weight loss.",
        suggestion:
          "Try reducing portion sizes slightly or swapping high-fat condiments for lighter alternatives.",
      });
    } else if (
      goal === "MUSCLE_GAIN" &&
      avgMealProtein < idealMealProtein - 5
    ) {
      patterns.push({
        type: "goal_drift",
        severity: "warning",
        title: "Protein Deficit",
        message:
          "Your meals are consistently lower in protein than optimal for muscle gain.",
        suggestion:
          "Add a protein source like chicken, tofu, eggs, or paneer to every main meal.",
      });
    }
  }

  return {
    patterns,
    weeklyAvgScore: Math.round(w1Avg) || Math.round(w2Avg),
    scoreTrend,
    insightCount: patterns.length,
  };
};
