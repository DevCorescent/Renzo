// Centralised HTML email templates for all transactional mails.
// All templates share the same gold-on-dark brand shell.

const BASE = (content: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Renzo Salon</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

          <!-- Header -->
          <tr>
            <td style="background:#111;padding:28px 36px;border-bottom:1px solid #2a2a2a;text-align:center;">
              <span style="font-size:26px;font-weight:700;letter-spacing:4px;color:#C8A96A;">RENZO</span>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:2px;color:#6b6b6b;text-transform:uppercase;">Luxury Hair &amp; Beauty Studio</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111;padding:20px 36px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;font-size:11px;color:#555;">© ${new Date().getFullYear()} Renzo Salon. All rights reserved.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#555;">12 Rosewood Avenue, Bandra West, Mumbai 400050 · hello@renzo.salon</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── OTP ─────────────────────────────────────────────────────────────────────

export function otpEmail(name: string, otp: string, purpose: string): { subject: string; html: string; text: string } {
  const reasonMap: Record<string, string> = {
    LOGIN: "sign in to your Renzo account",
    SIGNUP: "create your Renzo account",
    FORGOT_PASSWORD: "reset your Renzo password",
    PHONE_VERIFY: "verify your phone number",
    EMAIL_VERIFY: "verify your email address",
  };
  const reason = reasonMap[purpose] ?? "verify your identity";

  const html = BASE(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:600;">Your verification code</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#999;line-height:1.6;">Hi ${name || "there"}, use the code below to ${reason}. It expires in <strong style="color:#C8A96A;">5 minutes</strong>.</p>

    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:#111;border:1px solid #C8A96A;border-radius:12px;padding:20px 40px;">
        <span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#C8A96A;">${otp}</span>
      </div>
    </div>

    <p style="margin:0;font-size:12px;color:#666;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
  `);

  return {
    subject: `${otp} — Your Renzo verification code`,
    html,
    text: `Your Renzo OTP: ${otp}\n\nUse this to ${reason}. Expires in 5 minutes.\nIf you didn't request this, ignore this email.`,
  };
}

// ─── Booking Confirmation ────────────────────────────────────────────────────

type BookingEmailData = {
  name: string;
  appointmentNo: string;
  date: string;
  time: string;
  branch: string;
  worker?: string | null;
  services: string[];
  totalAmount: number;
};

export function bookingConfirmationEmail(data: BookingEmailData): { subject: string; html: string; text: string } {
  const serviceList = data.services
    .map((s) => `<li style="margin:4px 0;color:#ccc;font-size:14px;">${s}</li>`)
    .join("");

  const workerRow = data.worker
    ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Stylist</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.worker}</td></tr>`
    : "";

  const html = BASE(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#C8A96A20;border:1px solid #C8A96A40;border-radius:50%;padding:14px 18px;">
        <span style="font-size:28px;">✓</span>
      </div>
    </div>

    <h2 style="margin:0 0 6px;font-size:22px;color:#fff;font-weight:600;text-align:center;">Booking Confirmed!</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#999;text-align:center;">Hi ${data.name}, your appointment is all set. We look forward to seeing you!</p>

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Booking #</td>
          <td style="padding:8px 0;color:#C8A96A;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #2a2a2a;">${data.appointmentNo}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Date</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.date}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Time</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Branch</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.branch}</td>
        </tr>
        ${workerRow}
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Total</td>
          <td style="padding:8px 0;color:#C8A96A;font-size:15px;font-weight:700;text-align:right;">₹${data.totalAmount.toLocaleString("en-IN")}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Services</p>
      <ul style="margin:0;padding-left:20px;">${serviceList}</ul>
    </div>

    <p style="margin:0;font-size:12px;color:#666;text-align:center;">Need to reschedule? Log in to your account or call us at +91 98765 43210.</p>
  `);

  return {
    subject: `Booking Confirmed — ${data.appointmentNo} | Renzo Salon`,
    html,
    text: `Booking Confirmed!\n\nHi ${data.name},\n\nYour appointment at Renzo Salon is confirmed.\n\nBooking #: ${data.appointmentNo}\nDate: ${data.date}\nTime: ${data.time}\nBranch: ${data.branch}${data.worker ? `\nStylist: ${data.worker}` : ""}\nServices: ${data.services.join(", ")}\nTotal: ₹${data.totalAmount}\n\nSee you soon!`,
  };
}

// ─── Booking Cancellation ────────────────────────────────────────────────────

