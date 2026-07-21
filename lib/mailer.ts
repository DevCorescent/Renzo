import nodemailer from "nodemailer";

// Singleton transporter — reused across requests in the same Node process.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true, // SSL on port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
};

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.warn("[Mailer] SMTP_USER not set — skipping email to", payload.to);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      ...payload,
    });
  } catch (err) {
    // Never crash the caller — log and move on.
    console.error("[Mailer] Failed to send email to", payload.to, err);
  }
}
