// Cloud Function to clean up abandoned onboarding drafts and superseded assets
import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const cleanupOnboardingDrafts = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const firestore = getFirestore();
  const storage = getStorage().bucket();
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000; // 24h ago

  // Query all open onboarding drafts older than 24h
  const usersSnap = await firestore.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const draftsSnap = await firestore.collection(`users/${uid}/onboardingDrafts`).where('draftStatus', '!=', 'closed').where('updatedAt', '<', new Date(cutoff)).get();
    for (const draftDoc of draftsSnap.docs) {
      const draft = draftDoc.data();
      const sessionId = draftDoc.id;
      // Delete superseded assets
      if (draft.image && draft.image.superseded) {
        await storage.file(draft.image.storagePath).delete().catch(() => {});
      }
      // Delete all staged assets under session
      const [files] = await storage.getFiles({ prefix: `users/${uid}/staged/${sessionId}/` });
      for (const file of files) {
        await file.delete().catch(() => {});
      }
      // Optionally delete the draft doc
      await draftDoc.ref.delete();
    }
  }
  return null;
});
