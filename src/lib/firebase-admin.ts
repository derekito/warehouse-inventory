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

// Test the connection
adminDb.collection('products').limit(1).get()
  .then(() => console.log('Firebase Admin connection test successful'))
  .catch(error => console.error('Firebase Admin connection test failed:', error)); 