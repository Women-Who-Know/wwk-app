import { get } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token, name, blobUrl } = req.query;

  if (!token || !name || !blobUrl) {
    return res.status(400).send("Invalid link.");
  }

  try {
    const blobResult = await get(decodeURIComponent(blobUrl), {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobResult) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:80px;">
          <h2>Report unavailable</h2>
          <p>This link has expired. Please contact hello@womenwhoknow.ca.</p>
        </body></html>
      `);
    }

    const reportContent = await new Response(blobResult.stream).text();
    const decodedName = decodeURIComponent(name);

    const htmlContent = reportContent
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^---+$/gm, '<hr />')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p>(<h[23]>)/g, '$1')
      .replace(/(<\/h[23]>)<\/p>/g, '$1')
      .replace(/<p>(<hr[^>]*\/>)<\/p>/g, '$1');

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Founder Benchmark Assessment — ${decodedName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'DM Sans', sans-serif;
            background: #F7F4EF;
            color: #1C1A17;
            padding: 0;
          }

          .print-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #1C1A17;
            padding: 14px 40px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 100;
          }

          .print-bar-logo {
            font-family: 'DM Sans', sans-serif;
            font-size: 10px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #B8956A;
          }

          .print-btn {
            background: #2B9BAA;
            color: white;
            border: none;
            padding: 12px 32px;
            font-family: 'DM Sans', sans-serif;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            cursor: pointer;
          }

          .print-btn:hover { background: #1E7A88; }

          .print-note {
            font-size: 12px;
            color: rgba(255,255,255,0.5);
            font-family: 'DM Sans', sans-serif;
          }

          .page {
            max-width: 760px;
            margin: 0 auto;
            background: white;
            padding: 80px 72px 80px;
            margin-top: 60px;
            margin-bottom: 60px;
          }

          .report-header {
            border-bottom: 1px solid #E0D8CC;
            padding-bottom: 48px;
            margin-bottom: 56px;
          }

          .wwk-label {
            font-size: 10px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #2B9BAA;
            font-weight: 500;
            margin-bottom: 20px;
          }

          .report-title {
            font-family: 'Cormorant Garamond', serif;
            font-size: 48px;
            font-weight: 300;
            line-height: 1.1;
            color: #1C1A17;
            margin-bottom: 12px;
          }

          .report-subtitle {
            font-size: 14px;
            color: #8A837A;
          }

          h2 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 28px;
            font-weight: 400;
            color: #1C1A17;
            margin-top: 48px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #E0D8CC;
          }

          h3 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 22px;
            font-weight: 400;
            color: #2B9BAA;
            margin-top: 32px;
            margin-bottom: 12px;
          }

          p {
            font-size: 16px;
            font-weight: 300;
            line-height: 1.9;
            color: #1C1A17;
            margin-bottom: 20px;
          }

          strong { font-weight: 500; }

          hr {
            border: none;
            border-top: 1px solid #E0D8CC;
            margin: 40px 0;
          }

          .footer-cta {
            background: #1C1A17;
            padding: 48px;
            text-align: center;
            margin-top: 64px;
          }

          .footer-cta p {
            color: rgba(255,255,255,0.7);
            font-size: 15px;
            margin-bottom: 24px;
          }

          .footer-cta a {
            display: inline-block;
            background: #2B9BAA;
            color: white;
            padding: 16px 40px;
            text-decoration: none;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .doc-footer {
            text-align: center;
            padding: 32px;
            color: #8A837A;
            font-size: 12px;
          }

          @media print {
            .print-bar { display: none !important; }
            body { background: white; }
            .page {
              margin: 0;
              padding: 40px 56px;
              box-shadow: none;
              max-width: 100%;
            }
            h2 { page-break-after: avoid; }
            p { orphans: 3; widows: 3; }
            .footer-cta { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-bar">
          <span class="print-bar-logo">Women Who Know</span>
          <div style="display:flex;align-items:center;gap:24px;">
            <span class="print-note">File → Print → Save as PDF</span>
            <button class="print-btn" onclick="window.print()">Download as PDF</button>
          </div>
        </div>

        <div class="page">
          <div class="report-header">
            <div class="wwk-label">Founder Benchmark Assessment</div>
            <h1 class="report-title">Your Report</h1>
            <p class="report-subtitle">Prepared for ${decodedName} &nbsp;·&nbsp; Women Who Know</p>
          </div>

          <div class="report-body">
            ${htmlContent}
          </div>

          <div class="footer-cta">
            <p>The Reset Point — a 90-minute diagnostic session for founders who are ready to act on what this report uncovered.</p>
            <a href="https://womenwhoknow.ca/reset">Join the Waitlist</a>
          </div>

          <div class="doc-footer">
            Women Who Know &nbsp;·&nbsp; womenwhoknow.ca &nbsp;·&nbsp; hello@womenwhoknow.ca
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Print page error:", err);
    res.status(500).send("Failed to load report. Please contact hello@womenwhoknow.ca.");
  }
}
