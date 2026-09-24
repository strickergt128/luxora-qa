import { sendEmail } from "../services/email/emailService.js";

const escapeHtml = (str = "") =>
  String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const submitContact = async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      subject = "",
      message = "",
      orderId = "",
    } = req.body || {};

    // Basic validation
    if (!name.trim())
      return res.status(400).json({ message: "Name is required" });
    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: "Enter a valid email" });
    if (!subject.trim())
      return res.status(400).json({ message: "Subject is required" });
    if (!message.trim())
      return res.status(400).json({ message: "Message is required" });

    const baseUrl = (
      process.env.FRONTEND_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");
    const to = process.env.SUPPORT_EMAIL || "support@luxora.com";

    // Build simple HTML
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
        <h2 style="margin:0 0 8px 0;">New Contact Request</h2>
        <p style="margin:0 0 12px 0;color:#6b7280;">Submitted from ${baseUrl}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${
          orderId
            ? `<p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>`
            : ""
        }
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space:pre-wrap;border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#f9fafb;color:#374151;">
          ${escapeHtml(message)}
        </div>
      </div>
    `;

    // Prepare attachments (images only, already filtered by multer)
    const attachments =
      (req.files || []).map((f) => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      })) || [];

    const mailSubject = `[Contact] ${subject} — ${name} <${email}>`;

    await sendEmail({
      to,
      subject: mailSubject,
      html,
      replyTo: email,
      attachments,
    });

    res.json({ message: "Message sent" });
  } catch (err) {
    console.error("Contact submit error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
};
