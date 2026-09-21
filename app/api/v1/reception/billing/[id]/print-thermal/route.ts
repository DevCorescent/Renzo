import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
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
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER",
    "ACCOUNTANT"
  );
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;
    const invoice = await loadInvoiceForDelivery(id);
    if (!invoice) return err("Invoice not found", 404);

    // Same rule as /send and /reprint: another branch's invoice answers 404, so a
    // branch-scoped account can neither print it nor learn that it exists.
    if (!scope.isGlobal && invoice.branchId !== scope.branchId) {
      return err("Invoice not found", 404);
    }

    const url = new URL(req.url);
    const mmParam = url.searchParams.get("mm");
    // 58mm roll: printable width ~48mm; 80mm roll: ~72mm. Default to 80.
    const mm = mmParam === "58" ? 58 : 80;
    const contentMm = mm === 58 ? 48 : 72;

    // ?scale=150 prints the text 1.5× larger (50–200, default 100). The roll width
    // is unchanged — lines just wrap sooner — and the page height the script below
    // measures still follows the content, so nothing needs Chrome's Scale setting.
    const scaleParam = Number(url.searchParams.get("scale") ?? "100");
    const scale =
      Number.isFinite(scaleParam) && scaleParam >= 50 && scaleParam <= 200
        ? Math.round(scaleParam)
        : 100;
    const pt = (base: number) => `${((base * scale) / 100).toFixed(2)}pt`;

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

    const bizName = d.businessName || d.branch || "Renzo";

    const discountRow =
      d.discount > 0
        ? `<tr><td class="lbl">Discount</td><td class="val">- ${esc(inr(d.discount))}</td></tr>`
        : "";

    const taxRow =
      d.tax > 0
        ? `<tr><td class="lbl">${esc(d.taxName || "Tax")}</td><td class="val">${esc(inr(d.tax))}</td></tr>`
        : "";

    const balanceRow =
      d.balance > 0
        ? `<tr><td class="lbl bal">Balance due</td><td class="val bal">${esc(inr(d.balance))}</td></tr>`
        : "";

    const paymentRows = (d.payments && d.payments.length > 0)
      ? d.payments.map(p => `<tr><td class="lbl">Paid (${esc(p.method)})</td><td class="val">${esc(inr(p.amount))}</td></tr>`).join("")
      : (d.paid > 0 ? `<tr><td class="lbl">Paid</td><td class="val">${esc(inr(d.paid))}</td></tr>` : "");

    const phoneLine = d.customerPhone
      ? `<p class="center small">${esc(d.customerPhone)}</p>`
      : "";

    const addressLine = d.address ? `<p class="center small">${esc(d.address)}</p>` : "";
    const contactLine =
      d.phone || d.email
        ? `<p class="center small">${esc([d.phone, d.email].filter(Boolean).join(" | "))}</p>`
        : "";
    const gstLine = d.taxNumber ? `<p class="center small">GST: ${esc(d.taxNumber)}</p>` : "";
    const websiteLine = `<p class="center small">${esc(d.website || "renzosalon.com")}</p>`;
    const footerNote = d.footerNote || "Thank you for visiting!";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${esc(d.invoiceNo)} — ${esc(bizName)}</title>
<style>
  /* Fallback only — the script at the bottom replaces it with the receipt's exact
     height before printing. It must be a valid two-length size: "${mm}mm auto" is
     invalid CSS, so Chrome dropped it and defaulted to A4 at "fit" scale, which is
     why staff had to pick the paper size and scale by hand on every print. */
  @page {
    size: ${mm}mm 297mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: ${pt(10)};
    /* Full roll width with the unprintable edge as padding, so the page box and
       the paper match exactly and Chrome has nothing to scale. */
    width: ${mm}mm;
    padding: 2mm ${(mm - contentMm) / 2}mm;
    color: #000;
    background: #fff;
  }
  h1 { font-size: ${pt(13)}; font-weight: bold; text-align: center; margin-bottom: 2px; }
  p { line-height: 1.4; }
  .center { text-align: center; }
  .small { font-size: ${pt(8.5)}; }
  .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  .item-name { padding: 1px 0; }
  .item-amt  { padding: 1px 0; text-align: right; white-space: nowrap; padding-left: 4px; }
  .lbl { padding: 1px 0; color: #444; }
  .val { padding: 1px 0; text-align: right; white-space: nowrap; }
  .total-row td { font-weight: bold; font-size: ${pt(11)}; padding-top: 3px; }
  .bal { color: #b00; }
  @media print {
    html, body { width: ${mm}mm; }
  }
</style>
</head>
<body>
  <h1>${esc(bizName)}</h1>
  ${d.tagline ? `<p class="center small">${esc(d.tagline)}</p>` : ""}
  ${addressLine}
  ${contactLine}
  ${gstLine}
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
      ${paymentRows}
      ${balanceRow}
    </tbody>
  </table>
  <hr class="dash">
  <p class="center small">${esc(footerNote)}</p>
  ${websiteLine}

<script>
  (function () {
    // Size the page to the receipt itself — roll width by measured height — so
    // Chrome selects this paper at 100% scale: no A4 default, no "fit to page"
    // shrink, and no metre of blank roll after a short bill.
    function printReceipt() {
      var heightMm = Math.ceil((document.body.getBoundingClientRect().height * 25.4) / 96) + 2;
      var style = document.createElement("style");
      style.textContent = "@page { size: ${mm}mm " + heightMm + "mm; margin: 0; }";
      document.head.appendChild(style);
      window.print();
    }
    window.addEventListener("afterprint", function () { window.close(); });
    window.addEventListener("load", function () {
      // Measure after fonts settle, or the height is taken from fallback metrics.
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(printReceipt, printReceipt);
    });
  })();
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
