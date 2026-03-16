import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Name and email required." });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5700, // $57.00 CAD in cents
      currency: "cad",
      capture_method: "manual",       // authorize now, capture after admin sends report
      payment_method_types: ["card"],
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
