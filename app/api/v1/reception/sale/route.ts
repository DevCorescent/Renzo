// ============================================================================
// MODULE : Billing — direct sale
// ROUTE  : /api/v1/reception/sale
//
// A direct product/service sale and a "blank bill" are THE SAME OPERATION: an
// invoice with no appointment behind it. This route therefore re-exports the
// blank-bill handler rather than carrying a second copy of the same invoice,
// stock and loyalty logic — two implementations is how one of them eventually
// stops deducting stock, or starts charging a different tax.
//
// The URL is kept because the Operations hub and the sale terminal link to it,
// and because "sale" is what the front desk calls it.
//
// PERMISSIONS follow the blank bill, which is the deliberate consequence of them
// being one operation: RECEPTIONIST needs `BranchSetting.allowReceptionBlankBill`
// to raise an invoice with no appointment. BRANCH_ADMIN, OWNER and SUPER_ADMIN
// always may.
// ============================================================================

export { POST } from "@/app/api/v1/reception/billing/blank/route";
