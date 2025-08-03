import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const { HttpsError } = functions.https;


export const finalizeOnboardingSession = functions.https.onCall(async (req: any, context: any) => {
  const { sessionId } = req.data || {};
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId required.');

  const db = admin.firestore();
  const sessionRef = db.collection('onboardingSessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'Session not found.');
  const session = sessionSnap.data()!;
  if (session.ownerId !== uid) throw new HttpsError('permission-denied', 'Not your session.');
  if (session.status !== 'active') throw new HttpsError('failed-precondition', 'Session not active.');

  // Validate required steps completed
  const required: string[] = session.required || [];
  const completed: string[] = session.completed || [];
  const missing = required.filter(s => !completed.includes(s));
  if (missing.length) {
    throw new HttpsError('failed-precondition', `Missing required steps: ${missing.join(', ')}`);
  }

  // Find staged profile photo
  const stagedAssetsRef = sessionRef.collection('stagedAssets');
  const photoQuery = await stagedAssetsRef.where('kind', '==', 'profilePhoto').where('uploadState', '==', 'done').limit(1).get();
  const hasPhoto = !photoQuery.empty;
  let photoURL: string | undefined;
  let photoRev: number | undefined;

  // Compute userSnap and bucket up front for use later
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.data() || {};
  const bucket = admin.storage().bucket(); // default bucket

  if (hasPhoto) {
    const photoDoc = photoQuery.docs[0].data() as any;
    const storagePath: string = photoDoc.storagePath; // users/{uid}/staged/{sessionId}/{assetId}.jpg
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
  const userUpdates: any = {
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
  const deletions: Promise<any>[] = [];
  stagedAssets.forEach(doc => {
    const p = bucket.file((doc.data() as any).storagePath).delete().catch(() => null);
    deletions.push(p, doc.ref.delete());
  });
  await Promise.all(deletions);

  return { ok: true, photoURL, photoRev };
});
