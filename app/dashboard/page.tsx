"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Meal } from "@/types";
import {
  getRecentMeals,
  saveMeal,
  getMealsForAnalysis,
} from "@/lib/firestoreService";
import { analyzeFood } from "@/lib/geminiService";
import {
  calculateHealthScore,
  calculateStreak,
  evaluateGoalAlignment,
} from "@/lib/decisionEngine";
import { detectPatterns, type PatternAnalysisResult } from "@/lib/patternDetector";
import { determineNudgeMessage } from "@/lib/nudgeEngine";

import GoalSetup from "@/components/GoalSetup";
import FoodInput from "@/components/FoodInput";
import MealLog from "@/components/MealLog";
import StreakBadge from "@/components/StreakBadge";
import NearbyPlaces from "@/components/NearbyPlaces";
import WeeklyInsights from "@/components/WeeklyInsights";
import { LogOut, AlertCircle } from "lucide-react";
import { auth } from "@/lib/firebase";

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [meals, setMeals] = useState<Meal[]>([]);
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    isStreakDay: false,
    bestStreak: 0,
  });
  const [insights, setInsights] = useState<PatternAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Redirect if unauthenticated ───────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // ── Load dashboard data ───────────────────────────────────────────────────
  /**
   * Single Firestore read that populates both the today-view and
   * the analysis engines. Avoids a second round-trip.
   */
  const loadDashboardData = useCallback(async () => {
    if (!user || !profile) return;

    // One query — reused for today's log, streak, and pattern detection
    const allMeals = await getMealsForAnalysis(user.uid);

    // Filter to today for the meal log
    const todayStr = new Date().toISOString().split("T")[0];
    const todaysMeals = allMeals.filter((m) => {
      const ms =
        typeof m.timestamp === "number"
          ? m.timestamp
          : m.timestamp instanceof Date
          ? m.timestamp.getTime()
          : (m.timestamp as any)?.seconds * 1000;
      return new Date(ms).toISOString().split("T")[0] === todayStr;
    });
    setMeals(todaysMeals);

    // Streak calculation
    setStreakData(calculateStreak(allMeals));

    // Pattern detection (requires 5+ meals)
    setInsights(
      detectPatterns(
        allMeals,
        profile.goal,
        profile.dailyCalorieTarget,
        profile.dailyProteinTarget
      )
    );
  }, [user, profile]);

  useEffect(() => {
    if (user && profile?.goal) {
      loadDashboardData();
    }
  }, [user, profile, loadDashboardData]);

  // ── Food submission pipeline ──────────────────────────────────────────────
  const handleFoodSubmit = async (type: "text" | "image", input: string) => {
    if (!user || !profile) return;
    setIsAnalyzing(true);
    setSubmitError(null);

    try {
      // 1. Analyse via Gemini API route
      const { data: nutritionJSON } = await analyzeFood(type, input, user.uid);

      // 2. Compute health score
      const healthScore = calculateHealthScore(nutritionJSON, profile.goal);

      // 3. Compute today's running totals for budget evaluation
      const todayCals = meals.reduce((acc, m) => acc + m.calories, 0);
      const todayProtein = meals.reduce((acc, m) => acc + m.protein_g, 0);

      // 4. Goal alignment evaluation
      const alignment = evaluateGoalAlignment(
        nutritionJSON,
        profile.goal,
        profile.dailyCalorieTarget,
        profile.dailyProteinTarget,
        todayCals,
        todayProtein
      );

      // 5. Generate personalised nudge
      const nudgeMessage = determineNudgeMessage(
        healthScore,
        profile.goal ?? "MAINTENANCE",
        nutritionJSON,
        streakData.currentStreak,
        alignment
      );

      // 6. Persist to Firestore
      await saveMeal(user.uid, {
        name: nutritionJSON.name,
        calories: nutritionJSON.calories,
        protein_g: nutritionJSON.protein_g,
        fat_g: nutritionJSON.fat_g,
        sugar_g: nutritionJSON.sugar_g,
        fiber_g: nutritionJSON.fiber_g,
        category: nutritionJSON.category,
        healthScore,
        nudgeMessage,
        inputType: type,
      });

      // 7. Refresh dashboard
      await loadDashboardData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to analyse food. Please try again.";
      setSubmitError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return null; // AuthProvider is still resolving
  if (!user) return null; // Redirect in progress

  // Show goal setup modal for new users
  if (profile && !profile.goal) {
    return <GoalSetup />;
  }

  const latestMeal = meals[0] ?? null;

  return (
    <div className="min-h-screen pb-20">
      {/* ── Sticky nav header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-dark/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile?.photoURL && (
              // next/image requires a remotePattern config for external URLs;
              // using <img> intentionally for user avatars from auth providers.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoURL}
                alt={`${profile.displayName ?? "User"} avatar`}
                className="w-10 h-10 rounded-full border-2 border-primary/20"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                CraveNudge
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted capitalize">
                  {profile?.goal?.toLowerCase().replace("_", " ")}
                </span>
                <StreakBadge currentStreak={streakData.currentStreak} />
              </div>
            </div>
          </div>

          <button
            onClick={() => auth.signOut()}
            className="p-2 text-text-muted hover:text-white transition-colors bg-white/5 rounded-full"
            aria-label="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* ── Left column: input, maps, meal log ─────────────────────── */}
        <div className="md:col-span-8 space-y-8">
          <section aria-label="Log a meal">
            <FoodInput onSubmit={handleFoodSubmit} isLoading={isAnalyzing} />

            {/* Inline error — accessible, not a browser alert() */}
            {submitError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}
          </section>

          {latestMeal && profile?.goal && (
            <section aria-label="Healthy restaurants nearby">
              <NearbyPlaces
                goal={profile.goal}
                healthScore={latestMeal.healthScore}
              />
            </section>
          )}

          <section aria-label="Today's meal log">
            <h2 className="text-xl font-bold text-white mb-6">
              Today&apos;s Journey
            </h2>
            <MealLog meals={meals} />
          </section>
        </div>

        {/* ── Right column: weekly insights ──────────────────────────── */}
        <div className="md:col-span-4">
          <div className="sticky top-28 mt-8 md:mt-0">
            {insights && <WeeklyInsights insights={insights} />}
          </div>
        </div>
      </main>
    </div>
  );
}
