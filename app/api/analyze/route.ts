/**
 * /api/analyze — POST
 *
 * Accepts a food name (text) or base64 image and returns a structured
 * nutrition JSON object from Gemini 2.5 Flash.
 *
 * Server-side only — GEMINI_API_KEY is never exposed to the client.
 *
 * Caching strategy (WORKFLOW.md §11):
 *   - Text results with confidence > 0.7 are cached in Firestore
 *     /nutritionCache/{normalizedFoodName} for 7 days.
 *   - Cache hit ratio target: ~90% for common foods.
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const NUTRITION_PROMPT = `You are a registered nutritionist. Analyse the food and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Required keys and types:
{
  "name": string,
  "calories": number,
  "protein_g": number,
  "fat_g": number,
  "sugar_g": number,
  "fiber_g": number,
  "category": "vegetable" | "protein" | "grain" | "dairy" | "snack" | "beverage" | "other",
  "serving_size": string,
  "confidence_score": number (0.0–1.0)
}`;

// ─── Validation ───────────────────────────────────────────────────────────────

const analyzeSchema = z.object({
  type: z.enum(["text", "image"]),
  input: z.string().min(1).max(200_000),
  userId: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalises a food name to a consistent cache key. */
const normalizeCacheKey = (name: string): string =>
  name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

/** Strips trailing/leading whitespace and any accidental markdown fences. */
const stripFences = (text: string): string =>
  text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse & validate body ──────────────────────────────────────────
    const rawBody = await req.json();
    const parsed = analyzeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, input } = parsed.data;

    // ── 2. Sanitise text input ────────────────────────────────────────────
    let sanitizedText = "";
    if (type === "text") {
      sanitizedText = input.replace(/<[^>]*>/g, "").substring(0, 200).trim();
      if (!sanitizedText) {
        return NextResponse.json(
          { error: "Input is empty after sanitization." },
          { status: 400 }
        );
      }
    }

    // ── 3. Check Firestore cache (text-only, per WORKFLOW.md §4.2) ────────
    if (type === "text") {
      const cacheKey = normalizeCacheKey(sanitizedText);
      const cacheRef = adminDb.collection("nutritionCache").doc(cacheKey);
      const cacheSnap = await cacheRef.get();

      if (cacheSnap.exists) {
        const cached = cacheSnap.data()!;
        const age = Date.now() - cached.cachedAt.toMillis();
        if (age < CACHE_TTL_MS) {
          // Cache hit — increment counter and return cached data
          await cacheRef.update({ hitCount: FieldValue.increment(1) });
          return NextResponse.json({ success: true, data: cached.data, fromCache: true });
        }
      }
    }

    // ── 4. Build Gemini request ───────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    let contents: (string | Part)[];

    if (type === "text") {
      contents = [
        `${NUTRITION_PROMPT}\n\nAnalyse this food item: "${sanitizedText}"`,
      ];
    } else {
      // Image path — strip the data-URL prefix to get raw base64
      const base64Data = input.replace(/^data:image\/\w+;base64,/, "");
      const imagePart: Part = {
        inlineData: { data: base64Data, mimeType: "image/jpeg" },
      };
      contents = [
        imagePart,
        `${NUTRITION_PROMPT}\n\nAnalyse the food in this image. If the food is not identifiable, set confidence_score below 0.5.`,
      ];
    }

    // ── 5. Call Gemini ────────────────────────────────────────────────────
    const response = await ai.models.generateContent({ model: MODEL, contents });
    const rawText = response.text?.trim() ?? "";
    const jsonStr = stripFences(rawText);

    let nutritionData: Record<string, unknown>;
    try {
      nutritionData = JSON.parse(jsonStr);
    } catch {
      console.error("Gemini non-JSON response:", jsonStr);
      return NextResponse.json(
        { error: "Gemini returned an unparseable response. Please try again." },
        { status: 502 }
      );
    }

    // ── 6. Normalise — ensure all numeric fields are non-negative ─────────
    const numericFields = ["calories", "protein_g", "fat_g", "sugar_g", "fiber_g"] as const;
    for (const field of numericFields) {
      if (typeof nutritionData[field] === "number") {
        nutritionData[field] = Math.max(0, nutritionData[field] as number);
      }
    }

    // ── 7. Write to cache if high-confidence text input ───────────────────
    const confidence = nutritionData.confidence_score as number | undefined;
    if (type === "text" && typeof confidence === "number" && confidence > 0.7) {
      const cacheKey = normalizeCacheKey(sanitizedText);
      const cacheRef = adminDb.collection("nutritionCache").doc(cacheKey);
      await cacheRef.set({
        data: nutritionData,
        cachedAt: FieldValue.serverTimestamp(),
        hitCount: 0,
      });
    }

    return NextResponse.json({ success: true, data: nutritionData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analysis pipeline error:", message);
    return NextResponse.json(
      { error: "Failed to analyze food. " + message },
      { status: 500 }
    );
  }
}
