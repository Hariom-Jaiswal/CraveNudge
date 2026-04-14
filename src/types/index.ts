import type { Timestamp } from "firebase/firestore";

export type ActivityGoal = "WEIGHT_LOSS" | "MUSCLE_GAIN" | "MAINTENANCE";

/** Meal food categories understood by the decision engine */
export type FoodCategory =
  | "vegetable"
  | "protein"
  | "grain"
  | "dairy"
  | "snack"
  | "beverage"
  | "other";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  goal: ActivityGoal | null;
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  createdAt: Timestamp | number | Date;
}

export interface Meal {
  id?: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  category: FoodCategory;
  healthScore: number;
  nudgeMessage: string;
  inputType: "text" | "image";
  timestamp: Timestamp | number | Date;
}

export interface StreakData {
  currentStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  bestStreak: number;
}
