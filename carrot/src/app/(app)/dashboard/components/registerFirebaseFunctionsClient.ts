"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFunctions } from "@firebase/functions";
import { firebaseApp as app } from '../../../../lib/firebase';

// Defensive: ensure app is initialized (workaround for Next.js/Firebase 12+ bug)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

const clientApp: FirebaseApp = getApps().length ? app : initializeApp(firebaseConfig);

if (typeof window !== "undefined" && clientApp) {
  try {
    window.carrotFunctions = getFunctions(clientApp, "us-central1");
    console.log("[registerFirebaseFunctionsClient] Functions registered!", window.carrotFunctions);
  } catch (e) {
    console.error("[registerFirebaseFunctionsClient] Functions registration error:", e);
  }
}

declare global {
  interface Window {
    carrotFunctions: ReturnType<typeof getFunctions>;
  }
}
