import { useState, useEffect, useRef } from "react";

// API calls handled server-side via /api routes

// ============================================================
// WOMEN WHO KNOW — FOUNDER BENCHMARK ASSESSMENT
// $57 | Card held upfront | Charged on delivery | Zero Anitta time
// ============================================================

const PRICE = 57;

const INDUSTRIES = [
  "Business & Professional Services",
  "Coaching & Consulting",
  "Health & Wellness",
  "Beauty & Aesthetics",
  "Finance & Accounting",
  "Legal & Compliance",
  "Marketing & Creative Services",
  "Technology & Digital Products",
  "Real Estate",
  "Education & Training",
  "Retail & E-commerce",
  "Food & Hospitality",
  "Arts & Entertainment",
  "Non-Profit & Social Enterprise",
  "Other",
];

const QUESTIONS = [
  {
    id: "q1_industry",
    type: "industry",
    question: "What industry or sector is your business in?",
    hint: '"Coaching" is a sector. "Business coaching for female founders hitting an income plateau" is an industry position. The more specific you are here, the more accurate your benchmark comparison will be.',
  },
  {
    id: "q2_years",
    type: "choice",
    question: "How long have you been in business?",
    options: ["Under 1 year", "1-2 years", "3-5 years", "6-10 years", "10+ years"],
  },
  {
    id: "q3_employees",
    type: "employees",
    question: "How many people work in your business?",
    options: [
      "Just me",
      "Me plus one key person who keeps everything running",
      "Me, one key person, and additional part time or contract support",
      "Small team — 3-5 people in various capacities",
      "Established team — 6-10 people",
      "10+ people",
    ],
    structureOptions: [
      "Employed (salary or hourly)",
      "Commission based",
      "Contractor or freelance",
      "A mix — it depends on the role",
    ],
  },
  {
    id: "q4_idealclient",
    type: "textarea",
    question: "Describe your ideal client in one sentence — not who you want to serve, but who actually pays you and gets results.",
    placeholder: "She is...",
    hint: 'Be specific. If it\'s "women entrepreneurs" you\'re not there yet.',
  },
  {
    id: "q5_whatyoudo",
    type: "textarea",
    question: "When someone asks what you do, what do you actually say?",
    placeholder: "I say...",
    hint: "Here is where your rubber meets the road. No one wants to answer this in an unvarnished way. Dig deep and do it anyway — because the more honest you are, the more helpful your report will be.",
  },
  {
    id: "q6_decision",
    type: "textarea",
    question: "What's the last significant business decision you delayed or avoided? And why?",
    placeholder: "I kept putting off...",
    hint: "Take your time with this one. The more specific you are about the situation and your reasoning, the more useful this becomes in your report.",
  },
  {
    id: "q7_offers",
    type: "offers",
    question: "How many offers or services do you currently sell?",
    options: ["1-2", "3-4", "5-7", "8+"],
    hint: "If your answers to those two questions are different, that gap is worth paying attention to.",
  },
  {
    id: "q8_pricing",
    type: "textarea",
    question: "Think about your highest-priced offer. How did you determine what to charge for it? And how often do you discount it?",
    placeholder: "I priced it by...",
    hint: "I'm not here to judge your number. How you priced it and what you do under pressure tells me more about your business than the number itself.",
  },
  {
    id: "q9_priceincrease",
    type: "textarea",
    question: "When did you last raise your prices? What was the specific thing that led to that decision?",
    placeholder: "The last time I raised prices...",
    hint: "If you've never raised your prices, say that.",
  },
  {
    id: "q10_pressure",
    type: "choice",
    question: "Here's a tough one to answer directly: when a prospect says your price is too high, what do you do?",
    options: [
      "Hold the price — it's right for the value",
      "Sometimes offer a discount or payment plan to close",
      "Usually find a way to make it work for them",
      "I back down — losing the sale feels worse",
    ],
  },
  {
    id: "q11_revenue",
    type: "revenue",
    question: "What does your monthly revenue look like right now?",
    options: ["Under $3K", "$3-7K", "$7-15K", "$15-30K", "$30K+"],
    consistencyOptions: ["Consistent", "Somewhat consistent", "Significantly fluctuates"],
  },
  {
    id: "q12_chargemore",
    type: "sentence",
    question: "Another tough one, but you've got this. Finish this sentence:",
    stem: "I would charge more if...",
    placeholder: "...",
    hint: "Your first instinct or thought IS the right answer — resist the natural urge to make it polished.",
  },
  {
    id: "q13_source",
    type: "source",
    question: "How do most of your clients currently find you?",
    options: ["Referrals", "Social media", "Networking", "Paid ads", "Mixed", "Honestly not sure"],
    dataOptions: [
      "Could provide it easily and quickly",
      "Could provide it easily but not quickly",
      "It would be challenging to gather",
      "I couldn't prove it, but I could give you a really good guess",
      "Would offer to get you a coffee instead",
    ],
  },
  {
    id: "q14_calls",
    type: "choice",
    question: "How many times per month are you speaking with a new prospective client?",
    options: ["0-2", "3-5", "6-10", "11-20", "20+", "I would be guessing"],
  },
  {
    id: "q15_conversion",
    type: "choice",
    question: "Of those conversations, how many typically move forward into a working relationship?",
    options: ["Under 20%", "20-40%", "40-60%", "60-80%", "80%+", "I would be guessing"],
  },
  {
    id: "q16_bottleneck",
    type: "textarea",
    question: "What's the biggest bottleneck in your business right now — the thing that would break if you got 3x busier tomorrow?",
    placeholder: "The thing that would break first is...",
    hint: "This tells us where your real ceiling is right now.",
  },
  {
    id: "q17_know",
    type: "textarea",
    question: "What's the one thing you already know needs to change — the thing you've been circling around but haven't acted on yet?",
    placeholder: "The thing I know but haven't done yet is...",
    hint: "You already know this answer. Type it.",
  },
  {
    id: "q18_dream",
    type: "textarea",
    question: "If you woke up tomorrow and time and money were no object, what is the first thing you would do?",
    placeholder: "The first thing I would do is...",
    hint: 'Most people immediately jump in and say "I don\'t know." I have been a coach for years and I promise you, you do.',
  },
];

