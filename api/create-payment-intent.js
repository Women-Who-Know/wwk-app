import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { email, name } = req.body;

    // Create a PaymentIntent with capture_method: manual
    // This authorises the card but does NOT charge it yet
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5700, // $57.00 in cents
      currency: "cad",
      capture_method: "manual",
      metadata: { email, name },
      description: "WWK Founder Benchmark Assessment",
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
}
