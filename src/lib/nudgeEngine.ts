/**
 * nudgeEngine.ts
 *
 * Context-aware nudge message generator.
 * Follows the logic tree defined in WORKFLOW.md §6.1.
 * Pure function — deterministic given the same inputs.
 */
import type { ActivityGoal } from "@/types";
import type { GoalAlignmentResult, NutritionData } from "./decisionEngine";

const goalLabel = (goal: ActivityGoal): string =>
  goal.toLowerCase().replace("_", " ");

/**
 * Generates a personalised nudge message based on the meal's health score,
 * the user's goal, nutritional values, current streak length, and
 * how the meal fits within the remaining daily budget.
 */
export const determineNudgeMessage = (
  healthScore: number,
  goal: ActivityGoal,
  nutrition: NutritionData,
  streak: number,
  alignment: GoalAlignmentResult
): string => {
  // Fallback for missing nutrition data
  if (!nutrition) {
    return "We couldn't fully analyse this meal — please try again for personalised feedback.";
  }

  // ── Score ≥ 80: Great choice ──────────────────────────────────────────────
  if (healthScore >= 80) {
    if (streak >= 3) {
      return `You're on a ${streak}-day healthy streak — this keeps it going! Great choice for your ${goalLabel(goal)} goal.`;
    }
    return `Excellent! This meal strongly supports your ${goalLabel(goal)} goal.`;
  }

  // ── Score 50–79: Decent, suggest improvement ─────────────────────────────
  if (healthScore >= 50) {
    if (nutrition.sugar_g > 15 && goal === "WEIGHT_LOSS") {
      return "Solid choice. Swapping the high-sugar side for fresh fruit would boost your score by ~15 points.";
    }
    if (nutrition.protein_g < 15 && goal === "MUSCLE_GAIN") {
      return "Decent meal, but low on protein. Try adding chicken, Greek yogurt, or paneer to hit your targets.";
    }
    return "Good foundation. Adding more fibre or reducing processed ingredients next time will improve your score.";
  }

  // ── Score < 50: Low score — specific nudges ───────────────────────────────
  if (goal === "WEIGHT_LOSS" && nutrition.sugar_g > 20) {
    return `This has ${nutrition.sugar_g}g of sugar. Swapping it for an apple or a handful of nuts fits your goal much better.`;
  }

  if (goal === "MUSCLE_GAIN" && nutrition.protein_g < 10) {
    const needed = alignment.remainingProtein > 0
      ? `${Math.round(alignment.remainingProtein)}g more`
      : "more protein";
    return `Only ${nutrition.protein_g}g of protein here. You need ${needed} today — try adding eggs or paneer.`;
  }

  if (nutrition.calories > 600 && goal === "WEIGHT_LOSS") {
    return "High calorie density detected. Consider a smaller portion or swap for a lighter alternative nearby.";
  }

  return "This meal scores low for your goal. Check the healthy alternatives nearby for your next meal.";
};