const TOTAL = QUESTIONS.length;

// ============================================================
// REPORT GENERATOR
// ============================================================

// ============================================================
// ANSWER PRE-PROCESSOR
// Converts raw answers into natural language before hitting the API
// Prevents JSON objects from reaching the prompt as clinical data
// ============================================================

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

// ============================================================
// MAIN REPORT GENERATOR — Two-call architecture
// Call 1: Generate report
// Call 2: Audit for hallucination, fabrication, distortion
// If audit flags issues, rewrite flagged sections only
// ============================================================

async function generateReport(answers, name) {
  const processedAnswers = preprocessAnswers(answers);

  // Detect industry for targeted benchmarking instruction
  const industry = answers["q1_industry"]?.sector || "unknown";
  const yearsInBusiness = answers["q2_years"] || "unknown";
  const monthlyRevenue = answers["q11_revenue"]?.range || "unknown";
  const dream = answers["q18_dream"] || "";

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

Her pre-processed answers:
${processedAnswers}

Write the full report now. Remember: quote her exact words. Every sentence must be traceable to something she actually wrote.`;

  // ── CALL 1: Generate report ──
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = await response.json();
  const draft = data.content?.[0]?.text || "";

  if (!draft) return "";

  // ── CALL 2: Audit for hallucination and fabrication ──
  const auditSystem = `You are an accuracy auditor for Women Who Know assessment reports. Your only job is to check a generated report against the founder's actual answers and a benchmarking reference dataset.

You are looking for exactly five types of problems:

1. FABRICATED STATISTIC — any percentage, number, or statistic that is either (a) not found verbatim in the benchmarking reference data provided, OR (b) invented as a specific recommendation (e.g. "raise prices by 25%", "contact 10 leads per week", "block 3 hours per day"). Specific numbers in action steps are fabricated unless the founder stated them explicitly in her answers. Check every number in both the benchmarking sections AND the action steps.

2. MISREPRESENTATION — any statement about her business that distorts, exaggerates, or contradicts what she actually wrote in her answers.

3. ASSUMPTION — any claim stated as fact about her situation that she did not explicitly state in her answers. This includes neutral and negative inferences. If she didn't say it, it cannot appear as a stated fact.

4. POSITIVE INFERENCE FROM SILENCE — this is the most common failure mode and requires explicit checking. Search the report for any positive claim about her performance, capabilities, habits, or situation. For each one, find the exact answer that supports it. If there is no direct answer supporting it — if the claim is based on her NOT mentioning a problem — flag it immediately.
Examples of this violation:
- She didn't mention needing a second income → report claims she doesn't need one → VIOLATION
- She didn't mention client complaints → report implies her service quality is excellent → check: did she explicitly say this?
- She didn't mention struggling with X → report says she handles X well → VIOLATION

5. INLINE CITATION — any source name, study name, or sample size appearing in the report body text. Examples: "CMMOTA 2023", "ICF study", "N=585", "IRS data", "ISED". These do not belong in the report.

6. SCORE INCONSISTENCY — the numeric scores stated in the "Your Clear, Worthy, Wealthy Score" section (e.g. "CLEAR (Positioning & Clarity): 8/10") must match each other within the report. If WORTHY is scored 4/10 in one place, it cannot appear as 8/10 anywhere else. Find every instance of a CLEAR, WORTHY, or WEALTHY score and verify they are identical throughout the report.

Return your response in exactly this format:
If problems found: List each problem as: [TYPE]: "[the problematic text]" — REASON: [why it's a problem]
If no problems found: Return only the word PASS

Do not comment on writing quality, tone, or style. Only flag accuracy violations.`;

  const auditUser = `FOUNDER'S ACTUAL ANSWERS:
${processedAnswers}

BENCHMARKING REFERENCE DATA:
${BENCHMARKS}

REPORT TO AUDIT:
${draft}

Audit now. Return PASS or list of violations only.`;

  const auditResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: auditSystem,
      messages: [{ role: "user", content: auditUser }],
    }),
  });

  const auditData = await auditResponse.json();
  const auditResult = auditData.content?.[0]?.text || "PASS";

  // ── If audit passes, return draft ──
  if (auditResult.trim() === "PASS") return draft;

  // ── If audit flags issues, rewrite with violations explicitly blocked ──
  const rewriteUser = `The following accuracy violations were found in the draft report. Rewrite the complete report, correcting only the flagged violations. Everything else stays the same.

VIOLATIONS TO FIX:
${auditResult}

FOUNDER'S ACTUAL ANSWERS:
${processedAnswers}

ORIGINAL DRAFT:
${draft}

Rewrite the full report now with violations corrected.`;

  const rewriteResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: rewriteUser }],
    }),
  });

  const rewriteData = await rewriteResponse.json();
  const rewrittenReport = rewriteData.content?.[0]?.text || draft;

  // ── CALL 3: Second audit pass on rewritten report ──
  const secondAuditResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: auditSystem,
      messages: [{ role: "user", content: `FOUNDER'S ACTUAL ANSWERS:\n${processedAnswers}\n\nBENCHMARKING REFERENCE DATA:\n${BENCHMARKS}\n\nREPORT TO AUDIT:\n${rewrittenReport}\n\nAudit now. Return PASS or list of violations only.` }],
    }),
  });

  const secondAuditData = await secondAuditResponse.json();
  const secondAuditResult = secondAuditData.content?.[0]?.text || "PASS";

  // If second audit passes, return rewritten report
  // If it still fails, return rewritten report anyway but log the remaining violations
  // (A third rewrite risks infinite loop — remaining issues surface in QA)
  if (secondAuditResult.trim() !== "PASS") {
    console.warn("Second audit flagged remaining violations:", secondAuditResult);
  }

  return rewrittenReport;
}

