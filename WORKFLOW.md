# CraveNudge — System Workflow & Architecture

> **Stack:** Next.js 14 (App Router) · Firebase (Auth, Firestore) · Google Gemini API · Google Maps Places API  
> **Deployment:** Firebase Hosting (via `next export`) or Google Cloud Run

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [End-to-End User Flow](#2-end-to-end-user-flow)
3. [Authentication Flow](#3-authentication-flow)
4. [Food Analysis Pipeline](#4-food-analysis-pipeline)
5. [Decision Engine Logic](#5-decision-engine-logic)
6. [Nudge Generation System](#6-nudge-generation-system)
7. [Behavioral Pattern Detector](#7-behavioral-pattern-detector)
8. [Nearby Places Integration](#8-nearby-places-integration)
9. [Data Layer — Firestore Schema](#9-data-layer--firestore-schema)
10. [Security Model](#10-security-model)
11. [Efficiency & Caching Strategy](#11-efficiency--caching-strategy)
12. [Testing Strategy](#12-testing-strategy)
13. [Accessibility Checklist](#13-accessibility-checklist)
14. [Google Services Map](#14-google-services-map)
15. [Deployment Workflow](#15-deployment-workflow)
16. [Environment Variables](#16-environment-variables)
17. [Assumptions & Constraints](#17-assumptions--constraints)

---

## 1. Project Structure

```
crave-nudge/
├── app/                          # Next.js 14 App Router
│   ├── layout.jsx                # Root layout with Firebase AuthProvider
│   ├── page.jsx                  # Landing / sign-in page
│   ├── dashboard/
│   │   └── page.jsx              # Main app (protected route)
│   └── api/
│       ├── analyze/route.js      # POST /api/analyze — calls Gemini
│       └── places/route.js       # GET /api/places — calls Maps Places API
│
├── src/
│   ├── lib/
│   │   ├── decisionEngine.js     # Pure logic — health score, goal alignment
│   │   ├── patternDetector.js    # Behavioral pattern analysis (5+ meals)
│   │   ├── geminiService.js      # Gemini API wrapper
│   │   ├── firestoreService.js   # All Firestore read/write operations
│   │   └── firebase.js           # Firebase app initialization
│   │
│   └── components/
│       ├── FoodInput.jsx         # Text + image upload input
│       ├── NudgeCard.jsx         # Personalized nudge display
│       ├── MealLog.jsx           # Today's meal history list
│       ├── WeeklyInsights.jsx    # Pattern detection output + charts
│       ├── NearbyPlaces.jsx      # Maps-powered healthy restaurant list
│       ├── GoalSetup.jsx         # Onboarding: goal + daily targets
│       └── StreakBadge.jsx       # Visual streak indicator
│
├── __tests__/
│   └── decisionEngine.test.js    # Jest unit tests (5 cases)
│
├── firestore.rules               # Firebase Security Rules
├── .env.local                    # Secrets (never committed)
├── .env.example                  # Template (committed)
├── Dockerfile                    # For Cloud Run deployment
├── next.config.js
└── README.md
```

---

## 2. End-to-End User Flow

```
User opens app
      │
      ▼
[Sign in with Google]  ──→  Firebase Auth  ──→  Firestore: create/load profile
      │
      ▼
[Dashboard loads]
  - Load today's meal log from Firestore
  - Load user goal + daily targets
  - Load weekly insights if 5+ meals logged
      │
      ▼
[User submits food]  (text OR image)
      │
      ├── Text input  ──→  /api/analyze  ──→  Gemini API
      │
      └── Image upload  ──→  compress client-side  ──→  /api/analyze  ──→  Gemini API (vision)
      │
      ▼
[Gemini returns structured nutrition JSON]
      │
      ▼
[Decision Engine runs]
  - Calculate health score (0–100)
  - Evaluate against user goal
  - Check daily totals vs targets
  - Detect streak status
      │
      ▼
[Nudge Generator produces feedback]
  - Contextual message
  - Healthy alternative suggestion
  - Streak reinforcement or pattern warning
      │
      ▼
[Meal saved to Firestore]
  - Nutrition data
  - Health score
  - Timestamp
      │
      ▼
[Nearby Places loaded]  ──→  /api/places  ──→  Google Maps Places API
  - Filtered by user goal + health score
      │
      ▼
[Weekly Insights updated]  (if 5+ meals exist)
  - Pattern Detector runs on full history
  - Insight card shown on dashboard
```

---

## 3. Authentication Flow

**Service:** Firebase Auth — Google Sign-In provider

```
User clicks "Sign in with Google"
      │
      ▼
Firebase Auth opens Google OAuth popup
      │
      ▼
On success: Firebase returns user object { uid, displayName, email, photoURL }
      │
      ▼
firestoreService.initUserProfile(uid)
  - Check if /users/{uid} document exists
  - If new user: create document with defaults
    {
      goal: null,          // set during onboarding
      dailyCalorieTarget: 2000,
      dailyProteinTarget: 50,
      createdAt: serverTimestamp()
    }
  - If existing user: load profile
      │
      ▼
If goal === null → show GoalSetup modal (onboarding)
If goal is set  → load Dashboard
```

**Session persistence:** Firebase handles this via `setPersistence(LOCAL)` — user stays signed in across page reloads.

**Route protection:** A `useAuth()` hook in `layout.jsx` redirects unauthenticated users to the landing page. Next.js middleware additionally protects `/dashboard/*` routes server-side.

---

## 4. Food Analysis Pipeline

### 4.1 Client — FoodInput Component

```
User types food name OR drags/selects an image
      │
  [Text input]                  [Image input]
      │                              │
 Debounce 300ms               Client-side resize
      │                         to max 800px,
      │                         JPEG quality 0.8
      │                              │
      └──────────┬───────────────────┘
                 │
                 ▼
         POST /api/analyze
         {
           type: "text" | "image",
           input: "Paneer Butter Masala" | "<base64>",
           userId: uid
         }
```

### 4.2 Server — /api/analyze Route

```
Receive request
      │
      ▼
Input validation
  - Sanitize text (strip HTML tags, max 200 chars)
  - Validate base64 format for images
  - Reject empty inputs
      │
      ▼
Check Firestore cache: /nutritionCache/{normalizedFoodName}
  - If cache hit (< 7 days old) → return cached data directly
  - If cache miss → call Gemini API
      │
      ▼
[Gemini API Call]
  Model: gemini-1.5-flash
  System prompt:
    "You are a nutritionist. Analyze the food and return ONLY valid JSON:
     { name, calories, protein_g, fat_g, sugar_g, fiber_g,
       category, serving_size, confidence_score }"

  For image input: send as inline_data with MIME type image/jpeg
      │
      ▼
Parse Gemini response
  - Validate JSON structure
  - Normalize values (ensure non-negative numbers)
  - On parse failure: return structured error with fallback message
      │
      ▼
If text input and confidence > 0.7:
  Write to /nutritionCache/{normalizedFoodName} in Firestore
      │
      ▼
Return nutrition JSON to client
```

### 4.3 Gemini Prompt Design

```
For text input:
  "Analyze this food item: '{input}'
   Return ONLY a JSON object with these exact keys:
   name (string), calories (number), protein_g (number),
   fat_g (number), sugar_g (number), fiber_g (number),
   category ('vegetable'|'protein'|'grain'|'dairy'|'snack'|'beverage'|'other'),
   serving_size (string), confidence_score (0.0–1.0).
   No markdown, no explanation, just the JSON."

For image input:
  [Same prompt with vision input]
  Additional: "If food is not identifiable, set confidence_score below 0.5."
```

---

## 5. Decision Engine Logic

**File:** `src/lib/decisionEngine.js`  
**Design principle:** Pure functions only — no side effects, fully testable.

### 5.1 Health Score Calculation

```
Input: nutrition JSON + user goal

Base score: 60 (neutral starting point)

Penalties:
  - calories > 600 per meal:        -10
  - sugar_g > 20:                   -15
  - fat_g > 25:                     -10
  - fiber_g < 2:                    -5
  - category === 'snack':           -5

Bonuses:
  - protein_g > 20:                 +15
  - fiber_g > 5:                    +10
  - category === 'vegetable':       +15
  - calories < 400:                 +10
  - confidence_score > 0.8:         +5  (data reliability bonus)

Goal modifiers:
  WEIGHT_LOSS:
    - calories < 400:               +10 additional
    - sugar_g > 15:                 -10 additional

  MUSCLE_GAIN:
    - protein_g > 25:               +15 additional
    - calories < 300:               -10 additional (too low for bulking)

  MAINTENANCE:
    - No additional modifiers

Final score: clamp(rawScore, 0, 100)
```

### 5.2 Goal Alignment Evaluation

```
Input: nutrition JSON + user goal + today's running totals from Firestore

Returns:
  {
    aligned: boolean,
    reason: string,
    remainingCalories: number,
    remainingProtein: number,
    overBudgetBy: number | null
  }
```

### 5.3 Streak Detection

```
Input: meal log array sorted by date (from Firestore)

Logic:
  1. Group meals by calendar date
  2. Calculate daily average health score per day
  3. Count consecutive days where avg score >= 60
  4. A day with zero meals does NOT break the streak
     (streak only breaks on a day with avg score < 60)

Returns:
  {
    currentStreak: number,  // days
    isStreakDay: boolean,
    bestStreak: number
  }
```

---

## 6. Nudge Generation System

**Design:** Context-aware, non-repetitive nudges based on Decision Engine output.

### 6.1 Nudge Logic Tree

```
healthScore >= 80?
  └─ YES → "Great choice" nudge + streak reinforcement
  └─ NO
      │
      ▼
  healthScore >= 50?
    └─ YES → "Decent, here's how to improve" nudge
    └─ NO
        │
        ▼
    goal === WEIGHT_LOSS AND sugar_g > 20?
      └─ YES → Sugar-specific nudge + low-sugar alternative
    goal === MUSCLE_GAIN AND protein_g < 10?
      └─ YES → Protein-specific nudge + high-protein alternative
    generic low-score nudge + healthier category suggestion
```

### 6.2 Nudge Message Templates

| Trigger | Message |
|---|---|
| score >= 80 | "Excellent! This meal strongly supports your [goal] goal." |
| score >= 80 + streak >= 3 | "You're on a [n]-day healthy streak — this keeps it going!" |
| score 50–79 | "Solid choice. Swapping [item] for [alt] would boost your score by ~[n] points." |
| score < 50, weight loss, high sugar | "This has [x]g of sugar — [alt] has under 5g and fits your goal better." |
| score < 50, muscle gain, low protein | "Only [x]g of protein here. Try adding [alt] to hit your daily target." |
| score < 50, generic | "This meal scores low for your goal. A [category] option nearby could work better." |
| pattern detected | "Pattern alert: You tend to eat high-[nutrient] food on [day/time]. Here's a swap." |

### 6.3 Healthy Alternative Suggestion Logic

```
Based on deficient nutrient + user goal:

  Low protein + muscle gain  → suggest: eggs, paneer, dal, chicken
  High sugar + weight loss   → suggest: fruits, nuts, oats
  High fat + any goal        → suggest: grilled over fried equivalent
  Low fiber + any goal       → suggest: add salad or whole grain side
  High calories + weight loss→ suggest: smaller portion or lighter version

Suggestions are filtered to match regional context (Indian food defaults included).
```

---

## 7. Behavioral Pattern Detector

**File:** `src/lib/patternDetector.js`  
**Triggers:** After user has 5+ meals logged. Re-runs on each new meal save.

### 7.1 What It Detects

```
Input: full meal history array from Firestore (last 30 days)

Analysis:
  1. TIME PATTERNS
     - Group meals by hour bucket: morning (6–11), afternoon (12–17), evening (18–23)
     - Find hour bucket with highest avg sugar_g and avg fat_g
     - If avg sugar_g > 18 in a bucket with 3+ entries → flag "evening sugar pattern"

  2. FREQUENCY PATTERNS
     - Count occurrences of each food category per week
     - If 'snack' appears > 4x/week → flag "frequent snacking"
     - If 'vegetable' appears < 2x/week → flag "low vegetable intake"

  3. SCORE TREND
     - Calculate 7-day rolling avg health score
     - If trend is declining (week 2 avg < week 1 avg by > 10 pts) → flag "declining trend"
     - If trend is improving → generate positive reinforcement

  4. GOAL DRIFT
     - For weight loss: if weekly avg calories > target + 200 → flag "calorie drift"
     - For muscle gain: if weekly avg protein < target - 15g → flag "protein deficit"
```

### 7.2 Output Format

```json
{
  "patterns": [
    {
      "type": "time_pattern",
      "severity": "warning",
      "title": "High-sugar evenings",
      "message": "You consume high-sugar foods most evenings. This may affect your weight loss goal.",
      "suggestion": "Try replacing your evening snack with a handful of nuts or a fruit."
    }
  ],
  "weeklyAvgScore": 64,
  "scoreTrend": "improving",
  "insightCount": 2
}
```

This output powers the `WeeklyInsights` component on the dashboard.

---

## 8. Nearby Places Integration

**Service:** Google Maps Places API (New) — Nearby Search  
**Route:** `GET /api/places?lat={lat}&lng={lng}&goal={goal}&score={healthScore}`

### 8.1 Server-Side Logic

```
Receive lat, lng, goal, healthScore
      │
      ▼
Build Places API request:
  - location: { lat, lng }
  - radius: 2000 (meters)
  - type: "restaurant"
  - keyword: goal-based keyword
      │
      ▼
Goal → keyword mapping:
  WEIGHT_LOSS  → "salad healthy light"
  MUSCLE_GAIN  → "protein grill chicken"
  MAINTENANCE  → "balanced healthy"
      │
      ▼
Filter results:
  - Only return places with rating >= 3.8
  - Limit to 5 results
  - Return: name, address, rating, place_id, photo_reference
      │
      ▼
Return to client
```

### 8.2 Privacy Note

User location is requested client-side via the browser Geolocation API. Location coordinates are sent to `/api/places` only for the duration of the request and are never stored in Firestore.

---

## 9. Data Layer — Firestore Schema

### Collections

```
/users/{uid}
  goal: "weight_loss" | "muscle_gain" | "maintenance"
  dailyCalorieTarget: number
  dailyProteinTarget: number
  displayName: string
  createdAt: timestamp

/users/{uid}/meals/{mealId}
  name: string
  calories: number
  protein_g: number
  fat_g: number
  sugar_g: number
  fiber_g: number
  category: string
  healthScore: number          ← computed by Decision Engine
  nudgeMessage: string         ← generated nudge stored for history
  inputType: "text" | "image"
  timestamp: timestamp

/users/{uid}/streaks/current
  currentStreak: number
  lastActiveDate: string       ← "YYYY-MM-DD"
  bestStreak: number

/nutritionCache/{normalizedFoodName}
  data: { ...nutrition JSON }
  cachedAt: timestamp
  hitCount: number             ← for cache analytics
```

### Firestore Indexes

```
Collection: meals
  - Composite index: uid ASC + timestamp DESC  (for dashboard meal log query)
  - Composite index: uid ASC + timestamp ASC   (for pattern detector)
```

---

## 10. Security Model

### 10.1 Firebase Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only access their own profile
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // Users can only access their own meals
      match /meals/{mealId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }

      // Users can only access their own streak data
      match /streaks/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // Nutrition cache is read-only for authenticated users
    // Only server-side API routes write to this collection
    match /nutritionCache/{foodName} {
      allow read: if request.auth != null;
      allow write: if false;  // server-side only via Admin SDK
    }
  }
}
```

### 10.2 API Key Security

| Key | Location | Exposed to client? |
|---|---|---|
| `GEMINI_API_KEY` | `.env.local` (server only) | No — used only in `/api/analyze` |
| `MAPS_API_KEY` | `.env.local` (server only) | No — used only in `/api/places` |
| `FIREBASE_SERVICE_ACCOUNT` | `.env.local` (server only) | No — Admin SDK only |
| Firebase client config | `NEXT_PUBLIC_*` vars | Yes — Firebase client SDK (safe by design; security enforced by rules) |

### 10.3 Input Sanitization

```
Text input:
  - Strip all HTML tags before sending to Gemini
  - Limit to 200 characters max
  - Reject inputs that are only whitespace

Image input:
  - Validate MIME type is image/jpeg or image/png
  - Reject files larger than 5MB before upload
  - Compress client-side to max 800px / 0.8 quality
```

---

## 11. Efficiency & Caching Strategy

| Optimization | Where | Detail |
|---|---|---|
| Nutrition cache | Firestore `/nutritionCache` | Cache Gemini responses for 7 days by normalized food name key. Saves ~90% of Gemini API calls for common foods. |
| Debounced input | `FoodInput.jsx` | Text input debounced 300ms to avoid premature API calls |
| Image compression | Client-side | Canvas-based resize before upload — reduces payload from avg 3MB to ~150KB |
| Skeleton loading | All async components | Skeleton screens shown while Firestore and API calls resolve — prevents layout shift |
| Meal log pagination | `firestoreService.js` | Load only the last 10 meals initially; paginate on scroll |
| Pattern detection throttle | `patternDetector.js` | Re-run max once per new meal save, not on every render |
| Next.js API route caching | `route.js` headers | Places API results cached for 10 minutes via `Cache-Control` header |

---

## 12. Testing Strategy

**Framework:** Jest + React Testing Library  
**File:** `__tests__/decisionEngine.test.js`

### Test Cases

```javascript
// Test 1: Zero-calorie input handled gracefully
test('handles zero-calorie input without crashing', () => {
  const result = calculateHealthScore({ calories: 0, protein_g: 0, sugar_g: 0, fat_g: 0, fiber_g: 0 }, 'maintenance');
  expect(result).toBeGreaterThanOrEqual(0);
  expect(result).toBeLessThanOrEqual(100);
});

// Test 2: High-sugar penalty applied for weight loss goal
test('applies sugar penalty for weight loss goal', () => {
  const highSugar = { calories: 300, protein_g: 5, sugar_g: 25, fat_g: 5, fiber_g: 1, category: 'snack' };
  const lowSugar  = { calories: 300, protein_g: 5, sugar_g: 5,  fat_g: 5, fiber_g: 1, category: 'snack' };
  const highScore = calculateHealthScore(highSugar, 'weight_loss');
  const lowScore  = calculateHealthScore(lowSugar,  'weight_loss');
  expect(lowScore).toBeGreaterThan(highScore);
});

// Test 3: Protein bonus applied for muscle gain goal
test('applies protein bonus for muscle gain goal', () => {
  const highProtein = { calories: 400, protein_g: 30, sugar_g: 5, fat_g: 10, fiber_g: 3, category: 'protein' };
  const score = calculateHealthScore(highProtein, 'muscle_gain');
  expect(score).toBeGreaterThanOrEqual(75);
});

// Test 4: Streak correctly counts consecutive healthy days
test('detects 3-day streak from meal history', () => {
  const meals = [
    { timestamp: '2025-01-01', healthScore: 72 },
    { timestamp: '2025-01-02', healthScore: 65 },
    { timestamp: '2025-01-03', healthScore: 80 },
  ];
  const { currentStreak } = calculateStreak(meals);
  expect(currentStreak).toBe(3);
});

// Test 5: API error returns safe fallback, not a crash
test('returns fallback nudge when nutrition data is missing', () => {
  const result = generateNudge(null, 'weight_loss', 0);
  expect(result).toBeDefined();
  expect(typeof result.message).toBe('string');
});
```

### Additional Validation

- Manual testing of all input types: text (valid), text (empty), text (gibberish), image (valid), image (non-food)
- Test Firebase Security Rules using the Firebase Emulator
- Test Gemini API failure by mocking fetch in Jest

---

## 13. Accessibility Checklist

| Item | Implementation |
|---|---|
| Semantic HTML | Use `<main>`, `<section>`, `<article>`, `<nav>`, `<button>` throughout |
| ARIA labels | `aria-label` on all icon-only buttons (camera, submit, close) |
| Live region | `role="status" aria-live="polite"` on the NudgeCard output so screen readers announce new nudges |
| Form labels | All inputs have associated `<label>` elements (not just placeholder text) |
| Color contrast | Health score colors use WCAG AA compliant palette — verified via contrast checker |
| Keyboard navigation | Tab order follows visual flow; modal dialogs trap focus and restore on close |
| Image alt text | Uploaded food images get `alt` set to the detected food name from Gemini |
| Error states | API failures render visible error messages, not silent failures |
| Mobile-first | Base styles for mobile, `min-width` breakpoints for desktop |
| Reduced motion | Streak animation wrapped in `@media (prefers-reduced-motion: no-preference)` |

---

## 14. Google Services Map

| Service | How It's Used | Why Meaningful |
|---|---|---|
| **Firebase Auth** | Google Sign-In, session persistence, user identity | Core security — every data access is scoped to authenticated uid |
| **Firestore** | Meal logs, user profiles, streaks, nutrition cache | Real-time data layer with offline support; powers the entire persistence model |
| **Gemini API (1.5 Flash)** | Text and image food analysis → structured nutrition JSON | The core AI intelligence — converts any food input into actionable data |
| **Google Maps Places API** | Nearby healthy restaurant suggestions filtered by user goal | Bridges digital insights with real-world action — closes the behavior loop |

---

## 15. Deployment Workflow

### Option A — Firebase Hosting (Recommended for speed)

```bash
# 1. Build Next.js as static export
next build && next export

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting
```

Note: Static export requires all API routes to be replaced with Firebase Cloud Functions, or use the experimental Next.js Firebase adapter.

### Option B — Google Cloud Run (Recommended for rubric impact)

```bash
# 1. Build Docker image
docker build -t crave-nudge .

# 2. Push to Google Artifact Registry
docker tag crave-nudge gcr.io/{PROJECT_ID}/crave-nudge
docker push gcr.io/{PROJECT_ID}/crave-nudge

# 3. Deploy to Cloud Run
gcloud run deploy crave-nudge \
  --image gcr.io/{PROJECT_ID}/crave-nudge \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=...,MAPS_API_KEY=...
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 16. Environment Variables

### `.env.example` (commit this)

```bash
# Firebase Client SDK (safe to expose — security enforced by Firestore rules)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-only keys (never expose to client)
GEMINI_API_KEY=your_gemini_api_key
MAPS_API_KEY=your_maps_api_key
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### `.env.local` (never commit — add to `.gitignore`)

Fill in real values from Google Cloud Console + Firebase Console.

---

## 17. Assumptions & Constraints

| Assumption | Detail |
|---|---|
| **Serving size** | Nutrition data from Gemini is assumed to be per standard Indian serving (unless image suggests otherwise). Users are shown the serving size in the UI. |
| **Food recognition accuracy** | Gemini confidence score is surfaced to the user. Scores below 0.5 show a disclaimer: "This estimate may be inaccurate — verify with a label if possible." |
| **Daily targets** | Default daily calorie target is 2000 kcal and protein target is 50g. Users can override these during onboarding and in settings. |
| **Streak definition** | A healthy day = average health score ≥ 60 across all meals logged that day. A day with no meals logged does not break the streak. |
| **Pattern detection threshold** | Behavioral patterns are only surfaced after 5+ meals are logged to avoid false signals from insufficient data. |
| **Location permission** | Nearby Places feature requires browser geolocation permission. If denied, the section shows a graceful fallback message instead of an error. |
| **Offline support** | Firestore SDK provides automatic offline caching. Meals logged while offline are queued and synced when connection resumes. |
| **Image input** | Image analysis is best-effort. The app does not claim medical-grade accuracy and displays appropriate disclaimers. |

---

*CraveNudge — built for the Food & Health AI Hackathon*  
*Stack: Next.js 14 · Firebase Auth · Firestore · Gemini API · Google Maps Places API*
