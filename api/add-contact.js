import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Cache audience ID so we don't fetch it on every request
let audienceId = null;

async function getAudienceId() {
  if (audienceId) return audienceId;
  const { data, error } = await resend.audiences.list();
  if (error) throw new Error(`Could not fetch audiences: ${error.message}`);
  if (!data?.data?.length) throw new Error("No audiences found in Resend");
  audienceId = data.data[0].id;
  return audienceId;
}

export async function addContact({ email, firstName, lastName, tags }) {
  try {
    const id = await getAudienceId();
    const nameParts = (firstName || "").split(" ");
    await resend.contacts.create({
      audienceId: id,
      email,
      firstName: nameParts[0] || "",
      lastName: lastName || nameParts.slice(1).join(" ") || "",
      unsubscribed: false,
    });
  } catch (err) {
    // Non-fatal — log but don't break the main flow
    console.error("Failed to add contact to Resend audience:", err.message);
  }
}