function extractScores(text) {
  const scores = { CLEAR: null, WORTHY: null, WEALTHY: null };
  // Match "CLEAR (Positioning & Clarity): 8/10" or "**CLEAR ...: 8/10**" in the score section
  // Look specifically for the pillar name followed by a colon and score, not just any mention
  const lines = text.split('\n');
  for (const line of lines) {
    if (/CLEAR[^:]*:\s*\d+\/10/i.test(line) && scores.CLEAR === null) {
      const m = line.match(/CLEAR[^:]*:\s*(\d+)\/10/i);
      if (m) scores.CLEAR = parseInt(m[1]);
    }
    if (/WORTHY[^:]*:\s*\d+\/10/i.test(line) && scores.WORTHY === null) {
      const m = line.match(/WORTHY[^:]*:\s*(\d+)\/10/i);
      if (m) scores.WORTHY = parseInt(m[1]);
    }
    if (/WEALTHY[^:]*:\s*\d+\/10/i.test(line) && scores.WEALTHY === null) {
      const m = line.match(/WEALTHY[^:]*:\s*(\d+)\/10/i);
      if (m) scores.WEALTHY = parseInt(m[1]);
    }
  }
  return scores;
}

function parseReport(text) {
  const sections = [];
  const regex = /##\s+(.+?)\n([\s\S]*?)(?=##\s+|$)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const content = m[2].trim();
    if (content) sections.push({ title: m[1].trim(), content });
  }
  return sections;
}

// ============================================================
// APP
// ============================================================

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [report, setReport] = useState("");
  const [scores, setScores] = useState({});
  const [sections, setSections] = useState([]);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const q = QUESTIONS[currentQ];
  const progress = (currentQ / TOTAL) * 100;

  function setAnswer(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function canProceed() {
    const a = answers[q?.id];
    if (!a) return false;
    if (q.type === "industry") return a.sector && a.niche && a.niche.trim().length > 2;
    if (q.type === "employees") return a.count && (a.count === "Just me" || a.structure);
    if (q.type === "revenue") return a.range && a.consistency;
    if (q.type === "source") return a.source && a.data;
    if (q.type === "sentence") return a && a.trim().length > 3;
    if (typeof a === "string") return a.trim().length > 3;
    return true;
  }

  function next() {
    if (!canProceed()) { setError("Please answer this question to continue."); return; }
    setError("");
    if (currentQ < TOTAL - 1) {
      setCurrentQ((c) => c + 1);
    } else {
      handleGenerate();
    }
  }

  function back() {
    if (currentQ > 0) { setCurrentQ((c) => c - 1); setError(""); }
  }

  async function handleGenerate() {
    setScreen("generating");
    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          name,
          email,
          industry: answers["q2"] || "",
          businessType: answers["q3"] || "",
          yearsInBusiness: answers["q1"] || "",
          paymentIntentId,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Report generation failed");
      }
      setScreen("submitted");
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      setScreen("assessment");
    }
  }

  function handleChoiceSelect(value) {
    setAnswer(q.id, value);
    setTimeout(() => {
      setError("");
      if (currentQ < TOTAL - 1) setCurrentQ((c) => c + 1);
      else handleGenerate();
    }, 350);
  }

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {screen === "landing" && <Landing onStart={() => setScreen("details")} />}
      {screen === "details" && (
        <Details
          name={name} setName={setName}
          email={email} setEmail={setEmail}
          error={error} setError={setError}
          onNext={() => {
            if (!name.trim() || !email.trim()) { setError("Please enter your name and email."); return; }
            setError("");
            setScreen("payment");
          }}
        />
      )}
      {screen === "payment" && (
        <Payment
          name={name} email={email}
          onPay={(intentId) => { setPaymentIntentId(intentId); setAnswers({}); setCurrentQ(0); setScreen("assessment"); }}
          error={error} setError={setError}
        />
      )}
      {screen === "assessment" && (
        <Assessment
          q={q} currentQ={currentQ} total={TOTAL} progress={progress}
          answers={answers} setAnswer={setAnswer}
          onNext={next} onBack={back}
          onChoiceSelect={handleChoiceSelect}
          canProceed={canProceed}
          error={error} name={name}
        />
      )}
      {screen === "generating" && <Generating name={name} />}
      {screen === "report" && (
        <Report
          name={name} sections={sections} scores={scores} rawReport={report}
        />
      )}
    </div>
  );
}

// ============================================================
// SCREENS
// ============================================================