export function bookingCancellationEmail(data: { name: string; appointmentNo: string; date: string; branch: string }): { subject: string; html: string; text: string } {
  const html = BASE(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:600;">Booking Cancelled</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#999;line-height:1.6;">Hi ${data.name}, your appointment <strong style="color:#C8A96A;">${data.appointmentNo}</strong> on <strong style="color:#fff;">${data.date}</strong> at ${data.branch} has been cancelled.</p>

    <p style="margin:0 0 8px;font-size:14px;color:#ccc;line-height:1.6;">If this was a mistake or you'd like to rebook, please visit your account or call us at <strong style="color:#C8A96A;">+91 98765 43210</strong>.</p>
    <p style="margin:0;font-size:12px;color:#666;">Any payments will be refunded within 5–7 business days.</p>
  `);

  return {
    subject: `Booking Cancelled — ${data.appointmentNo} | Renzo Salon`,
    html,
    text: `Hi ${data.name},\n\nYour booking ${data.appointmentNo} on ${data.date} at ${data.branch} has been cancelled.\n\nTo rebook, visit our website or call +91 98765 43210.`,
  };
}

// ─── Appointment Reschedule ──────────────────────────────────────────────────

export function appointmentRescheduleEmail(data: {
  name: string;
  appointmentNo: string;
  date: string;
  time: string;
  branch: string;
}): { subject: string; html: string; text: string } {
  const html = BASE(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#C8A96A20;border:1px solid #C8A96A40;border-radius:50%;padding:14px 18px;">
        <span style="font-size:28px;">📅</span>
      </div>
    </div>

    <h2 style="margin:0 0 6px;font-size:22px;color:#fff;font-weight:600;text-align:center;">Appointment Rescheduled</h2>
    <p style="margin:0 0 28px;font-size:14px;color:#999;text-align:center;">Hi ${data.name}, your appointment has been updated to a new time.</p>

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Booking #</td>
          <td style="padding:8px 0;color:#C8A96A;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #2a2a2a;">${data.appointmentNo}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">New Date</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.date}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">New Time</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.time}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Branch</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${data.branch}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:12px;color:#666;text-align:center;">If you have any questions, log in to your account or call us at <strong style="color:#C8A96A;">+91 98765 43210</strong>.</p>
  `);

  return {
    subject: `Appointment Rescheduled — ${data.appointmentNo} | Renzo Salon`,
    html,
    text: `Hi ${data.name},\n\nYour appointment ${data.appointmentNo} has been rescheduled.\n\nNew Date: ${data.date}\nNew Time: ${data.time}\nBranch: ${data.branch}\n\nIf you have questions, call +91 98765 43210.`,
  };
}

// ─── Invoice / Receipt ───────────────────────────────────────────────────────

