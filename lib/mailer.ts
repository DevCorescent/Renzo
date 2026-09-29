import nodemailer from "nodemailer";

const port = Number(process.env.SMTP_PORT ?? 465);

// Singleton transporter — reused across requests in the same Node process.
// 465 is implicit TLS; any other port (587) upgrades with STARTTLS. Timeouts keep
// a dead mail server from hanging a serverless request for minutes.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 30_000,
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

/** Why an email did not leave — `message` is safe to show the operator. */
export class MailError extends Error {
  constructor(
    message: string,
    readonly reason: "NOT_CONFIGURED" | "REJECTED" | "SEND_FAILED"
  ) {
    super(message);
    this.name = "MailError";
  }
}

/**
 * Send and REPORT the outcome: throws a MailError when email is not set up, the
 * mail server fails, or it refuses the recipient. Use it wherever the screen
 * tells someone an email was sent (invoices), so "sent" is never shown for a
 * message that never left.
 *
 * Note: an SMTP server accepting the message is as far as the server can see —
 * a receiving provider can still bounce it later (e.g. a sender domain with no
 * valid DNS).
 */
export async function sendMailChecked(payload: MailPayload): Promise<{ messageId: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new MailError("Email is not set up on the server (SMTP settings missing)", "NOT_CONFIGURED");
  }
  let info: Awaited<ReturnType<typeof transporter.sendMail>>;
  try {
    info = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      ...payload,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error";
    throw new MailError(`The mail server could not send the email (${detail})`, "SEND_FAILED");
  }
  if (Array.isArray(info.rejected) && info.rejected.length > 0) {
    throw new MailError(`The mail server refused the address ${payload.to}`, "REJECTED");
  }
  return { messageId: info.messageId };
}

/**
 * Fire-and-forget send for OTP / welcome / booking mail: never throws, so a mail
 * problem can never break the operation that triggered it. Same behaviour as
 * before; failures are logged.
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  try {
    await sendMailChecked(payload);
  } catch (err) {
    console.error("[Mailer] Failed to send email to", payload.to, err instanceof Error ? err.message : err);
  }
}
