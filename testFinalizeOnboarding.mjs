import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBhgqlFzLnTJJ6WrR7X4Z1bYFpXmeidANo",
  authDomain: "involuted-river-466315-p0.firebaseapp.com",
  projectId: "involuted-river-466315-p0",
  storageBucket: "involuted-river-466315-p0.firebasestorage.app",
  messagingSenderId: "591459094147",
  appId: "1:591459094147:web:f915348d807c772c54d5b6",
  measurementId: "G-PLJVZ74RXN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

async function testFinalizeOnboarding() {
  // Sign in as a test user (replace with a real email/password from your Firebase Auth)
  await signInWithEmailAndPassword(auth, "danielgouldman@gmail.com", "H0uston!!!");

  const finalizeOnboardingSession = httpsCallable(functions, "finalizeOnboardingSession");
  try {
    const result = await finalizeOnboardingSession({ sessionId: "d5261116-65cc-4735-b8dc-5ec97c8b0bd3" });
    console.log("Function result:", result.data);
  } catch (err) {
    console.error("Function error:", err);
  }
}

testFinalizeOnboarding();