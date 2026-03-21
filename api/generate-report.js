import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { addContact } from "./add-contact.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { answers, paymentIntentId, name, email, industry, businessType, yearsInBusiness } = req.body;

  if (!paymentIntentId || !answers || !email || !name) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const isBeta = paymentIntentId === "beta-free";

  try {
    // 1. Verify payment is authorized (skip for beta)
    if (!isBeta) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!["requires_capture", "succeeded"].includes(intent.status)) {
        return res.status(402).json({ error: "Payment not authorized." });
      }
    }

    // 2. Store answers immediately — this is the whole job of this endpoint
    console.log("q11_revenue received:", JSON.stringify(answers?.q11_revenue));
    console.log("total answer keys:", Object.keys(answers || {}).length);
    const submissionToken = crypto.randomBytes(32).toString("hex");
    await put(`answers/${submissionToken}.json`, JSON.stringify({
      name, email, industry, businessType, yearsInBusiness, answers, paymentIntentId, isBeta
    }, null, 2), {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 3. Email admin with submission details and Generate Report button
    const generateUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/run-report?token=${submissionToken}`;

    const { error: emailError } = await resend.emails.send({
      from: "WWK System <hello@womenwhoknow.ca>",
      to: "banittaq@gmail.com",
      subject: `New Submission — ${name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 40px 24px; color: #1C1A17;">
          <p style="font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B8956A; font-family: sans-serif; margin-bottom: 16px;">Women Who Know</p>
          <h2 style="font-weight: 300; font-size: 26px; margin: 0 0 16px;">New assessment submitted</h2>
          <table style="font-family: sans-serif; font-size: 14px; color: #4A4540; margin-bottom: 24px;">
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Name:</strong></td><td>${name}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Email:</strong></td><td>${email}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Industry:</strong></td><td>${industry || "—"}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Payment:</strong></td><td>${isBeta ? "Beta (no charge)" : paymentIntentId}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 0 0 24px;" />
          <p style="font-family: sans-serif; font-size: 14px; color: #4A4540; margin-bottom: 24px;">
            Answers are saved. Click below when ready to generate the report.
          </p>
          <a href="${generateUrl}" style="display: inline-block; background: #2B9BAA; color: white; padding: 18px 40px; text-decoration: none; font-family: sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">
            Generate Report for ${name.split(" ")[0]} →
          </a>
          <p style="font-family: sans-serif; font-size: 12px; color: #999; margin-top: 12px;">
            Opens in your browser. Wait for generation to complete, then you'll be taken to the Edit &amp; Send page.
          </p>
        </div>
      `,
    });

    if (emailError) throw new Error(`Admin email failed: ${emailError.message}`);

    // 4. Add to Resend audience (non-fatal)
    try { await addContact({ email, firstName: name }); } catch(e) {}

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Submission error:", err);

    if (!isBeta) {
      try { await stripe.paymentIntents.cancel(paymentIntentId); } catch(e) {}
    }

    res.status(500).json({ error: "Submission failed. Your card has not been charged." });
  }
}
