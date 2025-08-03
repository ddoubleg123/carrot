"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeOnboardingSession = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const { HttpsError } = functions.https;
exports.finalizeOnboardingSession = functions.https.onCall(async (req, context) => {
    const { sessionId } = req.data || {};
    const uid = context.auth?.uid;
    if (!uid)
        throw new HttpsError('unauthenticated', 'Sign in first.');
    if (!sessionId)
        throw new HttpsError('invalid-argument', 'sessionId required.');
    const db = admin.firestore();
    const sessionRef = db.collection('onboardingSessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        throw new HttpsError('not-found', 'Session not found.');
    const session = sessionSnap.data();
    if (session.ownerId !== uid)
        throw new HttpsError('permission-denied', 'Not your session.');
    if (session.status !== 'active')
        throw new HttpsError('failed-precondition', 'Session not active.');
    // Validate required steps completed
    const required = session.required || [];
    const completed = session.completed || [];
    const missing = required.filter(s => !completed.includes(s));
    if (missing.length) {
        throw new HttpsError('failed-precondition', `Missing required steps: ${missing.join(', ')}`);
    }
    // Find staged profile photo
    const stagedAssetsRef = sessionRef.collection('stagedAssets');
    const photoQuery = await stagedAssetsRef.where('kind', '==', 'profilePhoto').where('uploadState', '==', 'done').limit(1).get();
    const hasPhoto = !photoQuery.empty;
    let photoURL;
    let photoRev;
    // Compute userSnap and bucket up front for use later
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap.data() || {};
    const bucket = admin.storage().bucket(); // default bucket
    if (hasPhoto) {
        const photoDoc = photoQuery.docs[0].data();
        const storagePath = photoDoc.storagePath; // users/{uid}/staged/{sessionId}/{assetId}.jpg
        const srcFile = bucket.file(storagePath);
        // Compute final path (bump version)
        photoRev = (user.profile?.photoRev || 0) + 1;
        const finalPath = `users/${uid}/profile/photo_v${photoRev}.jpg`;
        // Copy to final
        await srcFile.copy(bucket.file(finalPath));
        // Optionally make it private or sign a URL; here we keep it private and use gs://
        photoURL = `gs://${bucket.name}/${finalPath}`;
    }
    // Commit updates to /users/{uid}
    const userUpdates = {
        onboardingStatus: 'complete',
        onboardingSessionId: sessionId,
        updatedAt: new Date(),
        _v: 1,
    };
    // Merge drafts if present
    if (session.drafts?.account?.displayName || hasPhoto || session.drafts?.prefs) {
        userUpdates.profile = {
            ...(user.profile || {}),
            displayName: session.drafts?.account?.displayName,
            photoURL: photoURL ?? (user.profile?.photoURL || null),
            photoRev: photoRev ?? (user.profile?.photoRev || 0),
        };
        if (session.drafts?.prefs) {
            userUpdates.preferences = session.drafts.prefs;
        }
    }
    await db.runTransaction(async (tx) => {
        tx.update(sessionRef, { status: 'finished', updatedAt: new Date() });
        tx.set(db.collection('users').doc(uid), userUpdates, { merge: true });
    });
    // Cleanup staged assets (optional but recommended)
    const stagedAssets = await stagedAssetsRef.get();
    const deletions = [];
    stagedAssets.forEach(doc => {
        const p = bucket.file(doc.data().storagePath).delete().catch(() => null);
        deletions.push(p, doc.ref.delete());
    });
    await Promise.all(deletions);
    return { ok: true, photoURL, photoRev };
});
//# sourceMappingURL=finalizeOnboarding.js.map