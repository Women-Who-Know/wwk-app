import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { addContact } from "./add-contact.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    // 2. Generate report via Claude
    const reportContent = await generateReport(answers, name, industry, businessType, yearsInBusiness);

    // NOTE: Payment is captured only after admin reviews and clicks Send — not here.
    // This ensures the client is never charged for a report that isn't delivered.

    // 3. Store report in Blob, keyed by a unique approval token
    const approvalToken = crypto.randomBytes(32).toString("hex");
    const { url: blobUrl } = await put(`reports/${approvalToken}.txt`, reportContent, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 3a. Store original AI-generated report — audit trail and AI training foundation
    await put(`originals/${approvalToken}.txt`, reportContent, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 3b. Store answers — edit panel display and AI training foundation
    await put(`answers/${approvalToken}.json`, JSON.stringify({ name, email, industry, businessType, yearsInBusiness, answers }, null, 2), {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 4. Email admin with report preview and Edit & Send link
    await sendAdminNotification({
      customerEmail: email,
      customerName: name,
      reportContent,
      approvalToken,
      blobUrl,
      paymentIntentId,
      isBeta,
    });

    // 5. Add to Resend audience (non-fatal if it fails)
    await addContact({ email, firstName: name });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Report generation error:", err);

    // Cancel authorization so client card is not held (skip for beta)
    if (!isBeta) {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch (cancelErr) {
        console.error("Failed to cancel payment intent:", cancelErr.message);
      }
    }

    res.status(500).json({ error: "Report generation failed. Your card has not been charged." });
  }
}

// ─── Report generation ────────────────────────────────────────────────────────

async function generateReport(answers, name, industry, businessType, yearsInBusiness) {
  const questionLabels = {
    q1_industry:    "Industry and sector",
    q2_years:       "Years in business",
    q3_employees:   "Team size and structure",
    q4_idealclient: "Ideal client (their exact words)",
    q5_whatyoudo:   "What they say they do (their exact words)",
    q6_decision:    "Last decision delayed or avoided (their exact words)",
    q7_offers:      "Number of offers or services",
    q8_pricing:     "How they priced their highest offer and discounting behaviour (their exact words)",
    q9_priceincrease: "Last price increase (their exact words)",
    q10_pressure:   "Response when prospect says price is too high",
    q11_revenue:    "Monthly revenue (range and consistency — treat the midpoint as the working figure)",
    q12_chargemore: "Would charge more if... (their exact words)",
    q13_source:     "How clients find them",
    q14_calls:      "Discovery calls per month",
    q15_conversion: "Conversion rate from calls",
    q16_bottleneck: "Biggest bottleneck (their exact words)",
    q17_know:       "What they know needs to change but haven't acted on (their exact words)",
    q18_dream:      "Dream scenario if time and money were no object (their exact words)",
  };

  function formatAnswer(id, answer) {
    if (answer === null || answer === undefined || answer === "") return "No answer provided";
    if (typeof answer === "string") return answer;
    if (Array.isArray(answer)) return answer.join(", ");
    if (typeof answer === "object") {
      if (answer.sector || answer.niche)
        return `Sector: ${answer.sector || "—"} | Niche: ${answer.niche || "—"}`;
      if (answer.range)
        return `${answer.range} / month — ${answer.consistency || ""}`;
      if (answer.source)
        return `Source: ${answer.source} | Data availability: ${answer.data || "—"}`;
      // Offers: has a count and possibly a primary — must come before employees
      if (answer.primary !== undefined)
        return `${answer.count} offers — primary: ${answer.primary}`;
      // Employees: has count and possibly structure
      if (answer.count !== undefined)
        return `${answer.count}${answer.structure ? ` (${answer.structure})` : ""}`;
      return JSON.stringify(answer);
    }
    return String(answer);
  }

  const answersText = Object.entries(answers)
    .map(([id, answer]) => `${questionLabels[id] || id}: ${formatAnswer(id, answer)}`)
    .join("\n");

  const reportSystem = `You are writing a Founder Benchmark Assessment report for Women Who Know, a coaching platform founded by Anitta Hamming.

You are writing DIRECTLY TO the founder — use "you" and "your" throughout. Never refer to the founder in third person. Write as if Anitta is speaking directly to this woman, one on one.

Anitta's voice — read this carefully and apply it to every sentence:

WHAT HER VOICE IS:
- Direct. No cushioning, no hedging. Says what she sees without softening it first.
- Warm but not soft. She delivers hard truths kindly — she never makes women feel stupid, but she does not protect them from what's true.
- Diagnostic. She names the real problem beneath the stated problem. She sees patterns and calls them precisely.
- Specific. Not "you may be undercharging" — "your pricing is below market for your stage." Not "you struggle with visibility" — "you have no consistent client acquisition system."
- Conversational. Short sentences. No academic phrasing. Sounds like one smart woman talking directly to another.

WHAT HER VOICE IS NOT:
- Generic motivational ("you've got this", "step into your power", "do the work")
- Corporate or framework-heavy
- Preachy or superior
- Artificially positive or cheerleader-y
- Vague ("you're doing well" — doing well at what, specifically?)

LANGUAGE SHE USES:
- "Story-based thinking" / "story-based decision" — NEVER "fear-based"
- "You already know" — not "trust yourself"
- "The real problem beneath this is..."
- She names patterns: "This is what it looks like when a founder..."

LANGUAGE SHE NEVER USES:
- "Lean in", "hustle", "manifest", "empowerment", "universe" as strategy
- "You've got this", "amazing", excessive exclamation marks
- "Journey" (explicitly banned)
- Corporate jargon of any kind

THE TEST: Read every sentence and ask — could this have been written by any AI about any founder? If yes, rewrite it with something specific she actually said in her answers.

Report structure (follow exactly):

## 1. BUSINESS SNAPSHOT
2-3 sentences on what you are running and where you are right now. Specific to their answers. Written directly to them.

## 2. BENCHMARK COMPARISON
Her monthly revenue range is stated explicitly in the CONFIRMED DATA block at the top of the user message. Use the midpoint of that range as your working number and state it in dollars (e.g. "at roughly $11K/month"). Open this section with that number. Do not hedge, do not say it's missing, do not say you're working from structural signals. The number is there. Use it.

## 3. GAP ANALYSIS
The top 3 gaps between where you are and where you should be. Each gap gets: a bold name, a paragraph explanation written directly to the founder, and one concrete action they can take this week.

## 4. CLEAR / WORTHY / WEALTHY SCORES
Score each pillar out of 10. For each score write exactly two sentences: the first names the specific strength that earned the score; the second names the one specific thing holding it back from higher. Do not be vague — "you're doing well here" is not a strength. Name what she is actually doing right, then name what is actually missing. Be honest — a 6 is a 6.

## 5. PATH FORWARD
3-5 sentences on what the next 90 days should look like if you actually want to move the number.

## 6. NEXT STEP
"The Reset Point is currently closed to new clients. If you want to know exactly what to do with this report, join the waitlist at wwk-app.vercel.app/waitlist"

Rules:
- Write DIRECTLY TO the founder. "You" not "she." Always.
- Every paragraph must reference something specific from their answers. No generic advice.
- Do not be gentle about gaps. Name them.
- Do not use bullet points in the body — write in paragraphs.
- Monthly revenue is ALWAYS provided as a range (e.g. "$7-15K / month"). Use the midpoint as your working figure and state it directly (e.g. "at roughly $11K/month"). NEVER write phrases like "without a reported revenue figure," "working from structural signals," or any variation suggesting revenue data is absent. It is never absent. If you write any such phrase, you are wrong.
- Do not add a document title, header, or "Prepared for" line — the email template handles that.
- Do not use the word "journey."`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: reportSystem,
    messages: [{
      role: "user",
      content: `Generate a Founder Benchmark Assessment report for:

Name: ${name}
Industry: ${industry}
Business type: ${businessType}
Years in business: ${yearsInBusiness}

CONFIRMED DATA — USE THESE NUMBERS DIRECTLY IN THE REPORT:
Monthly revenue range: ${answers['q11_revenue']?.range || 'not provided'}
Revenue consistency: ${answers['q11_revenue']?.consistency || 'not provided'}

Assessment answers:
${answersText}`,
    }],
  });

  const draft = message.content[0].text;
  if (!draft) return "";

  // ── CALL 2: Audit for fabrication, misrepresentation, assumptions ──────────
  const auditSystem = `You are an accuracy auditor for Women Who Know assessment reports. Your only job is to check a generated report against the founder's actual answers and benchmarking reference data.

You are looking for exactly five problem types:
1. FABRICATED STATISTIC — any percentage, number, or statistic not found verbatim in the benchmarking reference data, OR invented in a recommendation (e.g. "raise prices by 25%", "contact 10 leads per week"). Specific numbers in action steps are fabricated unless the founder stated them explicitly in her answers.
2. MISREPRESENTATION — any statement that distorts, exaggerates, or contradicts what she actually wrote.
3. ASSUMPTION — any claim stated as fact that she never provided in her answers (things assumed from silence — e.g. she didn't mention X, so report claims she doesn't struggle with X).
4. MISSING REVENUE — the report does not open Section 2 with her specific monthly revenue range/midpoint. This is always a violation.
5. INLINE CITATION — any source name, study name, or data reference appearing in the report body (e.g. "CMMOTA 2023", "ICF study", "ISED", "IRS data"). These do not belong in the report.

Return your response in exactly this format:
If problems found: List each as: [TYPE]: "[the problematic text]" — REASON: [why it's a problem]
If no problems found: Return only the word PASS

Do not comment on writing quality, tone, or style. Only flag accuracy violations.`;

  const auditUser = `FOUNDER'S ACTUAL ANSWERS:
${answersText}

CONFIRMED DATA:
Monthly revenue range: ${answers['q11_revenue']?.range || 'not provided'}
Revenue consistency: ${answers['q11_revenue']?.consistency || 'not provided'}

REPORT TO AUDIT:
${draft}

Audit now.`;

  const auditMessage = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: auditSystem,
    messages: [{ role: "user", content: auditUser }],
  });

  const auditResult = auditMessage.content[0].text.trim();

  if (auditResult === "PASS") {
    return draft;
  }

  // ── CALL 3: Rewrite correcting only the violations ─────────────────────────
  const rewriteUser = `The following accuracy violations were found in this report. Rewrite the complete report correcting only these violations. Voice, structure, and everything else stays the same.

VIOLATIONS TO FIX:
${auditResult}

FOUNDER'S CONFIRMED DATA:
Monthly revenue range: ${answers['q11_revenue']?.range || 'not provided'}
Revenue consistency: ${answers['q11_revenue']?.consistency || 'not provided'}

FOUNDER'S ACTUAL ANSWERS:
${answersText}

ORIGINAL REPORT:
${draft}

Rewrite now.`;

  const rewriteMessage = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: reportSystem,
    messages: [{ role: "user", content: rewriteUser }],
  });

  return rewriteMessage.content[0].text || draft;
}

