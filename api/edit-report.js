import { get } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token, email, name, blobUrl, paymentIntentId, isBeta } = req.query;

  if (!token || !email || !name || !blobUrl || !paymentIntentId) {
    return res.status(400).send("Invalid edit link — missing required parameters.");
  }

  const decodedBlobUrl = decodeURIComponent(blobUrl);
  const decodedEmail = decodeURIComponent(email);
  const decodedName = decodeURIComponent(name);
  const decodedPaymentIntentId = decodeURIComponent(paymentIntentId);
  const firstName = decodedName.split(" ")[0];

  try {
    const blobResult = await get(decodedBlobUrl, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobResult) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#1C1A17;">
          <h2 style="color:#c0392b;">Report not found</h2>
          <p>This report has already been sent, or the link has expired.</p>
          <p style="margin-top:16px;font-size:13px;color:#999;">Contact hello@womenwhoknow.ca if you need assistance.</p>
        </body></html>
      `);
    }

    const reportContent = await new Response(blobResult.stream).text();

    // Fetch answers if available (stored since March 2026)
    let answersData = null;
    try {
      const answersBlobUrl = decodedBlobUrl.replace("/reports/", "/answers/").replace(".txt", ".json");
      const answersBlobResult = await get(answersBlobUrl, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (answersBlobResult) {
        const answersText = await new Response(answersBlobResult.stream).text();
        answersData = JSON.parse(answersText);
      }
    } catch (e) {
      // Non-fatal — older submissions won't have answers stored
    }

    // Build answers panel HTML
    const qLabels = {
      q1_industry: "Industry & Niche", q2_years: "Years in Business",
      q3_employees: "Team Structure", q4_idealclient: "Ideal Client",
      q5_whatyoudo: "What She Does", q6_decision: "Last Decision Delayed",
      q7_offers: "Number of Offers", q8_pricing: "Pricing & Discounting",
      q9_priceincrease: "Last Price Increase", q10_pressure: "Response to Price Pushback",
      q11_revenue: "Monthly Revenue", q12_chargemore: "Would Charge More If...",
      q13_source: "How Clients Find Her", q14_calls: "Discovery Calls/Month",
      q15_conversion: "Conversion Rate", q16_bottleneck: "Biggest Bottleneck",
      q17_know: "Knows Needs to Change", q18_dream: "Dream Scenario",
    };
    function fmtAns(id, val) {
      if (!val) return "—";
      if (typeof val === "string") return val;
      if (typeof val === "object") {
        if (val.sector) return val.sector + (val.niche ? " — " + val.niche : "");
        if (val.range) return val.range + "/month" + (val.consistency ? " · " + val.consistency : "");
        if (val.source) return val.source + (val.data ? " · " + val.data : "");
        if (val.primary !== undefined) return val.count + " offers — primary: " + val.primary;
        if (val.count !== undefined) return val.count + (val.structure ? " (" + val.structure + ")" : "");
        return JSON.stringify(val);
      }
      return String(val);
    }
    let answersPanel = "";
    if (answersData && answersData.answers) {
      let rows = "";
      for (const [id, val] of Object.entries(answersData.answers)) {
        const label = qLabels[id] || id;
        const value = fmtAns(id, val);
        const highlight = id === "q11_revenue" ? ' style="background:#fffbe6;"' : "";
        const bold = id === "q11_revenue" ? "font-weight:600;" : "";
        rows += "<tr" + highlight + ">"
          + "<td style=\"padding:8px 12px;font-family:sans-serif;font-size:12px;color:#8A837A;white-space:nowrap;vertical-align:top;\">" + label + "</td>"
          + "<td style=\"padding:8px 12px;font-family:Georgia,serif;font-size:13px;color:#1C1A17;line-height:1.5;" + bold + "\">" + value + "</td>"
          + "</tr>";
      }
      answersPanel = "<details style=\"margin-bottom:24px;border:1px solid #E0D8CC;background:#fff;\">"
        + "<summary style=\"padding:14px 20px;font-family:sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#2B9BAA;font-weight:600;cursor:pointer;list-style:none;user-select:none;\">"
        + "&#9658; Client Answers &mdash; " + decodedName
        + "</summary>"
        + "<table style=\"width:100%;border-collapse:collapse;border-top:1px solid #E0D8CC;\">" + rows + "</table>"
        + "</details>";
    }

    // All values safely JSON-encoded for embedding in JavaScript
    const jsEmail = JSON.stringify(decodedEmail);
    const jsName = JSON.stringify(decodedName);
    const jsBlobUrl = JSON.stringify(decodedBlobUrl);
    const jsToken = JSON.stringify(token);
    const jsPaymentIntentId = JSON.stringify(decodedPaymentIntentId);
    const jsIsBeta = isBeta === "1" ? "true" : "false";

    // Report content escaped for HTML textarea
    const safeReport = reportContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Edit Report — ${decodedName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; background: #F7F4EF; min-height: 100vh; padding: 48px 24px 80px; }
    .wrap { max-width: 820px; margin: 0 auto; }
    .header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #E0D8CC; }
    .logo { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B8956A; font-family: sans-serif; margin-bottom: 16px; }
    h1 { font-size: 28px; font-weight: 300; color: #1C1A17; margin-bottom: 8px; }
    .meta { font-size: 14px; color: #8A837A; font-family: sans-serif; }
    .meta strong { color: #1C1A17; }
    label { display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #2B9BAA; font-family: sans-serif; font-weight: 600; margin-bottom: 10px; margin-top: 32px; }
    textarea {
      width: 100%; min-height: 640px; padding: 28px;
      border: 1px solid #E0D8CC; font-family: Georgia, serif;
      font-size: 15px; line-height: 1.85; color: #1C1A17;
      background: #fff; resize: vertical; outline: none;
    }
    textarea:focus { border-color: #2B9BAA; }
    .actions { display: flex; gap: 16px; align-items: center; margin-top: 24px; }
    .btn {
      background: #2B9BAA; color: white; border: none;
      padding: 18px 48px; font-family: sans-serif; font-size: 12px;
      font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
    }
    .btn:hover { background: #1E7A88; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .note { font-size: 13px; color: #8A837A; font-family: sans-serif; line-height: 1.5; }
    .status { font-family: sans-serif; font-size: 14px; padding: 16px 20px; margin-top: 16px; display: none; border-radius: 2px; }
    .status.success { background: #EAF6F8; color: #1E7A88; border-left: 3px solid #2B9BAA; }
    .status.error { background: #fdf0ef; color: #c0392b; border-left: 3px solid #c0392b; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">Women Who Know</div>
      <h1>Edit &amp; Send Report</h1>
      <p class="meta">For: <strong>${decodedName}</strong> &nbsp;·&nbsp; Deliver to: <strong>${decodedEmail}</strong></p>
    </div>
    <label>Report — review and edit below, then click Send</label>
    ${answersPanel}
    <textarea id="reportContent">${safeReport}</textarea>
    <div class="actions">
      <button class="btn" id="sendBtn" onclick="sendReport()">Send to ${firstName} →</button>
      <span class="note">Sends immediately to ${decodedEmail}.<br/>Payment is captured when you click Send.</span>
    </div>
    <div class="status" id="status"></div>
  </div>

  <script>
    async function sendReport() {
      const btn = document.getElementById('sendBtn');
      const status = document.getElementById('status');
      const content = document.getElementById('reportContent').value;

      if (!content.trim()) {
        status.className = 'status error';
        status.textContent = 'Report content is empty.';
        status.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';
      status.style.display = 'none';

      try {
        const res = await fetch('/api/send-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: content,
            email: ${jsEmail},
            name: ${jsName},
            blobUrl: ${jsBlobUrl},
            token: ${jsToken},
            paymentIntentId: ${jsPaymentIntentId},
            isBeta: ${jsIsBeta}
          })
        });

        let data = {};
        try { data = await res.json(); } catch(e) { data = { error: 'Server error — please try again.' }; }

        if (res.ok) {
          status.className = 'status success';
          status.textContent = '✓ Report sent to ' + ${jsEmail};
          status.style.display = 'block';
          btn.textContent = '✓ Sent';
        } else {
          throw new Error(data.error || 'Send failed. Please try again.');
        }
      } catch (err) {
        status.className = 'status error';
        status.textContent = err.message;
        status.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Send to ${firstName} →';
      }
    }
  </script>
</body>
</html>`);

  } catch (err) {
    console.error("Edit page error:", err);
    res.status(500).send("Failed to load report. Please try again or contact hello@womenwhoknow.ca.");
  }
}
