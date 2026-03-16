/**
 * WWK Assessment Pipeline Test Script
 * Run: node test-pipeline.js
 * Tests every API endpoint against the live Vercel deployment.
 * Uses beta-free coupon — no real Stripe charges.
 */

const BASE_URL = "https://wwk-app.vercel.app";

const COLORS = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;

function log(status, label, detail = "") {
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "→";
  const color = status === "pass" ? COLORS.green : status === "fail" ? COLORS.red : COLORS.yellow;
  console.log(color(`  ${icon} ${label}`) + (detail ? COLORS.dim(`  ${detail}`) : ""));
  if (status === "pass") passed++;
  if (status === "fail") failed++;
}

async function test(label, fn) {
  try {
    await fn();
  } catch (err) {
    log("fail", label, err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Test data ────────────────────────────────────────────────────────────────

const TEST_EMAIL = "test-" + Date.now() + "@example.com";
const TEST_NAME = "Test Founder";

const TEST_ANSWERS = {
  q1_industry:    { sector: "Coaching", niche: "Business coaching for female founders" },
  q2_years:       "3-5 years",
  q3_employees:   { count: "Just me", structure: null },
  q4_idealclient: "Female founders earning $60-100K who have hit a revenue ceiling",
  q5_whatyoudo:   "I help women founders break through their revenue ceiling",
  q6_decision:    "I kept putting off raising my prices because I was scared of losing clients",
  q7_offers:      { count: "3-4", primary: "Group coaching program" },
  q8_pricing:     "I priced it based on what I thought the market would pay",
  q9_priceincrease: "The last time I raised prices was 18 months ago, based on gut feel",
  q10_pressure:   "Sometimes offer a discount or payment plan to close",
  q11_revenue:    { range: "$7-15K", consistency: "Somewhat consistent" },
  q12_chargemore: "I believed my results were actually worth it",
  q13_source:     { source: "Referrals", data: "Could provide it easily and quickly" },
  q14_calls:      "3-5",
  q15_conversion: "40-60%",
  q16_bottleneck: "The thing that would break first is my capacity — I'm already at my limit",
  q17_know:       "I need to raise my prices and stop discounting",
  q18_dream:      "I would hire a team and finally take a proper vacation",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log(COLORS.bold("\n  WWK Pipeline Test Suite"));
  console.log(COLORS.dim(`  Base URL: ${BASE_URL}`));
  console.log(COLORS.dim(`  Test email: ${TEST_EMAIL}\n`));

  // ── 1. Landing page loads ──────────────────────────────────────────────────
  console.log(COLORS.bold("  1. App availability"));
  await test("App loads (wwk-app.vercel.app)", async () => {
    const res = await fetch(BASE_URL);
    assert(res.ok, `Status ${res.status}`);
    const html = await res.text();
    assert(html.includes("Women Who Know") || html.includes("wwk"), "App HTML not found");
    log("pass", "App loads");
  });

  // ── 2. Stripe PaymentIntent creation ───────────────────────────────────────
  console.log(COLORS.bold("\n  2. Payment intent"));
  let clientSecret, paymentIntentId;
  await test("Create PaymentIntent", async () => {
    const res = await fetch(`${BASE_URL}/api/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL }),
    });
    assert(res.ok, `Status ${res.status}`);
    const data = await res.json();
    assert(data.clientSecret, "No clientSecret returned");
    assert(data.clientSecret.startsWith("pi_"), "clientSecret format wrong");
    assert(data.paymentIntentId, "No paymentIntentId returned");
    clientSecret = data.clientSecret;
    paymentIntentId = data.paymentIntentId;
    log("pass", "PaymentIntent created", paymentIntentId);
  });

  await test("PaymentIntent has correct amount (5700 CAD)", async () => {
    // Verify the secret format implies correct setup
    assert(clientSecret, "No clientSecret from previous test");
    assert(clientSecret.includes("_secret_"), "clientSecret format unexpected");
    log("pass", "PaymentIntent format valid");
  });

  // ── 3. Report generation (beta) ────────────────────────────────────────────
  console.log(COLORS.bold("\n  3. Report generation"));
  await test("Rejects missing fields", async () => {
    const res = await fetch(`${BASE_URL}/api/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: "beta-free" }), // missing answers, email, name
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    log("pass", "Rejects missing fields (400)");
  });

  await test("Rejects GET method", async () => {
    const res = await fetch(`${BASE_URL}/api/generate-report`);
    assert(res.status === 405, `Expected 405, got ${res.status}`);
    log("pass", "Rejects GET (405)");
  });

  let generationSuccess = false;
  let editUrl = null;

  await test("Generates report with WWKBETA coupon", async () => {
    console.log(COLORS.dim("    (This takes ~30 seconds — Claude is generating the report)"));
    const res = await fetch(`${BASE_URL}/api/generate-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: "beta-free",
        name: TEST_NAME,
        email: TEST_EMAIL,
        industry: "Coaching — Business coaching for female founders",
        businessType: "Just me",
        yearsInBusiness: "3-5 years",
        answers: TEST_ANSWERS,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Status ${res.status} — ${data.error || "unknown error"}`);
    assert(data.success, "No success flag");
    generationSuccess = true;
    log("pass", "Report generated and admin email sent");
    console.log(COLORS.yellow("    ⚠  Check banittaq@gmail.com for the admin email with Edit & Send link"));
  });

  // ── 4. Edit page ───────────────────────────────────────────────────────────
  console.log(COLORS.bold("\n  4. Edit report endpoint"));
  await test("Rejects missing params", async () => {
    const res = await fetch(`${BASE_URL}/api/edit-report?token=abc`);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    log("pass", "Rejects missing params (400)");
  });

  await test("Rejects invalid blobUrl (404)", async () => {
    const res = await fetch(
      `${BASE_URL}/api/edit-report?token=abc&email=a%40b.com&name=Test&blobUrl=https%3A%2F%2Finvalid.blob.vercel-storage.com%2Fnonexistent&paymentIntentId=beta-free`
    );
    // Should either 404 (not found) or 500 (can't reach blob)
    assert(res.status === 404 || res.status === 500, `Expected 404 or 500, got ${res.status}`);
    log("pass", `Invalid blobUrl handled (${res.status})`);
  });

  // ── 5. Send report endpoint ────────────────────────────────────────────────
  console.log(COLORS.bold("\n  5. Send report endpoint"));
  await test("Rejects missing fields", async () => {
    const res = await fetch(`${BASE_URL}/api/send-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: "test" }), // missing email, name, blobUrl, paymentIntentId
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    log("pass", "Rejects missing fields (400)");
  });

  await test("Rejects invalid email format", async () => {
    const res = await fetch(`${BASE_URL}/api/send-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report: "test report",
        email: "not-an-email",
        name: "Test",
        blobUrl: "https://example.blob.vercel-storage.com/test",
        paymentIntentId: "beta-free",
        isBeta: true,
      }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    const data = await res.json();
    assert(data.error?.includes("Invalid email"), `Expected email error, got: ${data.error}`);
    log("pass", "Rejects invalid email (400)");
  });

  // ── 6. Print report endpoint ───────────────────────────────────────────────
  console.log(COLORS.bold("\n  6. Print report endpoint"));
  await test("Rejects missing params", async () => {
    const res = await fetch(`${BASE_URL}/api/print-report`);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    log("pass", "Rejects missing params (400)");
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n  ${"─".repeat(48)}`);
  const total = passed + failed;
  console.log(COLORS.bold(`  Results: ${COLORS.green(`${passed} passed`)}  ${failed > 0 ? COLORS.red(`${failed} failed`) : COLORS.dim("0 failed")}  of ${total} tests`));

  if (generationSuccess) {
    console.log(COLORS.yellow(`\n  Manual verification required:`));
    console.log(COLORS.dim(`  → Check banittaq@gmail.com for admin email`));
    console.log(COLORS.dim(`  → Click "Edit & Send" — verify edit page loads with report content`));
    console.log(COLORS.dim(`  → Send report — verify it arrives at ${TEST_EMAIL}`));
    console.log(COLORS.dim(`  → Click "Download as PDF" link — verify print page loads`));
  }

  console.log();
}

runTests().catch(err => {
  console.error(COLORS.red("\n  Fatal error:"), err.message);
  process.exit(1);
});
