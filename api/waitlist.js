import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, name } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email required." });
  }

  try {
    // Notify Anitta
    await resend.emails.send({
      from: "WWK System <hello@womenwhoknow.ca>",
      to: "hello@womenwhoknow.ca",
      subject: `Reset Point Waitlist — ${name || email}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;padding:40px 24px;">
          <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#B8956A;margin-bottom:16px;">Women Who Know</p>
          <h2 style="font-weight:300;font-size:24px;color:#1C1A17;margin-bottom:16px;">New Reset Point waitlist signup</h2>
          <p style="font-size:15px;color:#4A4540;"><strong>Name:</strong> ${name || "Not provided"}</p>
          <p style="font-size:15px;color:#4A4540;"><strong>Email:</strong> ${email}</p>
        </div>
      `,
    });

    // Confirm to the founder who signed up
    await resend.emails.send({
      from: "Anitta Hamming <hello@womenwhoknow.ca>",
      to: email,
      subject: "You're on the list — The Reset Point",
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#ffffff;">
          <div style="background:#1C1A17;padding:36px 48px;text-align:center;">
            <div style="font-size:10px;letter-spacing:7px;text-transform:uppercase;color:#B8956A;">Women Who Know</div>
          </div>
          <div style="padding:48px;color:#1C1A17;line-height:1.85;">
            <h1 style="font-weight:300;font-size:32px;margin:0 0 24px;">You're on the list.</h1>
            <p style="font-size:16px;margin-bottom:18px;">The Reset Point is a 90-minute diagnostic session — one founder, one problem, one clear path forward.</p>
            <p style="font-size:16px;margin-bottom:18px;">When a spot opens, you'll hear from me directly.</p>
            <p style="font-size:16px;margin-bottom:0;">— Anitta</p>
          </div>
          <div style="padding:24px 48px;text-align:center;color:#999;font-family:sans-serif;font-size:12px;border-top:1px solid #E0D8CC;">
            Women Who Know &middot; womenwhoknow.ca
          </div>
        </div>
      `,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Waitlist error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
