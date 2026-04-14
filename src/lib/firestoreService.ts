/**
 * firestoreService.ts
 *
 * All Firestore read/write operations for CraveNudge.
 * Security is enforced server-side via firestore.rules —
 * all reads/writes are scoped to the authenticated uid.
 */
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile, Meal, ActivityGoal } from "@/types";

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Loads an existing user profile, or creates one with defaults for new users.
 * Called immediately after Firebase Auth returns a user object.
 */
export const initUserProfile = async (
  uid: string,
  email: string | null,
  displayName: string | null,
  photoURL: string | null
): Promise<UserProfile> => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }

  const newProfile: Omit<UserProfile, "createdAt"> = {
    uid,
    email,
    displayName,
    photoURL,
    goal: null,
    dailyCalorieTarget: 2000,
    dailyProteinTarget: 50,
  };

  await setDoc(userRef, {
    ...newProfile,
    createdAt: serverTimestamp(), // authoritative server time
  });

  return {
    ...newProfile,
    createdAt: Date.now(), // local representation while serverTimestamp resolves
  };
};

/**
 * Persists the user's chosen goal and derived daily targets.
 * Uses nullish coalescing so an explicit 0 is preserved correctly.
 */
export const updateUserGoal = async (
  uid: string,
  goal: ActivityGoal,
  calorieTarget?: number,
  proteinTarget?: number
): Promise<void> => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    goal,
    dailyCalorieTarget: calorieTarget ?? 2000,
    dailyProteinTarget: proteinTarget ?? 50,
  });
};

// ─── Meals ────────────────────────────────────────────────────────────────────

/** Saves a new meal entry for the authenticated user. */
export const saveMeal = async (
  uid: string,
  meal: Omit<Meal, "id" | "timestamp">
): Promise<string> => {
  const mealsRef = collection(db, "users", uid, "meals");
  const result = await addDoc(mealsRef, {
    ...meal,
    timestamp: serverTimestamp(),
  });
  return result.id;
};

/**
 * Fetches the most recent meals for today's log view.
 * Ordered newest-first; paginate on scroll with maxLimit.
 */
export const getRecentMeals = async (
  uid: string,
  maxLimit = 20
): Promise<Meal[]> => {
  const mealsRef = collection(db, "users", uid, "meals");
  const q = query(mealsRef, orderBy("timestamp", "desc"), limit(maxLimit));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Meal));
};

/**
 * Fetches up to 100 meals (last ~30 days) in ascending order for
 * streak calculation and pattern detection.
 * A single query is shared by both consumers to avoid redundant reads.
 */
export const getMealsForAnalysis = async (uid: string): Promise<Meal[]> => {
  const mealsRef = collection(db, "users", uid, "meals");
  const q = query(mealsRef, orderBy("timestamp", "desc"), limit(100));
  const snapshot = await getDocs(q);
  // Reverse so pattern detector receives chronological (ascending) order
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Meal))
    .reverse();
};
