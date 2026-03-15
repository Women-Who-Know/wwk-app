import { Resend } from "resend";
import { get, del } from "@vercel/blob";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token, email, name, blobUrl } = req.query;

  if (!token || !email || !name || !blobUrl) {
    return res.status(400).send("Invalid delivery link.");
  }

  const decodedBlobUrl = decodeURIComponent(blobUrl);
  const decodedEmail = decodeURIComponent(email);
  const decodedName = decodeURIComponent(name);

  try {
    // Fetch private blob using correct SDK function
    const blobResult = await get(decodedBlobUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobResult) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:80px;">
          <h2 style="color:#c0392b;">Report not found</h2>
          <p>This report may have already been delivered, or the link has expired.</p>
        </body></html>
      `);
    }

    // blobResult.stream is a ReadableStream — convert to text
    const reportContent = await new Response(blobResult.stream).text();

    // Send report to customer
    const { error: sendError } = await resend.emails.send({
      from: "Anitta Hamming <hello@womenwhoknow.ca>",
      to: decodedEmail,
      subject: "Your WWK Founder Benchmark Assessment Report",
      html: buildReportEmail(decodedName, reportContent),
    });

    if (sendError) {
      console.error("Resend delivery error:", sendError);
      return res.status(500).send("Email delivery failed. Please try again.");
    }

    // Delete blob after successful delivery to prevent double-send
    await del(decodedBlobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).send(`
      <html>
        <head>
          <style>
            body { font-family: Georgia, serif; background: #F7F4EF; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .box { background: white; max-width: 480px; margin: 40px auto; padding: 56px 48px; text-align: center; }
            h2 { color: #2B9BAA; font-weight: 300; font-size: 32px; margin-bottom: 16px; }
            p { color: #4A4540; font-size: 16px; line-height: 1.7; }
            strong { color: #1C1A17; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>✓ Report delivered</h2>
            <p>The Founder Benchmark Assessment has been sent to <strong>${decodedEmail}</strong>.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Delivery error:", err);
    res.status(500).send("Delivery failed. Please try again.");
  }
}

function buildReportEmail(name, reportContent) {
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
          ${reportContent.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>").replace(/^/, "<p>").replace(/$/, "</p>")}
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