function Landing({ onStart }) {
  return (
    <div>
      <nav style={S.topNav}>
        <a href="https://women-who-know.github.io/wwk-landing/" style={S.navLogo}>Women Who Know</a>
        <button style={S.navBtn} onClick={onStart}>Begin Assessment — $57</button>
      </nav>
      {/* Dark hero section — matches landing page */}
      <div style={{ background: COLORS.dark, padding: "96px 56px 80px" }}>
        <div style={{ maxWidth: 680 }}>
          <div style={{ ...S.wwk, color: COLORS.teal, marginBottom: 28 }}>Founder Benchmark Assessment</div>
          <h1 style={{ ...S.h1, color: COLORS.white, marginBottom: 32 }}>
            Where are you<br /><em>actually</em> stuck?
          </h1>
          <p style={{ ...S.lead, color: "rgba(255,255,255,0.75)", marginBottom: 48 }}>
            Not where you think you're stuck.<br />Where the numbers say you're stuck.
          </p>
          <button style={{ ...S.btn, width: "auto", display: "inline-block", padding: "20px 48px", marginTop: 0, letterSpacing: "0.12em" }} onClick={onStart}>
            Begin My Assessment — $57
          </button>
          <p style={{ ...S.fine, color: "rgba(255,255,255,0.45)", marginTop: 20 }}>
            Card held at checkout. Charged only when your report is ready.
          </p>
        </div>
      </div>
      {/* White content section */}
      <div style={{ background: COLORS.white, padding: "72px 56px 80px" }}>
        <div style={{ maxWidth: 680 }}>
          <p style={{ ...S.body, textAlign: "left", fontSize: 17, lineHeight: 1.85, color: COLORS.inkLight, marginBottom: 48 }}>
            The Founder Benchmark Assessment gives you a personalised diagnostic report —
            where you sit against industry benchmarks, where your revenue is leaking,
            and exactly what to do about it. 18 questions. Delivered within one business day.
            Written specifically for you — not a template.
          </p>
          <div style={S.pillars}>
            {[["CLEAR", "Positioning & Clarity", COLORS.gold], ["WORTHY", "Pricing & Self-Worth", COLORS.teal], ["WEALTHY", "Operations & Scale", COLORS.dark]].map(([p, d, c]) => (
              <div key={p} style={S.pillar}>
                <span style={{ ...S.pillarLabel, color: c }}>{p}</span>
                <span style={S.pillarSub}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Details({ name, setName, email, setEmail, error, setError, onNext }) {
  return (
    <div style={S.center}>
      <div style={{ ...S.container, maxWidth: 520 }} className="fadein">
        <div style={S.wwk}>Women Who Know</div>
        <h2 style={S.h2}>Let's get started.</h2>
        <p style={{ ...S.body, marginBottom: 48 }}>Enter your details to access the assessment.</p>
        <div style={S.field}>
          <label style={S.label}>Your name</label>
          <input style={S.input} value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="First name is fine" />
        </div>
        <div style={S.field}>
          <label style={S.label}>Email address</label>
          <input style={S.input} type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="Where we'll send your report" />
        </div>
        {error && <p style={S.err}>{error}</p>}
        <button style={S.btn} onClick={onNext} className="btn">Continue →</button>
        <p style={S.fine}>Your report will be emailed to you within one business day.</p>
      </div>
    </div>
  );
}

function Payment({ name, email, onPay, error, setError }) {
  const [loading, setLoading] = useState(false);
  const [stripe, setStripe] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const cardRef = useRef(null);
  const cardElementRef = useRef(null);

  const VALID_COUPON = "WWKBETA";

  function handleCouponApply() {
    if (coupon.trim().toUpperCase() === VALID_COUPON) {
      setCouponApplied(true);
      setError("");
    } else {
      setError("Invalid coupon code.");
    }
  }

  // Load Stripe.js and create PaymentIntent on mount — only if no coupon
  useEffect(() => {
    if (couponApplied) return;

    let cardElement = null;

    async function init() {
      try {
        if (!window.Stripe) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://js.stripe.com/v3/";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const stripeInstance = window.Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        setStripe(stripeInstance);

        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
        });
        if (!res.ok) throw new Error("Could not initialise payment.");
        const data = await res.json();
        setClientSecret(data.clientSecret);

        const els = stripeInstance.elements();
        cardElement = els.create("card", {
          style: {
            base: {
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "16px",
              fontWeight: "300",
              color: "#1C1A17",
              "::placeholder": { color: "#8A837A" },
              lineHeight: "1.6",
            },
            invalid: { color: "#c0392b" },
          },
          hidePostalCode: true,
        });
        cardElementRef.current = cardElement;
        if (cardRef.current) cardElement.mount(cardRef.current);
      } catch (e) {
        setError(e.message || "Payment setup failed. Please refresh and try again.");
      }
    }

    init();

    return () => {
      if (cardElementRef.current) {
        try { cardElementRef.current.unmount(); } catch {}
      }
    };
  }, [couponApplied]);

  async function handlePay() {
    // Beta coupon — bypass Stripe entirely
    if (couponApplied) {
      onPay("beta-free");
      return;
    }

    if (!stripe || !clientSecret || !cardElementRef.current) {
      setError("Payment not ready. Please wait a moment and try again.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElementRef.current,
            billing_details: { name, email },
          },
        }
      );

      if (stripeErr) {
        setError(stripeErr.message);
        setLoading(false);
        return;
      }

      onPay(paymentIntent.id);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={S.center}>
      <div style={{ ...S.container, maxWidth: 480 }} className="fadein">
        <div style={S.wwk}>Women Who Know</div>
        <h2 style={S.h2}>Secure your spot.</h2>

        {/* Coupon field */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Coupon code</label>
            <input
              style={{ ...S.input, ...(couponApplied ? { borderColor: COLORS.teal, background: COLORS.tealPale } : {}) }}
              value={coupon}
              onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); setError(""); }}
              placeholder="Have a code?"
              disabled={couponApplied}
            />
          </div>
          {!couponApplied && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                style={{ ...S.btn, width: "auto", marginTop: 0, padding: "16px 24px", fontSize: 11 }}
                onClick={handleCouponApply}
                disabled={!coupon.trim()}
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {couponApplied && (
          <div style={{ padding: "16px 20px", background: COLORS.tealPale, borderLeft: `3px solid ${COLORS.teal}`, marginBottom: 28 }}>
            <p style={{ ...S.body, textAlign: "left", margin: 0, fontSize: 14, color: COLORS.teal, fontWeight: 400 }}>
              ✓ Beta access applied — your report is complimentary.
            </p>
          </div>
        )}

        {!couponApplied && (
          <>
            <div style={S.payBox}>
              <div style={S.payAmount}>${PRICE} CAD</div>
              <div style={S.payNote}>Your card is authorized now and charged only when your report is ready — within one business day.</div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Card details</label>
              <div
                ref={cardRef}
                style={{ ...S.input, padding: "18px", minHeight: 56, display: "flex", alignItems: "center" }}
              />
            </div>
            {!clientSecret && !error && (
              <p style={{ ...S.fine, marginBottom: 16 }}>Setting up secure payment…</p>
            )}
          </>
        )}

        {error && <p style={S.err}>{error}</p>}

        <button
          style={{ ...S.btn, opacity: loading || (!couponApplied && !clientSecret) ? 0.6 : 1 }}
          onClick={handlePay}
          disabled={loading || (!couponApplied && !clientSecret)}
        >
          {loading ? "Authorizing…" : couponApplied ? "Begin Assessment →" : "Authorize & Begin Assessment →"}
        </button>
        <p style={S.fine}>
          {couponApplied
            ? "Beta access. Your report will be delivered within one business day."
            : "Secured by Stripe. 30-day money-back guarantee. One-time payment. No subscriptions."
          }
        </p>
      </div>
    </div>
  );
}

function Assessment({ q, currentQ, total, progress, answers, setAnswer, onNext, onBack, onChoiceSelect, canProceed, error, name }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const a = answers[q.id];
    if (typeof a === "string") setText(a);
    else setText("");
  }, [q.id]);

  const isLast = currentQ === total - 1;
  const firstName = name ? name.split(" ")[0] : "";

  function handleTextNext() {
    setAnswer(q.id, text);
    setTimeout(onNext, 50);
  }

  return (
    <div style={S.assessScreen}>
      {/* Header */}
      <div style={S.assessHeader}>
        <a href="https://women-who-know.github.io/wwk-landing/" style={{ ...S.wwkSm, textDecoration: "none" }}>WWK</a>
        <div style={S.progressWrap}>
          <div style={{ ...S.progressBar, width: `${progress}%` }} />
        </div>
        <div style={S.progressTxt}>{currentQ + 1}/{total}</div>
      </div>

      <div style={S.assessBody} className="fadein" key={q.id}>
        <h2 style={S.qText}>{q.question}</h2>

        {/* EMPLOYEES */}
        {q.type === "employees" && (
          <EmployeesInput value={answers[q.id] || {}} onChange={v => setAnswer(q.id, v)} options={q.options} structureOptions={q.structureOptions} />
        )}

        {/* INDUSTRY */}
        {q.type === "industry" && (
          <IndustryInput value={answers[q.id] || {}} onChange={v => setAnswer(q.id, v)} hint={q.hint} />
        )}

        {/* OFFERS */}
        {q.type === "offers" && (
          <OffersInput value={answers[q.id] || {}} onChange={v => setAnswer(q.id, v)} options={q.options} hint={q.hint} />
        )}

        {/* REVENUE */}
        {q.type === "revenue" && (
          <RevenueInput value={answers[q.id] || {}} onChange={v => { setAnswer(q.id, v); if (v.range && v.consistency) { setTimeout(() => { setError(""); if (currentQ < TOTAL - 1) setCurrentQ(c => c + 1); else handleGenerate(); }, 350); } }} options={q.options} consistencyOptions={q.consistencyOptions} />
        )}

        {/* SOURCE */}
        {q.type === "source" && (
          <SourceInput value={answers[q.id] || {}} onChange={v => setAnswer(q.id, v)} options={q.options} dataOptions={q.dataOptions} />
        )}

        {/* SENTENCE COMPLETION */}
        {q.type === "sentence" && (
          <div>
            <div style={S.stemRow}>
              <span style={S.stem}>{q.stem}</span>
              <input
                style={{ ...S.input, flex: 1, marginBottom: 0 }}
                value={text}
                onChange={e => { setText(e.target.value); setAnswer(q.id, e.target.value); }}
                placeholder={q.placeholder}
              />
            </div>
            {q.hint && <p style={S.hint}>{q.hint}</p>}
          </div>
        )}

        {/* CHOICE */}
        {q.type === "choice" && (
          <div style={S.choices}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                style={{ ...S.choice, ...(answers[q.id] === opt ? S.choiceSelected : {}) }}
                onClick={() => onChoiceSelect(opt)}
                className="choice"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* TEXTAREA */}
        {q.type === "textarea" && (
          <div>
            <textarea
              style={S.textarea}
              value={text}
              onChange={e => { setText(e.target.value); setAnswer(q.id, e.target.value); }}
              placeholder={q.placeholder}
              rows={5}
            />
            {q.hint && <p style={S.hint}>{q.hint}</p>}
          </div>
        )}

        {error && <p style={S.err}>{error}</p>}

        {/* Nav — not shown for choice type (auto-advances) */}
        {q.type !== "choice" && (
          <div style={S.nav}>
            {currentQ > 0 && (
              <button style={S.backBtn} onClick={onBack}>← Back</button>
            )}
            <button
              style={{ ...S.btn, opacity: canProceed() ? 1 : 0.4, marginTop: 0 }}
              onClick={handleTextNext}
              className="btn"
            >
              {isLast ? "Generate My Report →" : "Next →"}
            </button>
          </div>
        )}
        {q.type === "choice" && currentQ > 0 && (
          <button style={{ ...S.backBtn, marginTop: 16 }} onClick={onBack}>← Back</button>
        )}
      </div>
    </div>
  );
}

