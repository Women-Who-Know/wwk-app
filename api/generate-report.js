import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { answers, paymentIntentId, name, email, industry, businessType, yearsInBusiness } = req.body;

  if (!paymentIntentId || !answers || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const isBeta = paymentIntentId === "beta-free";

    // 1. Verify the payment intent is authorized (skip for beta)
    if (!isBeta) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!["requires_capture", "succeeded"].includes(intent.status)) {
        return res.status(402).json({ error: "Payment not authorized" });
      }
    }

    // 2. Generate the report via Claude (server-side, key never exposed)
    const reportContent = await generateReport(answers, name, industry, businessType, yearsInBusiness);

    // 3. Capture the payment now that we have a real report (skip for beta)
    if (!isBeta) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status === "requires_capture") {
        await stripe.paymentIntents.capture(paymentIntentId);
      }
    }

    // 4. Send admin notification for review before delivery
    const approvalToken = crypto.randomBytes(32).toString("hex");
    await sendAdminNotification(email, name, reportContent, approvalToken, paymentIntentId);

    // 5. Store report temporarily for delivery (using a simple approach)
    // In production this would go to a database — for now admin email triggers delivery
    res.status(200).json({
      success: true,
      message: "Report generated and payment captured. Delivery within 24 hours.",
    });

  } catch (err) {
    console.error("Report generation error:", err);

    // If Claude failed, cancel the payment intent so customer isn't charged
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (cancelErr) {
      console.error("Failed to cancel payment intent:", cancelErr);
    }

    res.status(500).json({ error: "Report generation failed. Your card has not been charged." });
  }
}

async function generateReport(answers, name, industry, businessType, yearsInBusiness) {
  const answersText = Object.entries(answers)
    .map(([q, a]) => `${q}: ${Array.isArray(a) ? a.join(", ") : a}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4000,
    system: `You are writing a Founder Benchmark Assessment report for Women Who Know, a coaching platform founded by Anitta Hamming.

Anitta's voice: direct, warm, diagnostic. She does not cushion hard truths but she never makes women feel stupid. She names patterns clearly. She uses plain language. She does not use corporate jargon. She speaks to founders who are smart, capable, and stuck — not beginners.

Report structure (follow exactly):
1. BUSINESS SNAPSHOT — 2-3 sentences summarising what this founder is running and where they are. Specific to their answers.
2. BENCHMARK COMPARISON — How their key metrics (revenue, pricing, team structure, client acquisition) compare to others at their stage in their industry. Be specific. Name gaps.
3. GAP ANALYSIS — The top 3 gaps between where they are and where they should be. Each gap gets: a name, a one-paragraph explanation, and one concrete action they can take this week.
4. CLEAR / WORTHY / WEALTHY SCORES — Score each pillar out of 10. One sentence explaining each score. Be honest — a 6 is a 6.
5. PATH FORWARD — 3-5 sentences on what the next 90 days should look like if they actually want to move the number.
6. NEXT STEP — "The Reset Point is currently closed to new clients. If you want to know exactly what to do with this report, join the waitlist at womenwhoknow.ca/reset"

Rules:
- Every paragraph must reference something specific from their answers. No generic advice.
- If two founders in the same industry gave different answers, their reports must read completely differently.
- Do not be gentle about gaps. Name them.
- Do not use bullet points in the body text — write in paragraphs.
- Do not use the word "journey."`,
    messages: [
      {
        role: "user",
        content: `Generate a Founder Benchmark Assessment report for:

Name: ${name}
Industry: ${industry}
Business type: ${businessType}
Years in business: ${yearsInBusiness}

Assessment answers:
${answersText}`,
      },
    ],
  });

  return message.content[0].text;
}

async function sendAdminNotification(customerEmail, customerName, reportContent, approvalToken, paymentIntentId) {
  const deliverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/deliver-report?token=${approvalToken}&email=${encodeURIComponent(customerEmail)}&name=${encodeURIComponent(customerName)}`;

  await resend.emails.send({
    from: "WWK System <onboarding@resend.dev>",
    to: "banittaq@gmail.com",
    subject: `New Assessment Report Ready — ${customerName}`,
    html: `
      <h2>New report ready for review</h2>
      <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
      <p><strong>Payment:</strong> ${paymentIntentId}</p>
      <hr/>
      <h3>Generated Report:</h3>
      <div style="white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.8; padding: 24px; background: #f9f9f9; border-radius: 4px;">
        ${reportContent.replace(/\n/g, "<br/>")}
      </div>
      <hr/>
      <p>
        <a href="${deliverUrl}" style="background: #2B9BAA; color: white; padding: 16px 32px; text-decoration: none; border-radius: 4px; font-family: sans-serif;">
          ✓ Approve & Send to Customer
        </a>
      </p>
      <p style="color: #999; font-size: 12px;">Clicking approve will email the report to ${customerEmail} immediately.</p>
    `,
  });
}
