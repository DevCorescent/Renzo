import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { err } from "@/lib/response";
import { loadInvoiceForDelivery } from "@/lib/invoice-delivery";

// GET /api/v1/reception/billing/[id]/print-thermal?mm=80
//
// Returns an HTML page sized for a thermal receipt printer that auto-triggers
// window.print() on load. Chrome's PDF pipeline fails with non-standard paper
// sizes (80 mm, 58 mm) on thermal printers; an HTML page with the correct
// @page CSS avoids the PDF renderer entirely and prints directly via the OS
// print spooler.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER, ACCOUNTANT
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER",
    "ACCOUNTANT"
  );
  if (error) return error;

  try {
    const { id } = await params;
    const invoice = await loadInvoiceForDelivery(id);
    if (!invoice) return err("Invoice not found", 404);

    const url = new URL(req.url);
    const mmParam = url.searchParams.get("mm");
    // 58mm roll: printable width ~48mm; 80mm roll: ~72mm. Default to 80.
    const mm = mmParam === "58" ? 58 : 80;
    const contentMm = mm === 58 ? 48 : 72;

    const d = invoice.pdf;
    const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const itemRows = d.items
      .map((item) => {
        const label = esc(item.label);
        const amt = esc(inr(item.amount));
        return `<tr><td class="item-name">${label}</td><td class="item-amt">${amt}</td></tr>`;
      })
      .join("");

    const discountRow =
      d.discount > 0
        ? `<tr><td class="lbl">Discount</td><td class="val">- ${esc(inr(d.discount))}</td></tr>`
        : "";

    const taxRow =
      d.tax > 0
        ? `<tr><td class="lbl">Tax</td><td class="val">${esc(inr(d.tax))}</td></tr>`
        : "";

    const balanceRow =
      d.balance > 0
        ? `<tr><td class="lbl bal">Balance due</td><td class="val bal">${esc(inr(d.balance))}</td></tr>`
        : "";

    const methodLine =
      d.method
        ? `<p class="center small">Paid via ${esc(d.method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))}</p>`
        : "";

    const phoneLine = d.customerPhone
      ? `<p class="center small">${esc(d.customerPhone)}</p>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${esc(d.invoiceNo)}</title>
<style>
  @page {
    size: ${mm}mm auto;
    margin: 2mm 3mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 10pt;
    width: ${contentMm}mm;
    color: #000;
    background: #fff;
  }
  h1 { font-size: 13pt; font-weight: bold; text-align: center; margin-bottom: 2px; }
  p { line-height: 1.4; }
  .center { text-align: center; }
  .small { font-size: 8.5pt; }
  .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  .item-name { padding: 1px 0; }
  .item-amt  { padding: 1px 0; text-align: right; white-space: nowrap; padding-left: 4px; }
  .lbl { padding: 1px 0; color: #444; }
  .val { padding: 1px 0; text-align: right; white-space: nowrap; }
  .total-row td { font-weight: bold; font-size: 11pt; padding-top: 3px; }
  .bal { color: #b00; }
  @media print {
    html, body { width: ${contentMm}mm; }
  }
</style>
</head>
<body>
  <h1>${esc(d.branch || "Renzo")}</h1>
  <p class="center small">Invoice #${esc(d.invoiceNo)}</p>
  <p class="center small">${esc(d.date)}</p>
  <hr class="dash">
  <p class="center">${esc(d.customerName)}</p>
  ${phoneLine}
  <hr class="dash">
  <table>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="dash">
  <table>
    <tbody>
      <tr><td class="lbl">Subtotal</td><td class="val">${esc(inr(d.subtotal))}</td></tr>
      ${discountRow}
      ${taxRow}
      <tr class="total-row"><td class="lbl">TOTAL</td><td class="val">${esc(inr(d.total))}</td></tr>
      <tr><td class="lbl">Paid</td><td class="val">${esc(inr(d.paid))}</td></tr>
      ${balanceRow}
    </tbody>
  </table>
  ${methodLine}
  <hr class="dash">
  <p class="center small">Thank you for visiting!</p>
  <p class="center small">See you again soon.</p>

<script>
  window.addEventListener("load", function () {
    window.print();
    window.addEventListener("afterprint", function () { window.close(); });
  });
</script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("[print-thermal] Failed to generate receipt HTML:", e);
    return err("Failed to generate receipt", 500);
  }
}
