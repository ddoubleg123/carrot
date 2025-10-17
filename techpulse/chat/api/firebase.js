import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmdK_8bVKr--qgJ8cPGqCX3m8QS5EkMPg",
  authDomain: "techpulse-78421.firebaseapp.com",
  projectId: "techpulse-78421",
  appId: "1:416281156741:web:c8c6da13d20b17c4a1ddec",
  storageBucket: "techpulse-78421.firebasestorage.app",
  messagingSenderId: "416281156741"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, rtdb, storage, serverTimestamp, Timestamp };
export const nowMs = () => Date.now();
