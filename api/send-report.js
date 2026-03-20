import Stripe from "stripe";
import { Resend } from "resend";
import { del, put } from "@vercel/blob";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { report, email, name, blobUrl, paymentIntentId, isBeta } = req.body;

  if (!report || !email || !name || !blobUrl || !paymentIntentId) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  try {
    // 1. Capture Stripe payment now that admin has approved (skip for beta)
    if (!isBeta && paymentIntentId !== "beta-free") {
      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status === "requires_capture") {
          await stripe.paymentIntents.capture(paymentIntentId);
        }
        // If already succeeded, that's fine — don't error
      } catch (stripeErr) {
        console.error("Stripe capture error:", stripeErr.message);
        return res.status(500).json({ error: `Payment capture failed: ${stripeErr.message}` });
      }
    }

    // 2. Store a separate print copy (for the PDF download link)
    const printToken = crypto.randomBytes(32).toString("hex");
    const { url: printBlobUrl } = await put(`print/${printToken}.txt`, report, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const printUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/print-report`
      + `?token=${printToken}`
      + `&name=${encodeURIComponent(name)}`
      + `&blobUrl=${encodeURIComponent(printBlobUrl)}`;

    // 3. Email the report to the customer
    const { error: sendError } = await resend.emails.send({
      from: "Anitta Hamming <hello@womenwhoknow.ca>",
      to: email,
      subject: "Your WWK Founder Benchmark Assessment Report",
      html: buildReportEmail(name, report, printUrl),
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return res.status(500).json({ error: `Email failed: ${sendError.message}` });
    }

    // 4. Store final delivered report — audit trail and AI training foundation
    const { token } = req.body;
    if (token) {
      try {
        await put(`delivered/${token}.txt`, report, {
          access: "private",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      } catch (storeErr) {
        // Non-fatal — log but don't fail the request
        console.error("Failed to store delivered report:", storeErr.message);
      }
    }

    // 5. Delete the edit blob — report is sent, prevent re-sending from edit page
    try {
      await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (delErr) {
      // Non-fatal — log but don't fail the request
      console.error("Failed to delete edit blob:", delErr.message);
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Send report error:", err);
    res.status(500).json({ error: err.message || "Send failed. Please try again." });
  }
}

// ─── Markdown → HTML conversion ──────────────────────────────────────────────

function markdownToHtml(text) {
  return text
    // Strip document title lines — email template provides these
    .replace(/^#\s+(Founder Benchmark Assessment.*|Your Report.*)$/gm, "")
    .replace(/^###\s+(Prepared for.*)$/gm, "")
    // Single # headers
    .replace(/^# (.+)$/gm, "</p><h2>$1</h2><p>")
    // Section headers
    .replace(/^## (.+)$/gm, "</p><h2>$1</h2><p>")
    .replace(/^### (.+)$/gm, "</p><h3>$1</h3><p>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^---+$/gm, "</p><hr/><p>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    // Clean up empty paragraphs around block elements
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[23]>)/g, "$1")
    .replace(/(<\/h[23]>)<\/p>/g, "$1")
    .replace(/<p>(<hr\/>)<\/p>/g, "$1");
}

// ─── Customer email template ──────────────────────────────────────────────────

function buildReportEmail(name, reportContent, printUrl) {
  const htmlContent = markdownToHtml(reportContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; padding: 0; background: #F7F4EF; font-family: Georgia, serif; }
  .wrap { max-width: 680px; margin: 0 auto; background: #ffffff; }
  .header { background: #1C1A17; padding: 40px 48px; text-align: center; }
  .logo { color: #B8956A; font-size: 11px; letter-spacing: 7px; text-transform: uppercase; }
  .body { padding: 48px; color: #1C1A17; line-height: 1.85; font-size: 16px; }
  h1 { font-family: Georgia, serif; font-weight: 300; font-size: 32px; color: #1C1A17; margin: 0 0 8px; }
  h2 { font-family: Georgia, serif; font-weight: 400; font-size: 20px; color: #2B9BAA; margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #E0D8CC; }
  h3 { font-family: Georgia, serif; font-weight: 400; font-size: 17px; color: #1C1A17; margin: 28px 0 10px; }
  p { margin: 0 0 18px; font-size: 16px; line-height: 1.85; color: #1C1A17; }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid #E0D8CC; margin: 32px 0; }
  .pdf-bar { text-align: center; padding: 28px 48px; border-top: 1px solid #E0D8CC; margin-top: 40px; }
  .pdf-bar p { font-family: sans-serif; font-size: 13px; color: #8A837A; margin-bottom: 14px; }
  .pdf-btn { display: inline-block; background: #1C1A17; color: white; padding: 14px 36px; text-decoration: none; font-family: sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
  .cta-box { background: #1C1A17; padding: 40px 48px; text-align: center; }
  .cta-box p { color: rgba(255,255,255,0.7); font-family: sans-serif; font-size: 14px; margin-bottom: 20px; }
  .cta-btn { display: inline-block; background: #2B9BAA; color: white; padding: 16px 36px; text-decoration: none; font-family: sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .footer { padding: 24px 48px; text-align: center; color: #999; font-family: sans-serif; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">Women Who Know</div></div>
  <div class="body">
    <h1>Your Founder Benchmark Assessment</h1>
    <p style="color:#8A837A;font-family:sans-serif;font-size:13px;margin-bottom:32px;">Prepared for ${name}</p>
    <hr/>
    ${htmlContent}
    <div class="pdf-bar">
      <p>Save a copy of your report</p>
      <a href="${printUrl}" class="pdf-btn">Download as PDF →</a>
    </div>
  </div>
  <div class="cta-box">
    <p>The Reset Point — a 90-minute diagnostic session for founders who are ready to act on what this report uncovered.</p>
    <a href="https://wwk-app.vercel.app/waitlist" class="cta-btn">Join the Waitlist</a>
  </div>
  <div class="footer">
    <p>Women Who Know &middot; Orillia, Ontario &middot; womenwhoknow.ca</p>
    <p>30-day money-back guarantee. Questions? Reply to this email.</p>
  </div>
</div>
</body>
</html>`;
}