// ─── Admin notification ────────────────────────────────────────────────────────

async function sendAdminNotification({ customerEmail, customerName, reportContent, approvalToken, blobUrl, paymentIntentId, isBeta }) {
  const editUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/edit-report`
    + `?token=${approvalToken}`
    + `&blobUrl=${encodeURIComponent(blobUrl)}`
    + `&email=${encodeURIComponent(customerEmail)}`
    + `&name=${encodeURIComponent(customerName)}`
    + `&paymentIntentId=${encodeURIComponent(paymentIntentId)}`
    + `&isBeta=${isBeta ? "1" : "0"}`;

  // Escape report content for safe HTML embedding
  const safeReport = reportContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const { error } = await resend.emails.send({
    from: "WWK System <hello@womenwhoknow.ca>",
    to: "banittaq@gmail.com",
    subject: `New Assessment Ready — ${customerName}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 40px 24px; color: #1C1A17;">
        <p style="font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B8956A; font-family: sans-serif; margin-bottom: 16px;">Women Who Know</p>
        <h2 style="font-weight: 300; font-size: 26px; margin: 0 0 16px;">New report ready for review</h2>
        <table style="font-family: sans-serif; font-size: 14px; color: #4A4540; margin-bottom: 24px;">
          <tr><td style="padding: 4px 16px 4px 0;"><strong>For:</strong></td><td>${customerName}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;"><strong>Deliver to:</strong></td><td>${customerEmail}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0;"><strong>Payment:</strong></td><td>${isBeta ? "Beta (no charge)" : paymentIntentId}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 0 0 24px;" />
        <p style="font-family: sans-serif; font-size: 13px; font-weight: 600; color: #1C1A17; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Generated Report</p>
        <div style="white-space: pre-wrap; font-family: Georgia, serif; font-size: 15px; line-height: 1.85; padding: 28px; background: #f9f9f9; color: #1C1A17; border-left: 3px solid #E0D8CC;">
${safeReport}
        </div>
        <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 24px 0;" />
        <a href="${editUrl}" style="display: inline-block; background: #2B9BAA; color: white; padding: 18px 40px; text-decoration: none; font-family: sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">
          Edit &amp; Send to ${customerName.split(" ")[0]} →
        </a>
        <p style="font-family: sans-serif; font-size: 12px; color: #999; margin-top: 12px;">
          Opens an edit page. Review, revise if needed, then click Send. Payment is captured when you send.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Admin email failed: ${error.message}`);
  }
}
