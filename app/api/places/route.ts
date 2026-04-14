/**
 * /api/places — GET
 *
 * Returns up to 5 nearby healthy restaurants filtered by the user's goal.
 * Uses Google Maps Places API (Nearby Search).
 *
 * Location coordinates are used only for the duration of this request
 * and are never stored in Firestore (WORKFLOW.md §8.2).
 *
 * Caching: results cached for 10 minutes via Cache-Control header.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ActivityGoal } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  rating: number;
  address: string;
  photo_reference: string | null;
}

interface MapsPlace {
  place_id: string;
  name: string;
  rating?: number;
  vicinity?: string;
  photos?: Array<{ photo_reference: string }>;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const querySchema = z.object({
  lat: z.string().refine((v) => !Number.isNaN(parseFloat(v)), "lat must be a number"),
  lng: z.string().refine((v) => !Number.isNaN(parseFloat(v)), "lng must be a number"),
  goal: z.enum(["WEIGHT_LOSS", "MUSCLE_GAIN", "MAINTENANCE"]),
  healthScore: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GOAL_KEYWORDS: Record<ActivityGoal, string> = {
  WEIGHT_LOSS: "salad healthy light",
  MUSCLE_GAIN: "protein grill chicken",
  MAINTENANCE: "balanced healthy",
};

// Force dynamic: location-based, cannot be statically cached
export const dynamic = "force-dynamic";

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { lat, lng, goal } = parsed.data;
    const keyword = GOAL_KEYWORDS[goal];

    const apiKey = process.env.MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing MAPS_API_KEY." },
        { status: 500 }
      );
    }

    // ── Google Maps Places API — Nearby Search ────────────────────────────
    const mapsUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    );
    mapsUrl.searchParams.set("location", `${lat},${lng}`);
    mapsUrl.searchParams.set("radius", "2000");
    mapsUrl.searchParams.set("type", "restaurant");
    mapsUrl.searchParams.set("keyword", keyword);
    mapsUrl.searchParams.set("key", apiKey);

    const mapsResponse = await fetch(mapsUrl.toString());
    if (!mapsResponse.ok) {
      throw new Error(`Maps API HTTP error: ${mapsResponse.status}`);
    }

    const data = await mapsResponse.json();

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Maps API status:", data.status, data.error_message);
      return NextResponse.json(
        { error: "Maps API returned an error.", status: data.status },
        { status: 502 }
      );
    }

    // ── Filter: rating ≥ 3.8, limit 5 ────────────────────────────────────
    const rawResults: MapsPlace[] = data.results ?? [];
    const places: PlaceResult[] = rawResults
      .filter((p) => p.rating !== undefined && p.rating >= 3.8)
      .slice(0, 5)
      .map((p) => ({
        place_id: p.place_id,
        name: p.name,
        rating: p.rating!,
        address: p.vicinity ?? "",
        photo_reference: p.photos?.[0]?.photo_reference ?? null,
      }));

    return NextResponse.json(
      { success: true, places },
      {
        headers: {
          // Cache for 10 minutes at the CDN edge (WORKFLOW.md §11)
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Places API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch nearby places." },
      { status: 500 }
    );
  }
}
