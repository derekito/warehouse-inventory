import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    } as ServiceAccount),
  });
}

export const adminDb = getFirestore();

// Prefer REST over gRPC on Vercel/serverless — fewer hung connections and
// clearer failures. Must run before any Firestore reads/writes.
try {
  adminDb.settings({ preferRest: true, ignoreUndefinedProperties: true });
} catch {
  // settings() throws if already called (hot reload / warm instance)
}