// ---- Sub-inputs ----

function IndustryInput({ value, onChange, hint }) {
  return (
    <div>
      <div style={S.field}>
        <label style={S.label}>Select your primary sector</label>
        <select
          style={S.select}
          value={value.sector || ""}
          onChange={e => onChange({ ...value, sector: e.target.value })}
        >
          <option value="">— Select —</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div style={S.field}>
        <label style={S.label}>Now get specific — what's your niche within that sector?</label>
        <input
          style={S.input}
          value={value.niche || ""}
          onChange={e => onChange({ ...value, niche: e.target.value })}
          placeholder="e.g. Business coaching for female founders hitting an income plateau"
        />
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

function EmployeesInput({ value, onChange, options, structureOptions }) {
  return (
    <div>
      <div style={S.choices}>
        {options.map(opt => (
          <button
            key={opt}
            style={{ ...S.choice, ...(value.count === opt ? S.choiceSelected : {}) }}
            onClick={() => onChange({ ...value, count: opt })}
            className="choice"
          >
            {opt}
          </button>
        ))}
      </div>
      {value.count && value.count !== "Just me" && (
        <div style={{ marginTop: 28 }}>
          <label style={S.label}>How are they structured?</label>
          <div style={{ ...S.choices, marginTop: 12 }}>
            {structureOptions.map(opt => (
              <button
                key={opt}
                style={{ ...S.choice, ...(value.structure === opt ? S.choiceSelected : {}) }}
                onClick={() => onChange({ ...value, structure: opt })}
                className="choice"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OffersInput({ value, onChange, options, hint }) {
  return (
    <div>
      <div style={S.choices}>
        {options.map(opt => (
          <button
            key={opt}
            style={{ ...S.choice, ...(value.count === opt ? S.choiceSelected : {}) }}
            onClick={() => onChange({ ...value, count: opt })}
            className="choice"
          >
            {opt}
          </button>
        ))}
      </div>
      <div style={{ ...S.field, marginTop: 24 }}>
        <label style={S.label}>Which one generates the most income?</label>
        <input style={S.input} value={value.income || ""} onChange={e => onChange({ ...value, income: e.target.value })} placeholder="My highest income offer is..." />
      </div>
      <div style={S.field}>
        <label style={S.label}>Which one generates the most profit — after your time and costs, what actually puts the most in your pocket?</label>
        <input style={S.input} value={value.profit || ""} onChange={e => onChange({ ...value, profit: e.target.value })} placeholder="My most profitable offer is..." />
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

function RevenueInput({ value, onChange, options, consistencyOptions }) {
  return (
    <div>
      <div style={S.choices}>
        {options.map(opt => (
          <button
            key={opt}
            style={{ ...S.choice, ...(value.range === opt ? S.choiceSelected : {}) }}
            onClick={() => onChange({ ...value, range: opt })}
            className="choice"
          >
            {opt}
          </button>
        ))}
      </div>
      {value.range && (
        <div style={{ marginTop: 28 }}>
          <p style={{ ...S.label, marginBottom: 16 }}>Is this consistent month to month, or does it fluctuate significantly?</p>
          <div style={S.choices}>
            {consistencyOptions.map(opt => (
              <button
                key={opt}
                style={{ ...S.choice, ...(value.consistency === opt ? S.choiceSelected : {}) }}
                onClick={() => onChange({ ...value, consistency: opt })}
                className="choice"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceInput({ value, onChange, options, dataOptions }) {
  return (
    <div>
      <div style={S.choices}>
        {options.map(opt => (
          <button
            key={opt}
            style={{ ...S.choice, ...(value.source === opt ? S.choiceSelected : {}) }}
            onClick={() => onChange({ ...value, source: opt })}
            className="choice"
          >
            {opt}
          </button>
        ))}
      </div>
      {value.source && (
        <div style={{ marginTop: 28 }}>
          <label style={S.label}>If I asked you to show me the data you...</label>
          <select
            style={{ ...S.select, marginTop: 8 }}
            value={value.data || ""}
            onChange={e => onChange({ ...value, data: e.target.value })}
          >
            <option value="">— Select —</option>
            {dataOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function Generating({ name }) {
  const [phase, setPhase] = useState(0);
  const [dots, setDots] = useState(".");
  const phases = [
    "Reading your answers...",
    "Running your benchmark comparison...",
    "Identifying your patterns...",
    "Writing your report...",
    "Almost ready...",
  ];

  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? "." : p + "."), 500);
    const p = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 2200);
    return () => { clearInterval(d); clearInterval(p); };
  }, []);

  return (
    <div style={S.center}>
      <div style={{ ...S.container, maxWidth: 480, textAlign: "center" }} className="fadein">
        <div style={S.wwk}>Women Who Know</div>
        <div style={S.spinner} />
        <h2 style={S.h2}>{phases[phase]}{dots}</h2>
        <p style={S.body}>
          {name ? `${name.split(" ")[0]}, your` : "Your"} personalised Founder Benchmark Report is being written specifically for you. This takes about 30 seconds.
        </p>
      </div>
    </div>
  );
}

function Report({ name, sections, scores, rawReport }) {
  const firstName = name ? name.split(" ")[0] : "Founder";

  function download() {
    const blob = new Blob([rawReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WWK-Founder-Assessment-${name.replace(/\s+/g, "-")}.txt`;
    a.click();
  }

  return (
    <div style={S.reportWrap}>
      <div style={S.reportHeader}>
        <div style={S.wwkSm}>Women Who Know</div>
        <h1 style={S.reportH1}>{firstName}'s Founder Benchmark Report</h1>
        <p style={S.reportSub}>Clear, Worthy, Wealthy · Personalized Diagnostic</p>
      </div>

      {(scores.CLEAR || scores.WORTHY || scores.WEALTHY) && (
        <div style={S.scoreRow}>
          {[["CLEAR", "Positioning & Clarity"], ["WORTHY", "Pricing & Self-Worth"], ["WEALTHY", "Operations & Scale"]].map(([p, d]) => (
            <div key={p} style={S.scoreCard}>
              <div style={{ ...S.scoreNum, color: COLORS[p] }}>
                {scores[p] ?? "—"}<span style={S.scoreOf}>/10</span>
              </div>
              <div style={{ ...S.scorePillar, color: COLORS[p] }}>{p}</div>
              <div style={S.scoreSub}>{d}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.reportBody}>
        {sections.map((sec, i) => (
          <div key={i} style={S.reportSection}>
            <h2 style={S.secTitle}>{sec.title}</h2>
            {sec.content.split("\n\n").map((p, j) => (
              <p key={j} style={S.reportP}>{p}</p>
            ))}
          </div>
        ))}
        {sections.length === 0 && rawReport && (
          <div style={S.reportSection}>
            {rawReport.split("\n\n").map((p, j) => (
              <p key={j} style={S.reportP}>{p}</p>
            ))}
          </div>
        )}
      </div>

      <div style={S.cta}>
        <h2 style={S.ctaH}>The Reset Point</h2>
        <p style={S.ctaP}>
          A 90-minute diagnostic session with Anitta. She reads your business, identifies the exact moves, 
          and delivers a fully executable written plan. Plus a 30-minute follow-up call at 30 days.
        </p>
        <p style={S.ctaP}>
          Spots are currently closed. Join the waitlist and you'll be contacted when the next batch opens — first come, first served.
        </p>
        <a href="https://womenwhoknow.ca/reset-point-waitlist" style={S.waitlistBtn} className="btn">
          Join the Reset Point Waitlist →
        </a>
      </div>

      <div style={S.reportFooter}>
        <button style={S.dlBtn} onClick={download} className="btn">
          Download Your Report
        </button>
        <p style={S.fine}>Women Who Know · womenwhoknow.ca · © {new Date().getFullYear()} Anitta Hamming</p>
      </div>
    </div>
  );
}

// ============================================================
// DESIGN SYSTEM
// ============================================================

const COLORS = {
  CLEAR: "#B8956A",
  WORTHY: "#2B9BAA",
  WEALTHY: "#1C1A17",
  gold: "#B8956A",
  dark: "#1C1A17",
  bg: "#F7F4EF",
  white: "#FFFFFF",
  muted: "#8A837A",
  border: "#E0D8CC",
  teal: "#2B9BAA",
  tealDark: "#1E7A88",
  tealPale: "#EAF6F8",
  inkLight: "#4A4540",
};

const S = {
  // ── Nav ──────────────────────────────────────────────
  topNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 56px",
    height: 68,
    background: COLORS.white,
    borderBottom: "1px solid rgba(184,149,106,0.2)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  navLogo: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: COLORS.gold,
    textDecoration: "none",
  },
  navBtn: {
    background: COLORS.teal,
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textDecoration: "none",
    padding: "12px 24px",
    border: "none",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  // ── App shell ─────────────────────────────────────────
  app: {
    fontFamily: "'DM Sans', sans-serif",
    minHeight: "100vh",
    background: COLORS.white,
    color: COLORS.dark,
  },
  // ── Centered wrapper for Details / Payment ────────────
  center: {
    minHeight: "calc(100vh - 68px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "72px 24px",
    background: COLORS.white,
  },
  container: {
    width: "100%",
  },
  // ── Brand label ───────────────────────────────────────
  wwk: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.2em",
    color: COLORS.teal,
    textTransform: "uppercase",
    marginBottom: 32,
  },
  wwkSm: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.2em",
    color: COLORS.teal,
    textTransform: "uppercase",
  },
  // ── Typography ────────────────────────────────────────
  h1: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "clamp(40px, 6vw, 68px)",
    fontWeight: 300,
    lineHeight: 1.08,
    color: COLORS.dark,
    marginBottom: 28,
  },
  h2: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "clamp(30px, 4vw, 48px)",
    fontWeight: 300,
    lineHeight: 1.15,
    color: COLORS.dark,
    marginBottom: 20,
  },
  lead: {
    fontSize: 18,
    fontWeight: 300,
    color: COLORS.inkLight,
    lineHeight: 1.65,
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: 300,
    color: COLORS.inkLight,
    lineHeight: 1.8,
    marginBottom: 16,
  },
  // ── Landing pillars ───────────────────────────────────
  pillars: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    margin: "40px 0 48px",
  },
  pillar: {
    border: "1px solid " + COLORS.border,
    padding: "14px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 140,
  },
  pillarLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  pillarSub: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: 300,
  },
  // ── Buttons ───────────────────────────────────────────
  btn: {
    display: "block",
    width: "100%",
    background: COLORS.teal,
    color: COLORS.white,
    border: "none",
    padding: "20px 32px",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    marginTop: 32,
    textAlign: "center",
    transition: "background 0.2s ease",
  },
  fine: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 16,
    lineHeight: 1.7,
  },
  // ── Form fields ───────────────────────────────────────
  field: {
    marginBottom: 28,
  },
  label: {
    display: "block",
    fontSize: 10,
    letterSpacing: "0.14em",
    color: COLORS.teal,
    marginBottom: 10,
    textTransform: "uppercase",
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    border: "1px solid " + COLORS.border,
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    background: COLORS.white,
    color: COLORS.dark,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "16px 18px",
    border: "1px solid " + COLORS.border,
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    background: COLORS.white,
    color: COLORS.dark,
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A837A' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 18px center",
    boxSizing: "border-box",
  },
  // ── Payment ───────────────────────────────────────────
  payBox: {
    borderTop: "1px solid " + COLORS.border,
    borderBottom: "1px solid " + COLORS.border,
    padding: "32px 0",
    margin: "32px 0",
  },
  payAmount: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 64,
    fontWeight: 300,
    color: COLORS.dark,
    lineHeight: 1,
  },
  payNote: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 10,
    lineHeight: 1.65,
    fontWeight: 300,
  },
  err: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 12,
    padding: "12px 16px",
    background: "#fdf0ef",
    border: "1px solid #f5c6c2",
  },
  // ── Assessment screen ─────────────────────────────────
  assessScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: COLORS.white,
  },
  assessHeader: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "0 56px",
    height: 68,
    borderBottom: "1px solid " + COLORS.border,
    background: COLORS.white,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  progressWrap: {
    flex: 1,
    height: 2,
    background: COLORS.border,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: COLORS.teal,
    transition: "width 0.4s ease",
  },
  progressTxt: {
    fontSize: 11,
    color: COLORS.muted,
    whiteSpace: "nowrap",
    letterSpacing: "0.05em",
    fontWeight: 400,
  },
  assessBody: {
    flex: 1,
    maxWidth: 680,
    width: "100%",
    margin: "0 auto",
    padding: "72px 32px 96px",
  },
  qText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "clamp(26px, 4vw, 40px)",
    fontWeight: 300,
    lineHeight: 1.2,
    color: COLORS.dark,
    marginBottom: 36,
  },
  hint: {
    fontSize: 13,
    color: COLORS.muted,
    fontStyle: "italic",
    fontWeight: 300,
    lineHeight: 1.65,
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid " + COLORS.border,
  },
  textarea: {
    width: "100%",
    padding: "18px",
    border: "1px solid " + COLORS.border,
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    lineHeight: 1.75,
    color: COLORS.dark,
    background: COLORS.white,
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  },
  choices: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  choice: {
    border: "1px solid " + COLORS.border,
    padding: "18px 22px",
    textAlign: "left",
    background: COLORS.white,
    cursor: "pointer",
    fontSize: 15,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    color: COLORS.dark,
    lineHeight: 1.5,
    transition: "all 0.15s ease",
  },
  choiceSelected: {
    borderColor: COLORS.teal,
    background: COLORS.tealPale,
    color: COLORS.dark,
  },
  stemRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  stem: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 22,
    fontWeight: 400,
    color: COLORS.dark,
    whiteSpace: "nowrap",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginTop: 36,
    flexWrap: "wrap",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: COLORS.muted,
    fontSize: 13,
    cursor: "pointer",
    padding: "10px 0",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.05em",
  },
  // ── Generating / spinner ──────────────────────────────
  spinner: {
    width: 40,
    height: 40,
    border: "2px solid " + COLORS.border,
    borderTopColor: COLORS.teal,
    borderRadius: "50%",
    animation: "spin 0.9s linear infinite",
    margin: "0 auto 40px",
  },
  // ── Report ────────────────────────────────────────────
  reportWrap: {
    background: COLORS.white,
    minHeight: "100vh",
    maxWidth: 800,
    margin: "0 auto",
    padding: "80px 40px 120px",
  },
  reportHeader: {
    marginBottom: 72,
    paddingBottom: 56,
    borderBottom: "1px solid " + COLORS.border,
  },
  reportH1: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "clamp(32px, 5vw, 56px)",
    fontWeight: 300,
    color: COLORS.dark,
    lineHeight: 1.1,
    marginBottom: 16,
    marginTop: 20,
  },
  reportSub: {
    fontSize: 10,
    letterSpacing: "0.2em",
    color: COLORS.teal,
    textTransform: "uppercase",
    fontWeight: 500,
  },
  scoreRow: {
    display: "flex",
    gap: 2,
    marginBottom: 72,
    marginTop: 48,
  },
  scoreCard: {
    flex: 1,
    background: COLORS.bg,
    padding: "36px 12px",
    textAlign: "center",
  },
  scoreNum: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 56,
    fontWeight: 300,
    lineHeight: 1,
  },
  scoreOf: {
    fontSize: 22,
    fontWeight: 300,
  },
  scorePillar: {
    fontSize: 9,
    letterSpacing: "0.2em",
    fontWeight: 600,
    marginTop: 12,
    textTransform: "uppercase",
  },
  scoreSub: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
  },
  reportBody: {
    marginBottom: 72,
  },
  reportSection: {
    marginBottom: 64,
    paddingBottom: 64,
    borderBottom: "1px solid " + COLORS.border,
  },
  secTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 32,
    fontWeight: 300,
    color: COLORS.dark,
    marginBottom: 24,
    lineHeight: 1.2,
  },
  reportP: {
    fontSize: 16,
    fontWeight: 300,
    lineHeight: 1.9,
    color: COLORS.inkLight,
    marginBottom: 20,
  },
  // ── End CTA (dark section) ────────────────────────────
  cta: {
    background: COLORS.dark,
    color: COLORS.white,
    padding: "72px 56px",
    marginBottom: 72,
  },
  ctaH: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 44,
    fontWeight: 300,
    color: COLORS.white,
    marginBottom: 24,
    lineHeight: 1.1,
  },
  ctaP: {
    fontSize: 16,
    fontWeight: 300,
    lineHeight: 1.8,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 16,
    maxWidth: 520,
  },
  waitlistBtn: {
    display: "inline-block",
    marginTop: 32,
    background: COLORS.teal,
    color: COLORS.white,
    padding: "16px 36px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    letterSpacing: 0.3,
    textDecoration: "none",
    borderRadius: 2,
    cursor: "pointer",
  },
  reportFooter: {
    textAlign: "center",
  },
  dlBtn: {
    background: "none",
    border: "1px solid " + COLORS.dark,
    color: COLORS.dark,
    padding: "14px 32px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 400,
    cursor: "pointer",
    borderRadius: 2,
    letterSpacing: 0.3,
    marginBottom: 24,
    transition: "all 0.2s ease",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F4F0E8; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .fadein { animation: fadein 0.45s ease forwards; }
  .btn:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.12); }
  .btn:active { transform: translateY(0); }
  .choice:hover { border-color: #B8956A !important; background: rgba(184,149,106,0.07) !important; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: #B8956A !important; }
`;
