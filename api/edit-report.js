import { get } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token, email, name, blobUrl } = req.query;

  if (!token || !email || !name || !blobUrl) {
    return res.status(400).send("Invalid edit link.");
  }

  const decodedBlobUrl = decodeURIComponent(blobUrl);
  const decodedEmail = decodeURIComponent(email);
  const decodedName = decodeURIComponent(name);

  try {
    const blobResult = await get(decodedBlobUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobResult) {
      return res.status(404).send("Report not found. It may have already been sent.");
    }

    const reportContent = await new Response(blobResult.stream).text();

    // Safe values for embedding in HTML/JS
    const safeEmail = JSON.stringify(decodedEmail);
    const safeName = JSON.stringify(decodedName);
    const safeBlobUrl = JSON.stringify(decodedBlobUrl);
    const safeToken = JSON.stringify(token);
    const safeReportContent = reportContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Edit Report — ${decodedName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Georgia', serif; background: #F7F4EF; min-height: 100vh; padding: 48px 24px; }
          .wrap { max-width: 800px; margin: 0 auto; }
          .header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E0D8CC; }
          .logo { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B8956A; font-family: sans-serif; margin-bottom: 16px; }
          h1 { font-size: 28px; font-weight: 300; color: #1C1A17; margin-bottom: 8px; }
          .meta { font-size: 14px; color: #8A837A; font-family: sans-serif; }
          .meta strong { color: #1C1A17; }
          label { display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #2B9BAA; font-family: sans-serif; font-weight: 500; margin-bottom: 10px; margin-top: 32px; }
          textarea {
            width: 100%;
            min-height: 600px;
            padding: 24px;
            border: 1px solid #E0D8CC;
            font-family: 'Georgia', serif;
            font-size: 15px;
            line-height: 1.85;
            color: #1C1A17;
            background: #ffffff;
            resize: vertical;
            outline: none;
          }
          textarea:focus { border-color: #2B9BAA; }
          .actions { display: flex; gap: 16px; align-items: center; margin-top: 24px; }
          .btn-send {
            background: #2B9BAA;
            color: white;
            border: none;
            padding: 18px 48px;
            font-family: sans-serif;
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            cursor: pointer;
          }
          .btn-send:hover { background: #1E7A88; }
          .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }
          .note { font-size: 13px; color: #8A837A; font-family: sans-serif; }
          .status { font-family: sans-serif; font-size: 14px; padding: 16px 20px; margin-top: 16px; display: none; }
          .status.success { background: #EAF6F8; color: #1E7A88; border-left: 3px solid #2B9BAA; }
          .status.error { background: #fdf0ef; color: #c0392b; border-left: 3px solid #c0392b; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="logo">Women Who Know</div>
            <h1>Edit & Send Report</h1>
            <p class="meta">For: <strong>${decodedName}</strong> &nbsp;·&nbsp; Deliver to: <strong>${decodedEmail}</strong></p>
          </div>

          <label>Report Content — Edit below, then click Send</label>
          <textarea id="reportContent">${safeReportContent}</textarea>

          <div class="actions">
            <button class="btn-send" id="sendBtn" onclick="sendReport()">Send to ${decodedName.split(' ')[0]} →</button>
            <span class="note">This will email the report to ${decodedEmail}</span>
          </div>
          <div class="status" id="status"></div>
        </div>

        <script>
          async function sendReport() {
            const btn = document.getElementById('sendBtn');
            const status = document.getElementById('status');
            const content = document.getElementById('reportContent').value;

            btn.disabled = true;
            btn.textContent = 'Sending…';
            status.style.display = 'none';

            try {
              const res = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  report: content,
                  email: ${safeEmail},
                  name: ${safeName},
                  blobUrl: ${safeBlobUrl},
                  token: ${safeToken}
                })
              });

              const data = await res.json();

              if (res.ok) {
                status.className = 'status success';
                status.textContent = '✓ Report sent to ' + ${safeEmail};
                status.style.display = 'block';
                btn.textContent = '✓ Sent';
              } else {
                throw new Error(data.error || 'Send failed');
              }
            } catch (err) {
              status.className = 'status error';
              status.textContent = 'Error: ' + err.message;
              status.style.display = 'block';
              btn.disabled = false;
              btn.textContent = 'Send →';
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Edit page error:", err);
    res.status(500).send("Failed to load report. Please try again.");
  }
}
