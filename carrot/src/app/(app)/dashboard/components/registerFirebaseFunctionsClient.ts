"use client";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";

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

// Only initialize in browser environment
if (typeof window !== "undefined") {
  try {
    const clientApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const functions = getFunctions(clientApp, "us-central1");
    // Attach a convenient httpsCallable helper to match expected shape
    (functions as any).httpsCallable = (name: string) => httpsCallable(functions, name);
    window.carrotFunctions = functions as any;
    console.log("[registerFirebaseFunctionsClient] Functions registered!", window.carrotFunctions);
  } catch (e) {
    console.error("[registerFirebaseFunctionsClient] Functions registration error:", e);
  }
}

declare global {
  interface Window {
    // Optional to match existing ambient declaration
    carrotFunctions?: { httpsCallable: (name: string) => any };
  }
}