type InvoiceEmailData = {
  name: string;
  invoiceNo: string;
  date: string;
  branch: string;
  items: { label: string; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  method: string;
};

// Standalone light shell — only used for the invoice email so the dark shell
// used by OTP / booking / worker emails remains unchanged.
const INVOICE_SHELL = (body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Renzo — Payment Receipt</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">

        <!-- Rose accent bar -->
        <tr>
          <td style="background:#D4687A;height:5px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- Brand header -->
        <tr>
          <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #F0F0F0;">
            <div style="display:inline-block;width:48px;height:48px;border-radius:50%;border:2px solid #D4687A;line-height:48px;text-align:center;margin-bottom:10px;">
              <span style="font-size:20px;font-weight:700;color:#D4687A;vertical-align:middle;">R</span>
            </div>
            <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#18181B;">RENZO</div>
            <div style="font-size:10px;letter-spacing:2px;color:#71717A;text-transform:uppercase;margin-top:3px;">Hair &amp; Beauty Salon</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#FAFAFA;padding:20px 40px;border-top:1px solid #F0F0F0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#A1A1AA;">© ${new Date().getFullYear()} Renzo Salon · All rights reserved</p>
            <p style="margin:5px 0 0;font-size:11px;color:#A1A1AA;">hello@renzo.salon</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

export function invoiceEmail(data: InvoiceEmailData): { subject: string; html: string; text: string } {
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  const itemRows = data.items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:11px 0;font-size:13px;color:#3F3F46;border-bottom:1px solid #F0F0F0;">${item.label}</td>
        <td style="padding:11px 0;font-size:13px;color:#18181B;font-weight:500;text-align:right;border-bottom:1px solid #F0F0F0;">${inr(item.amount)}</td>
      </tr>`
    )
    .join("");

  const discountRow = data.discount > 0
    ? `<tr>
        <td style="padding:7px 0;font-size:13px;color:#71717A;">Discount</td>
        <td style="padding:7px 0;font-size:13px;color:#16A34A;text-align:right;">− ${inr(data.discount)}</td>
       </tr>`
    : "";

  const taxRow = data.tax > 0
    ? `<tr>
        <td style="padding:7px 0;font-size:13px;color:#71717A;">Tax</td>
        <td style="padding:7px 0;font-size:13px;color:#3F3F46;text-align:right;">${inr(data.tax)}</td>
       </tr>`
    : "";

  const balanceRow = data.balance > 0
    ? `<tr>
        <td style="padding:7px 0;font-size:13px;color:#DC2626;font-weight:600;">Balance Due</td>
        <td style="padding:7px 0;font-size:13px;color:#DC2626;font-weight:700;text-align:right;">${inr(data.balance)}</td>
       </tr>`
    : "";

  const fullyPaidBadge = data.balance === 0
    ? `<span style="display:inline-block;background:#DCFCE7;color:#15803D;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;letter-spacing:0.5px;">✓ Fully Paid</span>`
    : "";

  const body = `
    <!-- Greeting -->
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#18181B;">Payment Receipt</p>
    <p style="margin:0 0 24px;font-size:14px;color:#71717A;line-height:1.6;">
      Hi ${data.name}, your payment has been confirmed. ${fullyPaidBadge}
    </p>

    <!-- Invoice meta -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:10px 16px;background:#FBE8EC;border-radius:10px 10px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;font-weight:700;color:#D4687A;text-transform:uppercase;letter-spacing:1.2px;">Invoice No.</td>
              <td style="font-size:13px;font-weight:700;color:#18181B;text-align:right;">${data.invoiceNo}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 16px;background:#FFF5F7;border-radius:0 0 10px 10px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:9px 0;font-size:12px;color:#71717A;border-bottom:1px solid #F2E0E3;">Date</td>
              <td style="padding:9px 0;font-size:12px;color:#3F3F46;text-align:right;border-bottom:1px solid #F2E0E3;">${data.date}</td>
            </tr>
            <tr>
              <td style="padding:9px 0;font-size:12px;color:#71717A;">Branch</td>
              <td style="padding:9px 0;font-size:12px;color:#3F3F46;text-align:right;">${data.branch}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Items table -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#71717A;text-transform:uppercase;letter-spacing:1.2px;">Services</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${itemRows}
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E4E4E7;padding-top:4px;">
      <tr>
        <td style="padding:7px 0;font-size:13px;color:#71717A;">Sub-Total</td>
        <td style="padding:7px 0;font-size:13px;color:#3F3F46;text-align:right;">${inr(data.subtotal)}</td>
      </tr>
      ${discountRow}
      ${taxRow}
      <!-- Total row — highlighted -->
      <tr>
        <td colspan="2" style="padding:4px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBE8EC;border-radius:8px;">
            <tr>
              <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#D4687A;">Total</td>
              <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#D4687A;text-align:right;">${inr(data.total)}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:9px 0 4px;font-size:12px;color:#16A34A;">Paid via ${data.method}</td>
        <td style="padding:9px 0 4px;font-size:12px;font-weight:600;color:#16A34A;text-align:right;">${inr(data.paid)}</td>
      </tr>
      ${balanceRow}
    </table>

    <!-- Thank you note -->
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #F0F0F0;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#D4687A;">Thank You!</p>
      <p style="margin:6px 0 0;font-size:12px;color:#A1A1AA;">We look forward to seeing you again at Renzo.</p>
    </div>
  `;

  return {
    subject: `Receipt ${data.invoiceNo} — ${inr(data.total)} | Renzo Salon`,
    html: INVOICE_SHELL(body),
    text: `Payment Receipt\n\nHi ${data.name},\n\nInvoice: ${data.invoiceNo}\nDate: ${data.date}\nBranch: ${data.branch}\n\nServices:\n${data.items.map((i) => `${i.label}: ₹${i.amount}`).join("\n")}\n\nSub-Total: ₹${data.subtotal}${data.discount > 0 ? `\nDiscount: -₹${data.discount}` : ""}${data.tax > 0 ? `\nTax: ₹${data.tax}` : ""}\nTotal: ₹${data.total}\nPaid via ${data.method}: ₹${data.paid}\n${data.balance > 0 ? `Balance Due: ₹${data.balance}` : "Fully Paid ✓"}\n\nThank you for choosing Renzo Salon!`,
  };
}

// ─── Worker Welcome / Password ───────────────────────────────────────────────

export function workerWelcomeEmail(data: { name: string; email: string; password: string; branchName: string }): { subject: string; html: string; text: string } {
  const html = BASE(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:600;">Welcome to Renzo, ${data.name}!</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#999;line-height:1.6;">Your staff account has been created for <strong style="color:#C8A96A;">${data.branchName}</strong>. Use the credentials below to sign in.</p>

    <div style="background:#111;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid #2a2a2a;">Email</td>
          <td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid #2a2a2a;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Temporary Password</td>
          <td style="padding:8px 0;color:#C8A96A;font-size:14px;font-weight:700;font-family:monospace;text-align:right;">${data.password}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:12px;color:#666;">Please change your password after your first login. If you have questions, contact your branch manager.</p>
  `);

  return {
    subject: `Welcome to Renzo — Your Staff Account`,
    html,
    text: `Welcome to Renzo, ${data.name}!\n\nYour account for ${data.branchName} is ready.\n\nEmail: ${data.email}\nTemporary Password: ${data.password}\n\nPlease change your password after first login.`,
  };
}
