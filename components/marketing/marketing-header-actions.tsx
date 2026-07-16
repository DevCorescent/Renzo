"use client";

// OWNER: Gauransh
// MODULE: Marketing — header actions
// PURPOSE: The Super Admin Marketing page's two primary actions — Add Campaign and
//          Add Coupon — as existing Button components. Each opens its create dialog,
//          which reuses the existing backend (POST /admin/campaigns and the shared
//          CouponFormDialog → POST /admin/coupons). On success it toasts and calls
//          router.refresh() so the page's server-rendered tables update in place —
//          no full reload, scroll and state preserved.
//   • Navigation flow: no navigation; both flows are in-page dialogs.
//   • Error handling: each dialog surfaces backend messages inline; this shell only
//     shows the success toast.
// Rendered only inside the SUPER_ADMIN-guarded page, so the actions are Super-Admin
// only by construction.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignFormDialog } from "./campaign-form-dialog";
import { CouponFormDialog } from "@/components/coupons/coupon-form-dialog";

export function MarketingHeaderActions() {
  const router = useRouter();
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [couponOpen, setCouponOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Refresh the server component (the Coupons/Campaigns tables) without a reload.
  const done = (message: string) => { setToast(message); router.refresh(); };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setCampaignOpen(true)}>
          <Plus aria-hidden="true" /> Add Campaign
        </Button>
        <Button type="button" onClick={() => setCouponOpen(true)}>
          <Plus aria-hidden="true" /> Add Coupon
        </Button>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-md">
          <Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <CampaignFormDialog open={campaignOpen} onClose={() => setCampaignOpen(false)} onCreated={(m) => { setCampaignOpen(false); done(m); }} />

      {/* Reuses the shared coupon dialog in create mode — no duplicate create logic. */}
      {couponOpen && (
        <CouponFormDialog mode="create" coupon={null} onClose={() => setCouponOpen(false)} onSaved={(m) => { setCouponOpen(false); done(m); }} />
      )}
    </>
  );
}
