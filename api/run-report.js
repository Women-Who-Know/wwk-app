import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import crypto from "crypto";
import { get, put, list } from "@vercel/blob";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).send("Missing token.");

  try {
    // 1. Load submission answers from blob
    // List blobs to find the answers file for this token
    const { blobs } = await list({
      prefix: `answers/${token}`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobs || blobs.length === 0) {
      return res.status(404).send("Submission not found. It may have already been processed.");
    }

    const blobResult = await get(blobs[0].url, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const submission = JSON.parse(await new Response(blobResult.stream).text());
    const { name, email, answers, paymentIntentId, isBeta } = submission;

    // Debug: log revenue data
    console.log('q11_revenue from blob:', JSON.stringify(answers?.q11_revenue));

    // 2. Generate report — full Claude pipeline
    const reportContent = await generateReport(answers, name);

    // 3. Store report blobs
    const approvalToken = crypto.randomBytes(32).toString("hex");
    const { url: blobUrl } = await put(`reports/${approvalToken}.txt`, reportContent, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    await put(`originals/${approvalToken}.txt`, reportContent, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 4. Email admin with Edit & Send link
    const editUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/edit-report`
      + `?token=${approvalToken}`
      + `&blobUrl=${encodeURIComponent(blobUrl)}`
      + `&email=${encodeURIComponent(email)}`
      + `&name=${encodeURIComponent(name)}`
      + `&paymentIntentId=${encodeURIComponent(paymentIntentId)}`
      + `&isBeta=${isBeta ? "1" : "0"}`;

    const safeReport = reportContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    await resend.emails.send({
      from: "WWK System <hello@womenwhoknow.ca>",
      to: "banittaq@gmail.com",
      subject: `Report Ready — ${name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 40px 24px; color: #1C1A17;">
          <p style="font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #B8956A; font-family: sans-serif; margin-bottom: 16px;">Women Who Know</p>
          <h2 style="font-weight: 300; font-size: 26px; margin: 0 0 16px;">Report ready for review</h2>
          <table style="font-family: sans-serif; font-size: 14px; color: #4A4540; margin-bottom: 24px;">
            <tr><td style="padding: 4px 16px 4px 0;"><strong>For:</strong></td><td>${name}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Deliver to:</strong></td><td>${email}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0;"><strong>Payment:</strong></td><td>${isBeta ? "Beta (no charge)" : paymentIntentId}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 0 0 24px;" />
          <p style="font-family: sans-serif; font-size: 13px; font-weight: 600; color: #1C1A17; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Generated Report</p>
          <div style="white-space: pre-wrap; font-family: Georgia, serif; font-size: 15px; line-height: 1.85; padding: 28px; background: #f9f9f9; color: #1C1A17; border-left: 3px solid #E0D8CC;">
${safeReport}
          </div>
          <hr style="border: none; border-top: 1px solid #E0D8CC; margin: 24px 0;" />
          <a href="${editUrl}" style="display: inline-block; background: #2B9BAA; color: white; padding: 18px 40px; text-decoration: none; font-family: sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">
            Edit &amp; Send to ${name.split(" ")[0]} →
          </a>
        </div>
      `,
    });

    // 5. Redirect to edit page
    res.redirect(302, editUrl);

  } catch (err) {
    console.error("Report generation error:", err);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#1C1A17;">
        <h2 style="color:#c0392b;">Report generation failed</h2>
        <p>${err.message}</p>
        <p>Check Vercel logs for details. The submission is still saved — retry by clicking Generate Report again.</p>
      </body></html>
    `);
  }
}

// ─── Answer preprocessor ─────────────────────────────────────────────────────

function preprocessAnswers(answers) {
  const lines = [];

  // Q1 — Industry
  const ind = answers["q1_industry"];
  if (ind?.sector) lines.push(`INDUSTRY: She works in ${ind.sector}. Her specific niche: "${ind.niche || "not specified"}".`);

  // Q2 — Years
  if (answers["q2_years"]) lines.push(`YEARS IN BUSINESS: ${answers["q2_years"]}.`);

  // Q3 — Team
  const emp = answers["q3_employees"];
  if (emp?.count) {
    const structure = emp.structure ? ` Team structure: ${emp.structure}.` : "";
    lines.push(`TEAM: ${emp.count}.${structure}`);
  }

  // Q4 — Ideal client
  if (answers["q4_idealclient"]) lines.push(`IDEAL CLIENT (her exact words): "${answers["q4_idealclient"]}"`);

  // Q5 — What she does
  if (answers["q5_whatyoudo"]) lines.push(`WHAT SHE SAYS SHE DOES (her exact words): "${answers["q5_whatyoudo"]}"`);

  // Q6 — Decision avoided
  if (answers["q6_decision"]) lines.push(`DECISION SHE AVOIDED (her exact words): "${answers["q6_decision"]}"`);

  // Q7 — Offers
  const off = answers["q7_offers"];
  if (off?.count) {
    lines.push(`NUMBER OF OFFERS: ${off.count}.`);
    if (off.income) lines.push(`HIGHEST INCOME OFFER (her exact words): "${off.income}"`);
    if (off.profit) lines.push(`HIGHEST PROFIT OFFER (her exact words): "${off.profit}"`);
    if (off.income && off.profit && off.income !== off.profit) {
      lines.push(`NOTE: Her income offer and profit offer are different — this gap is diagnostically significant.`);
    }
  }

  // Q8 — Pricing decision
  if (answers["q8_pricing"]) lines.push(`HOW SHE PRICED HER HIGHEST OFFER (her exact words): "${answers["q8_pricing"]}"`);

  // Q9 — Last price increase
  if (answers["q9_priceincrease"]) lines.push(`LAST PRICE INCREASE (her exact words): "${answers["q9_priceincrease"]}"`);

  // Q10 — Price pressure response
  if (answers["q10_pressure"]) lines.push(`WHEN TOLD PRICE IS TOO HIGH, SHE: "${answers["q10_pressure"]}"`);

  // Q11 — Revenue
  const rev = answers["q11_revenue"];
  if (rev?.range) {
    lines.push(`MONTHLY REVENUE: ${rev.range}.`);
    if (rev.consistency) lines.push(`REVENUE CONSISTENCY: ${rev.consistency}.`);
  }

  // Q12 — Charge more sentence completion
  if (answers["q12_chargemore"]) lines.push(`SENTENCE COMPLETION — "I would charge more if..." (her exact words): "...${answers["q12_chargemore"]}"`);

  // Q13 — Client source
  const src = answers["q13_source"];
  if (src?.source) {
    lines.push(`WHERE CLIENTS COME FROM: ${src.source}.`);
    if (src.data) lines.push(`ABILITY TO PROVE IT WITH DATA: "${src.data}"`);
  }

  // Q14 — Prospective client conversations
  if (answers["q14_calls"]) lines.push(`NEW PROSPECTIVE CLIENT CONVERSATIONS PER MONTH: ${answers["q14_calls"]}.`);

  // Q15 — Conversion
  if (answers["q15_conversion"]) lines.push(`CONVERSATIONS THAT BECOME CLIENTS: ${answers["q15_conversion"]}.`);

  // Q16 — Bottleneck
  if (answers["q16_bottleneck"]) lines.push(`BIGGEST BOTTLENECK (her exact words): "${answers["q16_bottleneck"]}"`);

  // Q17 — What she knows needs to change
  if (answers["q17_know"]) lines.push(`WHAT SHE ALREADY KNOWS NEEDS TO CHANGE (her exact words): "${answers["q17_know"]}"`);

  // Q18 — Dream
  if (answers["q18_dream"]) lines.push(`IF TIME AND MONEY WERE NO OBJECT (her exact words): "${answers["q18_dream"]}"`);

  return lines.join("\n\n");
}

// ============================================================
// INDUSTRY BENCHMARKING REFERENCE DATA
// Sources (all verified, retrieved March 2026):
//   [A] ISED Canada Financial Performance Data 2023 (Statistics Canada)
//       https://ised-isde.canada.ca/app/ixb/cis/summary-sommaire/[NAICS]
//       Coverage: Canadian SMEs $30K-$20M revenue
//   [B] IRS Statistics of Income, Sole Proprietorship Returns TY2022
//       https://www.irs.gov/statistics/soi-tax-stats-sole-proprietorship-data
//       Coverage: ~31M US sole proprietors, all revenue levels
//       USD converted to CAD at 1.3761 (2026 YTD average)
//   [C] CFIB Empowering Women in Business: Insights & Recommendations (Dec 2023)
//       https://www.cfib-fcei.ca/hubfs/research/reports/2023/2023-12-empowering-women-business-en.pdf
//       Coverage: 572 Canadian women business owners surveyed
//   [D] ISED Key Small Business Statistics 2024
//       https://ised-isde.canada.ca/site/sme-research-statistics/en/key-small-business-statistics
//
// AI MAY ONLY CITE STATISTICS THAT APPEAR VERBATIM IN THIS BLOCK.
// If no benchmark exists for her situation, state the observation WITHOUT a number.
// Do not round, adjust, or extrapolate from these numbers.
// ============================================================

const BENCHMARKS = `
VERIFIED NORTH AMERICAN BENCHMARKING REFERENCE DATA
THE AI MAY ONLY CITE STATISTICS AND BENCHMARKS THAT APPEAR VERBATIM IN THIS BLOCK.
If a benchmark for her specific situation is not listed here, STATE THE OBSERVATION WITHOUT A NUMBER rather than inventing one.
Do not round or adjust numbers. Do not cite percentages or statistics that are not in this block.

All revenue figures are in Canadian dollars (CAD).
US figures converted at 1 USD = 1.3761 CAD (2026 YTD average).
The low end of each range reflects US sole proprietor averages (all operators, including part-time and nascent businesses).
The high end reflects Canadian SME averages (active businesses including those with employees).
A solo founder operating full-time should expect to sit between the low and the midpoint — not at the high end. That gap is structural, not a failure.

=== UNIVERSAL — NORTH AMERICAN SMALL BUSINESS CONTEXT ===
Source: ISED Key Small Business Statistics 2024 [D] + CFIB Women in Business Report 2023 [C]

BUSINESS SCALE REALITY:
- 98.2% of Canadian businesses are small (fewer than 100 employees)
- 59.2% of Canadian businesses have 1-4 employees — solo and micro-business is the norm, not the exception
- 90.6% of new businesses start with 1-4 employees

FEMALE FOUNDER REALITY (Canada — verified CFIB/ISED data):
- Women hold a majority stake in 16.8% of Canadian SMEs and represent 37% of self-employed individuals
- Women-owned businesses have created over 1.5 million jobs in Canada
- Female-owned business survival rate at 5 years: 77.5% (vs. 79.8% male-owned)
- Female-owned business survival at 10 years: 58.1% (vs. 62.2% male-owned)
- 22% of financing applications from women-only owned businesses are rejected outright (vs. 15% average for all businesses)
- 51% of women business owners report challenges accessing financing for their business
- 70% of women business owners identify managing multiple roles as their primary business challenge
- 64% of women business owners started their business to be their own boss and make their own decisions
- 93% of women entrepreneurs consider their business successful based on their own personal definition of success

SOLO OPERATOR STRUCTURAL CONSTRAINT (universal — applies to all sectors):
- Revenue ceiling for solo time-for-money businesses: approximately 40 billable hours/week × average service rate
- This ceiling is structural, not a performance issue — it applies regardless of skill or effort
- Breaking it requires raising the rate, reducing non-billable time, or adding leverage (staff, products, group offers)

NET MARGIN BENCHMARKS — North American sole proprietors (IRS TY2022) [B]:
Scale-independent — these apply whether revenue is $50K or $500K:
- Professional services (consulting, legal, tech, marketing): 40.9% typical net margin
- Real estate: 36.9% typical net margin
- Health care & social assistance: 35.6% typical net margin
- Finance & insurance: 22.0% typical net margin
- Arts, entertainment & recreation: 23.1% typical net margin
- Other services (beauty, personal care, food, fitness): 20.4% typical net margin
- Construction & trades: 14.4% typical net margin
- Retail trade: 6.3% typical net margin — lowest of any sector

=== BEAUTY & AESTHETICS ===
Source: ISED NAICS 81211 [A] + IRS Other Services [B]
- North American revenue range (CAD): $54,400 – $172,600
- Midpoint reference: $113,500
- % of Canadian businesses in this sector reporting a profit: 80.9%
- Typical net margin: 20.4%
- Note: The Canadian high includes owner-operators with staff. Solo operators typically sit below the midpoint.

=== COACHING & CONSULTING ===
Source: ISED NAICS 54161 [A] + IRS Prof. Scientific & Technical Services [B] + ICF 2023 Global Coaching Study [E]
[E] ICF 2023 Global Coaching Study, commissioned by ICF, conducted by PricewaterhouseCoopers. N=14,591 coach practitioners across 157 countries. https://coachingfederation.org/research/global-coaching-study

- North American revenue range (CAD): $87,100 – $233,200
- Midpoint reference: $160,100
- % of Canadian businesses in this sector reporting a profit: 89.7%
- Typical net margin: 40.9% — highest net margin of any sector; knowledge-based work with low overhead

VERIFIED PRICING BENCHMARKS — COACHING (ICF 2023, North America specific):
- Average session fee, North America: USD $272/hour → CAD $374/hour
- Average annual income from coaching, North America: USD $67,800 → CAD $93,400
- 72% of coach practitioners globally are female — this is a female-majority profession
- Average active client load: 13.5 clients; average coaching hours per week: 13.3 hours
- More than half of coaches globally (53%) earn under USD $30,000/year from coaching — the North America average is pulled up by experienced practitioners; entry-level and part-time coaches earn significantly less
- Coaches specializing in business/executive coaching earn above-average fees; those serving individual consumers earn below average
- The CAD $374/hr is the North America average across all experience levels. New coaches typically charge $75–$150/hr CAD; established coaches $250–$500+/hr CAD

IMPORTANT FOR REPORT GENERATION:
The ICF hourly rate reflects what coaches charge per session, not what they earn per working hour. A coach working 40 hours/week spends roughly 13 hours coaching and 27 hours on business development, admin, and non-billable activity. Use the annual income figure (CAD $93,400 North America average) as the more grounded revenue benchmark. A founder earning above $93,400 from coaching is performing above the North American average for active practitioners.

=== HEALTH & WELLNESS ===
Source: ISED NAICS 62139 [A] + IRS Health Care & Social Assistance [B] + CMMOTA 2023 Survey [F] + RMTAO 2024 Fee Survey [G]
[F] Canadian Massage and Manual Osteopathic Therapists Association, 2023 Massage Therapist Practice Survey. N=585 Canadian RMTs. https://cmmota.com/wp-content/uploads/2023/10/2023-Massage-Therapist-Practice-Survey-Report.pdf
[G] Registered Massage Therapists' Association of Ontario, 2024 Fee Survey. N=1,268 Ontario RMTs. http://www.rmtao.com/Media/Default/Member%20Resources%20(PDF)/2024%20Fee%20Survey.pdf

- North American revenue range (CAD): $80,900 – $232,500
- Midpoint reference: $156,700
- % of Canadian businesses in this sector reporting a profit: 94.0% — highest profitability rate of any sector in this dataset
- Typical net margin: 35.6%

VERIFIED PRICING BENCHMARKS — MASSAGE THERAPY (Canadian data, 2023-2024):
- National mean for 60-minute treatment: $95.62 CAD (CMMOTA 2023, N=585)
- Ontario mean for 60-minute treatment: $106–$109 CAD (RMTAO 2024, N=1,268)
- Provincial range: Saskatchewan $83.63/hr → Alberta $96.83/hr → BC $100/hr → Ontario $108.73/hr
- City-size range: Rural $81.79/hr → Large city (100K+) $99.03/hr
- 81.5% of Canadian massage therapists are self-employed (sole proprietor or contractor) — solo operation is the norm, not the exception
- 45.4% of Canadian massage therapists nationally required a secondary income source to cover living expenses — a practitioner not needing secondary income is performing above the sector median
- Most practitioners work 14–22 treatment hours/week — "full time" in this sector is 20–25 treatment hours, not 40; revenue ceiling is structurally lower than sectors without a billable hours constraint
- 36.96% of RMTs raised rates within the 6 months prior to the survey; inflation and increased expenses cited by 82%+ as the driver

NOTE FOR REPORT GENERATION: The massage therapy data is the best-verified Canadian health & wellness pricing benchmark available. Other sub-sectors (naturopathy, nutrition, acupuncture, energy work) have no equivalent verified Canadian pricing surveys. Use the massage benchmarks as directional context for session-based wellness practices but do not cite them specifically for non-massage modalities.

=== MARKETING & CREATIVE SERVICES ===
Source: ISED NAICS 54143 [A] + IRS Prof. Scientific & Technical Services [B]
- North American revenue range (CAD): $87,100 – $163,900
- Midpoint reference: $125,500
- % of Canadian businesses in this sector reporting a profit: 89.5%
- Typical net margin: 40.9%

=== EDUCATION & TRAINING ===
Source: ISED NAICS 61143 [A] + IRS Other Services [B]
- North American revenue range (CAD): $54,400 – $306,200
- Midpoint reference: $180,300
- % of Canadian businesses in this sector reporting a profit: 87.9%
- Typical net margin: 20.4%
- Note: Wide range reflects the difference between solo in-person educators and online course creators with leveraged delivery.

=== REAL ESTATE ===
Source: ISED NAICS 53121 [A] + IRS Real Estate & Rental/Leasing [B]
- North American revenue range (CAD): $113,000 – $216,400
- Midpoint reference: $164,700
- % of Canadian businesses in this sector reporting a profit: 87.6%
- Typical net margin: 36.9% — commission structure keeps overhead low relative to deal size

=== FINANCE & ACCOUNTING ===
Source: ISED NAICS 54121 [A] + IRS Finance & Insurance [B]
- North American revenue range (CAD): $238,500 – $247,000
- Midpoint reference: $242,700
- % of Canadian businesses in this sector reporting a profit: 87.0%
- Typical net margin: 22.0%
- Note: Tightest range in this dataset — US and Canadian averages are nearly identical, reflecting standardized pricing across North America.

=== LEGAL ===
Source: ISED NAICS 5411 [A] + IRS Prof. Scientific & Technical Services [B]
- North American revenue range (CAD): $87,100 – $398,000
- Midpoint reference: $242,500
- % of Canadian businesses in this sector reporting a profit: 84.7%
- Typical net margin: 40.9%

=== TECHNOLOGY & DIGITAL ===
Source: ISED NAICS 54151 [A] + IRS Prof. Scientific & Technical Services [B]
- North American revenue range (CAD): $87,100 – $318,200
- Midpoint reference: $202,600
- % of Canadian businesses in this sector reporting a profit: 84.8%
- Typical net margin: 40.9%

=== RETAIL & E-COMMERCE ===
Source: IRS Retail Trade [B] — ISED sub-industry data unavailable for this sector
- US sole prop average (converted to CAD): $121,300 — only verified revenue benchmark available for this sector
- Typical net margin: 6.3% — lowest of any sector; cost of goods sold is the dominant constraint
- Retail is a margin business first. Volume without margin improvement does not fix the underlying structure.

=== FOOD & HOSPITALITY ===
Source: ISED NAICS 72251 [A] + IRS Other Services [B]
- North American revenue range (CAD): $54,400 – $846,500
- % of Canadian businesses in this sector reporting a profit: 54.7% — nearly half do not profit; lowest profitability rate after non-profit sector
- Typical net margin: 20.4%
- Note: The Canadian high ($846,500) reflects staffed restaurant operations. Solo food entrepreneurs operate structurally closer to the low end. The 54.7% profitability rate is the most diagnostic number for this sector.

=== FITNESS & SPORT ===
Source: ISED NAICS 71394 [A] + IRS Arts, Entertainment & Recreation [B]
- North American revenue range (CAD): $48,700 – $377,200
- Midpoint reference: $213,000
- % of Canadian businesses in this sector reporting a profit: 71.4%
- Typical net margin: 23.1%

=== ARTS & ENTERTAINMENT ===
Source: ISED NAICS 71151 [A] + IRS Arts, Entertainment & Recreation [B]
- North American revenue range (CAD): $48,700 – $121,600
- Midpoint reference: $85,200
- % of Canadian businesses in this sector reporting a profit: 92.4%
- Typical net margin: 23.1%
- Note: High profitability rate paired with low revenue ceiling reflects structural constraint. Independent artists who do earn profit are typically highly selective about what they take on.

=== PHOTOGRAPHY ===
Source: ISED NAICS 541921 [A] + IRS Professional, Scientific & Technical Services [B]
- North American revenue range (CAD): $43,500 – $216,400
- Midpoint reference: $130,000
- % of Canadian businesses in this sector reporting a profit: 87.6%
- Typical net margin: 31.2%
- Pricing benchmark: Portrait/headshot photographers at 3–5 years typically price sessions at $350–$900 CAD; commercial/corporate photographers command $1,200–$4,500 CAD per day rate
- Key structural constraint: Revenue ceiling is set by billable hours — a solo photographer has a hard physical ceiling unless they introduce digital products, licensing, or associate photographers
- Note: Covers portrait, commercial, event, headshot, and wedding photographers operating as sole proprietors or small studios. Excludes fine art photography (use Arts & Entertainment for that). Businesses with recurring corporate clients dramatically outperform those dependent on one-time bookings.

=== NON-PROFIT & SOCIAL ENTERPRISE ===
Source: ISED NAICS 81341 [A]
- Canadian SME average revenue: $451,600
- % of Canadian businesses in this sector reporting a profit: 57.6% — nearly half do not generate surplus
- Note: IRS sole proprietor data not applicable — registered nonprofits do not file Schedule C.

=== TRADES & HOME SERVICES ===
Source: ISED NAICS 23899 [A] + IRS Construction [B]
- North American revenue range (CAD): $156,400 – $421,000
- Midpoint reference: $288,700
- % of Canadian businesses in this sector reporting a profit: 82.8%
- Typical net margin: 14.4% — materials costs are the dominant expense structure
`;

// ─── Report generation ───────────────────────────────────────────────────────

async function generateReport(answers, name) {
  const processedAnswers = preprocessAnswers(answers);

  const system = `You are writing a personalised Founder Benchmark Assessment report for Women Who Know, written in Anitta Hamming's voice and delivered as if Anitta personally read every answer and wrote this response directly to her.

SPELLING: Use Canadian English throughout. This means "ize" endings (organize, recognize, authorize, prioritize, customize) and "ou" spellings (colour, honour, favour, neighbour). Never use British "ise" endings (organise, recognise, authorise) in this report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE SINGLE MOST IMPORTANT RULE IN THIS PROMPT:
Quote her exact words back to her. Use quotation marks. Reference what she specifically wrote.
If any sentence you write could apply to any founder without changing it — delete it and rewrite it using her actual words.
This rule overrides everything else.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANITTA'S VOICE — THESE ARE RULES, NOT SUGGESTIONS:
RULE: Be direct. Warm but never soft. Hard truths delivered with care.
RULE: Diagnostic — name the pattern beneath the stated problem precisely.
RULE: Never say "fear-based" — say "story-based thinking"
RULE: Never say "you are enough" — say "your worth isn't earned"
RULE: Never say "trust yourself" — say "you already know"
RULE: Never say "journey", "amazing", "you've got this", "empower", "lean in", "hustle"
RULE: Never open with meta-commentary about the report itself. Do not write phrases like "I read every word you wrote", "this report was built from your answers", "not a template", "not a framework dropped on top of your situation", or any other sentence that describes the report rather than her business. Start with her, not with the process.
RULE: Truth first. Hope second. Always in that order.
RULE: Hope must be diagnostic — grounded in specific numbers and specific gap closures, never motivational.
RULE: Do not use the words "likely", "probably", "perhaps", "may" when describing her business situation. If you are not certain based on her answers, do not state it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FABRICATION PREVENTION — THESE ARE HARD STOPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD STOP 1 — SILENCE IS NOT DATA:
Her not mentioning something is not evidence that the thing is true or false. Do not infer anything — positive or negative — from what she did not say.
WRONG: She didn't mention needing a second income, so she doesn't need one. → "You are performing above the sector median in sustainability."
WRONG: She didn't mention struggles with X, so she must be fine with X.
RIGHT: If she didn't say it, you do not know it. Do not write it.
This applies especially to positive inferences. Positive claims made from silence feel like bonuses to the reader — they are fabrications.

HARD STOP 2 — NO INLINE SOURCE CITATIONS IN THE REPORT BODY:
Do not write source names, study names, or sample sizes inside the report text.
WRONG: "The national average is $95.62 (CMMOTA 2023, N=585 Canadian RMTs)"
RIGHT: "The national Canadian average for a 60-minute massage is $95.62"
Source attribution belongs on the methodology page. The report is a letter, not a data sheet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING CALIBRATION — HARD RULES:
The CWW scores must reflect business reality, not communication quality.
RULE: A founder who writes articulately does not score higher than one who answers in fragments if their underlying business indicators are the same.
RULE: For any founder who has been in business 2 or more years, revenue is the highest-weighted indicator of business health. What she has actually built — in numbers — outweighs how confidently she describes it.
RULE: Score against outcomes, not intentions. "I plan to raise my prices" is not evidence of WORTHY. Actual current pricing is.
RULE: A high score requires hard evidence from her answers. A low score requires no justification beyond absence of evidence — absence is the diagnosis.

STATISTICS AND BENCHMARKING — HARD RULES:
RULE 1: You may ONLY cite statistics, percentages, and benchmarks that appear verbatim in the BENCHMARKING REFERENCE DATA block below. No exceptions.
RULE 2: If the reference data does not contain a benchmark for her specific situation, state the observation without a number. Do not invent statistics.
RULE 3: When you use a benchmark, apply it specifically to her stated numbers — not generically.
RULE 4: Do not round or adjust benchmark numbers from the reference data.
RULE 5: Use directional language when connecting benchmarks to revenue outcomes. "This closes most of the gap" is correct. A specific calculated dollar figure presented as precise is not — her answers do not contain the exact data to support it.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HANDLING THIN OR VAGUE ANSWERS — HARD RULES:
RULE: If she gave a vague answer (e.g. "women in business", "I don't know", "I coach"), do not assume or infer what she meant. Instead, name the vagueness itself as a diagnostic data point. Example: "You described your ideal client as 'women in business' — that level of generality is itself the gap. The CLEAR work hasn't happened yet."
RULE: If her dream answer (final question) is vague or "I don't know", do not fabricate a dream. Instead write: "You said you don't know what you'd do — and that answer tells me something too. When a founder can't access what she wants, it's usually because she's been managing survival for so long that desire has gone quiet. That's a CLEAR and WORTHY gap showing up at the same time."
RULE: Never fill an unanswered or thinly-answered section with plausible-sounding content. Silence or vagueness is data.

${BENCHMARKS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORT STRUCTURE — Generate exactly these sections using ## headers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Your Business Snapshot
START with her industry, years in business, and team structure — these are the frame for everything that follows.
Then: 2-3 paragraphs synthesising what you see. Quote her exact words in at least 3 places in this section. Make it impossible for her to think this is a template. Name what you see beneath what she said — not what she said literally.

## How You Stack Up
This section must feel like a mirror.
Use ONLY benchmarks from the reference data above. Apply each benchmark specifically to her stated numbers — not generically.

HARD STOP — USE HER STATED REVENUE: Her monthly revenue range is in her answers. Use it. Do NOT write "without seeing your specific revenue" or any other hedge. She told you her revenue range. State where that range sits relative to the benchmark. If her monthly range is $7-15K, her annual range is roughly $84K-$180K. Say that. Compare it directly to the benchmark. Never pretend you don't have this information.

HYBRID BUSINESS RULE: If her business spans two sectors (e.g. massage therapy and coaching, retail and consulting, education and services), acknowledge this explicitly at the start of this section. Name both sectors. Explain that the benchmarks become less precise when a business crosses categories, and be transparent about which category each benchmark comes from. Use this language: "Your business sits across two categories — [sector A] and [sector B] — which makes the benchmarks harder to apply with precision. Here's how each set of numbers reads for your situation." Then present the primary sector benchmarks first, secondary sector second, and note which portion of her revenue each likely reflects based on what she told you. Do not blend them silently.

Structure: Revenue benchmark → Pricing benchmark → Team structure benchmark → Client acquisition benchmark → any other relevant benchmarks for her sector.
For each benchmark: state where she sits (above / at / below), by how much. Use directional language for revenue impact — do not present calculated dollar figures as precise when her answers only provided ranges.
Do not soften. Do not hedge. This is data, not opinion.

## Your Top Gaps
Identify the most significant gaps revealed by her answers. Minimum 1, maximum 4. Do not invent gaps to reach a number and do not compress multiple real gaps into one to stay under a number. Let her answers determine how many there are.

Number each gap. For each gap:

[Gap name — precise and specific, not generic]
2-3 sentences naming the gap exactly, quoting her words, quantifying the cost where the benchmarks support it. Name which pillar this falls under (CLEAR / WORTHY / WEALTHY) and why.

Then — under each gap — write:
"To close this gap:"
Three numbered implementation steps. Each step must be:
- Specific enough to start tomorrow
- Realistic without outside help
- But revealing enough complexity that the gap between knowing and doing becomes visible
The steps are not easy. They reveal the work. That is intentional.

## Your Clear, Worthy, Wealthy Score

CLEAR (Positioning & Clarity): [X]/10
One sharp paragraph. Quote her exact words from her ideal client answer and her "what do you do" answer. Score must reflect what her answers actually revealed — not a generous estimate.

WORTHY (Pricing & Self-Worth): [X]/10
One sharp paragraph. Quote her price pressure response and her "I would charge more if..." completion. Name the pattern precisely.

WEALTHY (Operations & Scale): [X]/10
One sharp paragraph. Reference her revenue range, consistency, team structure, and bottleneck answer directly.

Under EACH score — write:
"Three steps to move your [PILLAR] score:"
Three numbered steps. Same standard as the gap steps — specific, real, complexity-revealing.

HARD STOP 3 — NO INVENTED NUMBERS IN ACTION STEPS:
Never include a specific percentage, dollar amount, timeframe, or quantity in an action step unless the founder stated it explicitly in her answers OR it is supported directly by the benchmarking reference data.
- Directional pricing recommendations are allowed and encouraged: "Raise your prices for new clients" or "Consider a staged price increase" are correct.
- Specific amounts are fabricated unless backed by data: "Raise prices by 25%" is wrong — that number came from nowhere.
- Never recommend removing or adding business infrastructure (payment plans, contracts, cancellation policies) unless the founder mentioned it — that is an assumption about her business.
- Timeframes like "for 90 days" or "for 30 days" are fabricated unless she stated them.
CORRECT: "Raise your prices for new clients — start with new enquiries before rolling it to existing clients."
WRONG: "Raise prices by 25% and remove payment plan options."
CORRECT: "Track how often you discount and what it costs you in annual revenue."
WRONG: "Track discounting for 90 days — calculate the immediate discount and the referral pricing precedent you're setting."

## The Path Forward
One focused paragraph.
If her dream answer was specific: connect her current situation to her stated dream using directional language grounded in the gaps identified. Do not calculate or present specific dollar figures — her answers do not contain the precision to support them. "Closing this gap moves you significantly closer to your goal" is correct. "$52,986 more per year" is not.
If her dream answer was vague: use the vague-answer instruction above, then pivot to what closing her specific gaps would produce directionally over 12 months.
End with: "The question is whether you take these steps alone or with someone who has done this before."

## Your Next Step
Warm. Direct. Not salesy.
Acknowledge both types of reader — the one who feels ready to start, and the one who knows she needs someone in the room.
Tell her about The Reset Point: a 90-minute session with Anitta, a fully executable written plan, a 30-day follow-up call.
Spots are currently closed. Waitlist only. First come, first served.
Do not oversell. The report already did the selling.`;

  const user = `Write the complete personalised Founder Benchmark Assessment report for ${name}.

CONFIRMED DATA — USE THESE NUMBERS DIRECTLY IN THE REPORT:
Monthly revenue range: ${answers['q11_revenue']?.range || 'not provided'}
Revenue consistency: ${answers['q11_revenue']?.consistency || 'not provided'}

Her pre-processed answers:
${processedAnswers}

Write the full report now. Remember: quote her exact words. Every sentence must be traceable to something she actually wrote.`;

  // ── Call 1: Generate draft ──
  const draft = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content: user }],
  }).then(r => r.content[0].text);

  if (!draft) return "";

  // ── Call 2: Audit for fabrication, misrepresentation, missing revenue ──────
  const auditSystem = `You are an accuracy auditor for Women Who Know assessment reports. Check the report against the founder's actual answers and benchmarking data.

Five violation types to flag:
1. FABRICATED STATISTIC — any number not found verbatim in the benchmarking data, OR invented in a recommendation (e.g. "raise prices by 25%")
2. MISREPRESENTATION — distorts, exaggerates, or contradicts what she actually wrote
3. ASSUMPTION — stated as fact but she never said it (including positive inferences from silence)
4. MISSING REVENUE — Section 2 does not open with her specific monthly revenue range
5. INLINE CITATION — source names or sample sizes in the report body (e.g. "ISED", "ICF 2023", "N=585")

Return format:
If problems found: [TYPE]: "[text]" — REASON: [why]
If no problems: Return only the word PASS`;

  const auditResult = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: auditSystem,
    messages: [{ role: "user", content: `FOUNDER'S ANSWERS:\n${processedAnswers}\n\nBENCHMARKS:\n${BENCHMARKS}\n\nREPORT:\n${draft}\n\nAudit now.` }],
  }).then(r => r.content[0].text.trim());

  if (auditResult === "PASS") return draft;
  return draft + "\n\n---\n**AUDIT FLAGS — REVIEW BEFORE SENDING:**\n" + auditResult;
}
