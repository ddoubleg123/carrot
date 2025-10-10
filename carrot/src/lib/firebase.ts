console.log("FIREBASE CONFIG:", {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
});
console.log("Before Firebase initializeApp");


import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// CRITICAL FIX: Use correct Firebase storage bucket domain (.appspot.com not .firebasestorage.app)
const resolvedBucket = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.includes('.appspot.com'))
  ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
  : `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;

// Ensure the config uses the resolved bucket
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: allow reassignment of property for runtime normalization
firebaseConfig.storageBucket = resolvedBucket;
console.log('[firebase.ts] normalized storageBucket:', resolvedBucket);

// Initialize Firebase
let firebaseApp: FirebaseApp;
import type { Auth } from 'firebase/auth';
let auth: Auth;
import type { Firestore } from 'firebase/firestore';
let db: Firestore;
import type { FirebaseStorage } from 'firebase/storage';
let storage: FirebaseStorage;
let googleProvider: GoogleAuthProvider;

// CRITICAL FIX: Initialize Firebase only once with singleton pattern
let _firebaseInitialized = false;
const initializeFirebase = () => {
  if (_firebaseInitialized && firebaseApp) {
    console.log('[firebase.ts] Firebase already initialized, reusing existing instance');
    return { firebaseApp, auth, db, storage, googleProvider };
  }
  
  if (!getApps().length) {
    const app = initializeApp(firebaseConfig);
    console.log("[firebase.ts] Firebase initialized");
    firebaseApp = app;
    
    // Initialize Firestore with settings that work in both server and client
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true
    });
    console.log("[firebase.ts] Firestore initialized");
    
    // Initialize other services
    auth = getAuth(firebaseApp);
    const bucket = resolvedBucket;
    
    // CRITICAL FIX: Cache storage reference to avoid excessive getStorage() calls
    if (!storage) {
      storage = bucket ? getStorage(firebaseApp, `gs://${bucket}`) : getStorage(firebaseApp);
      console.log('[firebase.ts] Storage initialized with bucket:', bucket);
    } else {
      console.log('[firebase.ts] Reusing cached storage reference');
    }
    googleProvider = new GoogleAuthProvider();
    _firebaseInitialized = true;
  } else {
    firebaseApp = getApp();
    console.log("[firebase.ts] Using existing Firebase app");
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    const bucket = resolvedBucket;
    
    // CRITICAL FIX: Reuse cached storage reference
    if (!storage) {
      storage = bucket ? getStorage(firebaseApp, `gs://${bucket}`) : getStorage(firebaseApp);
      console.log('[firebase.ts] Storage initialized for existing app with bucket:', bucket);
    } else {
      console.log('[firebase.ts] Reusing cached storage reference');
    }
    
    googleProvider = new GoogleAuthProvider();
    _firebaseInitialized = true;
  }
  
  return { firebaseApp, auth, db, storage, googleProvider };
};

// Initialize Firebase
try {
  const firebase = initializeFirebase();
  firebaseApp = firebase.firebaseApp;
  auth = firebase.auth;
  db = firebase.db;
  storage = firebase.storage;
  googleProvider = firebase.googleProvider;
  // Log storage config for debugging
  console.log('[firebase.ts] storageBucket:', firebaseConfig.storageBucket);
  console.log('[firebase.ts] storage instance:', storage);
} catch (error) {
  console.error('Firebase initialization error', error);
  // Don't throw - allow the app to continue with undefined Firebase
  // Components should check if firebase is initialized before using
  console.warn('[firebase.ts] Firebase will be unavailable for this request');
}

export { firebaseApp, auth, db, storage, googleProvider };
