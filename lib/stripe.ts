import Stripe from "stripe";

// Server-only Stripe client. NEVER import this from a client component.
// Live key in production, test key in dev. Matches the aio-website pattern.

const secretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_TEST_KEY ?? process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn(
    "Stripe secret key not configured (STRIPE_SECRET_TEST_KEY in dev / STRIPE_SECRET_KEY in prod). Payment features will not work.",
  );
}

export const stripe = new Stripe(secretKey ?? "sk_test_placeholder", {
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_TEST_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
