import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Lazy init Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Stripe client using env var
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

async function verifyFirebaseUser(req: any): Promise<string | null> {
  try {
    const auth = admin.auth();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch (e) {
    return null;
  }
}

export const createCheckoutSession = onRequest({
  cors: true,
  secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_SYNTH', 'STRIPE_SUCCESS_URL', 'STRIPE_CANCEL_URL']
}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  const uid = await verifyFirebaseUser(req);
  if (!uid) { res.status(401).send('Unauthorized'); return; }

  const price = process.env.STRIPE_PRICE_SYNTH as string;
  if (!price) { res.status(500).send('Missing STRIPE_PRICE_SYNTH'); return; }

  try {
    // Ensure we have or create a Stripe Customer for this user
    const userRef = admin.firestore().doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.data() || {};

    let customerId: string | null = user.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId || undefined,
      line_items: [{ price, quantity: 1 }],
      success_url: (process.env.STRIPE_SUCCESS_URL as string) || 'https://example.com/success',
      cancel_url: (process.env.STRIPE_CANCEL_URL as string) || 'https://example.com/cancel',
      metadata: { uid },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    logger.error('createCheckoutSession error', e);
    res.status(500).send(e.message || 'Stripe error');
  }
});

export const createPortalSession = onRequest({
  cors: true,
  secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PORTAL_RETURN_URL']
}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  const uid = await verifyFirebaseUser(req);
  if (!uid) { res.status(401).send('Unauthorized'); return; }

  try {
    const user = (await admin.firestore().doc(`users/${uid}`).get()).data() || {};
    if (!user.stripeCustomerId) { res.status(400).send('No customer'); return; }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: (process.env.STRIPE_PORTAL_RETURN_URL as string) || 'https://example.com/account',
    });
    res.json({ url: session.url });
  } catch (e: any) {
    logger.error('createPortalSession error', e);
    res.status(500).send(e.message || 'Stripe error');
  }
});

export const stripeWebhook = onRequest({
  cors: true,
  secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
}, async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) { res.status(400).send('Missing signature'); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (err: any) {
    logger.error('Webhook signature verification failed', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const uid = s.metadata?.uid;
        if (uid) {
          await admin.firestore().doc(`users/${uid}`).set({ plan: 'synth', stripeCustomerId: (s.customer as string) || null }, { merge: true });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        // Find user by stripeCustomerId
        const snap = await admin.firestore().collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!snap.empty) {
          const uid = snap.docs[0].id;
          const active = sub.status === 'active' || sub.status === 'trialing';
          await admin.firestore().doc(`users/${uid}`).set({ plan: active ? 'synth' : null }, { merge: true });
        }
        break;
      }
      default:
        // Ignore other events for now
        break;
    }
    res.json({ received: true });
  } catch (e: any) {
    logger.error('stripeWebhook handler error', e);
    res.status(500).send('Webhook handler error');
  }
});
