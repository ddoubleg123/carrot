/// <reference path="./window-carrotFunctions.d.ts" />
"use client";
import { useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";



export default function FirebaseClientInit() {
  useEffect(() => {
    (async () => {
      const { firebaseApp } = await import("../../../../lib/firebase");
      if (typeof window !== "undefined" && firebaseApp) {
        const functions = getFunctions(firebaseApp, "us-central1");
        window.carrotFunctions = {
          httpsCallable: (name) => httpsCallable(functions, name)
        };
        console.log("[FirebaseClientInit] window.carrotFunctions set:", window.carrotFunctions);
      }
    })();
  }, []);
  return null;
}
