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

// Initialize Firebase
let firebaseApp: FirebaseApp;
import type { Auth } from 'firebase/auth';
let auth: Auth;
import type { Firestore } from 'firebase/firestore';
let db: Firestore;
import type { FirebaseStorage } from 'firebase/storage';
let storage: FirebaseStorage;
let googleProvider: GoogleAuthProvider;

// Initialize Firebase only once
const initializeFirebase = () => {
  if (!getApps().length) {
    const app = initializeApp(firebaseConfig);
    firebaseApp = app;
    
    // Initialize Firestore with settings that work in both server and client
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true
    });
    
    // Initialize other services
    auth = getAuth(firebaseApp);
    storage = getStorage(firebaseApp);
    googleProvider = new GoogleAuthProvider();
  } else {
    firebaseApp = getApp();
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    storage = getStorage(firebaseApp);
    googleProvider = new GoogleAuthProvider();
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
  throw error; // Re-throw to prevent silent failures
}

export { firebaseApp, auth, db, storage, googleProvider };
