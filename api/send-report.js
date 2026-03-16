import { Resend } from "resend";
import { del, put } from "@vercel/blob";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { report, email, name, blobUrl } = req.body;

  if (!report || !email || !name || !blobUrl) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // Store a print copy keyed by a separate token (persists for client to download PDF)
    const printToken = crypto.randomBytes(32).toString("hex");
    const { url: printBlobUrl } = await put(`print/${printToken}.txt`, report, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const printUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/print-report?token=${printToken}&name=${encodeURIComponent(name)}&blobUrl=${encodeURIComponent(printBlobUrl)}`;

    const { error: sendError } = await resend.emails.send({
      from: "Anitta Hamming <hello@womenwhoknow.ca>",
      to: email,
      subject: "Your WWK Founder Benchmark Assessment Report",
      html: buildReportEmail(name, report, printUrl),
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return res.status(500).json({ error: sendError.message });
    }

    // Delete the original edit blob — print copy stays for PDF download
    await del(blobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Send report error:", err);
    res.status(500).json({ error: err.message || "Send failed." });
  }
}

function buildReportEmail(name, reportContent, printUrl) {
  const htmlContent = reportContent
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #E0D8CC;margin:32px 0;" />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p>(<h[23]>)/g, '$1')
    .replace(/(<\/h[23]>)<\/p>/g, '$1')
    .replace(/<p>(<hr[^>]*\/>)<\/p>/g, '$1');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Georgia, serif; background: #F7F4EF; margin: 0; padding: 0; }
        .wrap { max-width: 680px; margin: 0 auto; background: #ffffff; }
        .header { background: #1C1A17; padding: 40px 48px; text-align: center; }
        .logo { color: #B8956A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 7px; text-transform: uppercase; }
        .body { padding: 48px; color: #1C1A17; line-height: 1.85; font-size: 16px; }
        h1 { font-family: Georgia, serif; font-weight: 300; color: #1C1A17; font-size: 32px; margin-bottom: 8px; }
        h2 { font-family: Georgia, serif; font-weight: 400; color: #2B9BAA; font-size: 20px; margin-top: 40px; margin-bottom: 12px; border-bottom: 1px solid #E0D8CC; padding-bottom: 8px; }
        p { margin-bottom: 18px; }
        .cta-box { background: #1C1A17; padding: 40px 48px; text-align: center; margin-top: 48px; }
        .cta-box p { color: #cccccc; font-size: 14px; margin-bottom: 20px; font-family: sans-serif; }
        .cta-btn { background: #2B9BAA; color: white; padding: 16px 36px; text-decoration: none; font-family: sans-serif; font-size: 14px; }
        .footer { padding: 24px 48px; text-align: center; color: #999; font-family: sans-serif; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <div class="logo">Women Who Know</div>
        </div>
        <div class="body">
          <h1>Your Founder Benchmark Assessment</h1>
          <p style="color: #7a7a7a; font-size: 14px; font-family: sans-serif;">Prepared for ${name}</p>
          <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 32px 0;" />
          ${htmlContent}
          <div style="margin-top: 40px; padding-top: 32px; border-top: 1px solid #E0D8CC; text-align: center;">
            <p style="font-size: 13px; color: #8A837A; font-family: sans-serif; margin-bottom: 16px;">Save a copy of your report</p>
            <a href="${printUrl}" style="display: inline-block; background: #1C1A17; color: white; padding: 14px 36px; text-decoration: none; font-family: sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;">Download as PDF →</a>
          </div>
        </div>
        <div class="cta-box">
          <p>The Reset Point — a 90-minute diagnostic session for founders who are ready to act on what this report uncovered.</p>
          <a href="https://womenwhoknow.ca/reset" class="cta-btn">Join the Waitlist</a>
        </div>
        <div class="footer">
          <p>Women Who Know &middot; Orillia, Ontario &middot; womenwhoknow.ca</p>
          <p>30-day money-back guarantee. Questions? Reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
