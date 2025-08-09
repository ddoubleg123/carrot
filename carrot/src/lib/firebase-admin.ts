// @ts-ignore
const admin = require('firebase-admin');
import type { App } from 'firebase-admin/app';

console.log('[firebase-admin] FIREBASE_PRIVATE_KEY (raw):', process.env.FIREBASE_PRIVATE_KEY);
console.log('[firebase-admin] FIREBASE_PRIVATE_KEY (parsed):', process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'));

const firebaseAdminConfig = {
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

console.log('[firebase-admin] using storageBucket:', firebaseAdminConfig.storageBucket);
let app: App;
if (!admin.apps.length) {
  app = admin.initializeApp(firebaseAdminConfig);
} else {
  app = admin.app();
}

export { app };
export const adminAuth = admin.auth(app);
