/**
 * firebase-admin.ts
 *
 * Firebase Admin SDK initialisation for server-side API routes.
 * The Admin SDK bypasses Firestore security rules and must NEVER
 * be imported or bundled in any client-side code.
 *
 * The FIREBASE_SERVICE_ACCOUNT_JSON environment variable must be the
 * full service-account JSON string from the Google Cloud Console.
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let _app: App;

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. " +
        "The Admin SDK requires a service-account credential to operate. " +
        "Add the full JSON string to your .env.local file."
    );
  }

  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. " +
        "Ensure the entire JSON object is on a single line in your .env.local file."
    );
  }

  _app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
} else {
  _app = getApps()[0];
}

/** Firestore instance backed by the Admin SDK (server-only). */
const adminDb = getFirestore(_app);

export { adminDb };
