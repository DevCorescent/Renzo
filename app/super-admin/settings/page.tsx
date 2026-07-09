// OWNER: Hemant | MODULE: Platform Settings
import { PageHeader, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

function Toggle({ on }: { on?: boolean }) {
  return (
    <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`size-4 rounded-full bg-background transition-transform ${on ? "translate-x-4" : ""}`} />
    </span>
  );
}

function SettingRow({ label, hint, on }: { label: string; hint: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 py-4 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Toggle on={on} />
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Settings" subtitle="Global configuration for the Renzo platform."
        actions={<Button size="sm">Save changes</Button>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Business</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <Field label="Brand name" value="Renzo Salon & Spa" />
            <Field label="Support email" value="care@renzo.in" />
            <Field label="GST number" value="27ABCDE1234F1Z5" />
            <Field label="Default currency" value="INR (₹)" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Booking Rules</CardTitle></CardHeader>
          <CardBody className="py-0">
            <SettingRow label="Online booking" hint="Allow customers to book via website" on />
            <SettingRow label="Same-day booking" hint="Accept bookings for today" on />
            <SettingRow label="Auto-confirm" hint="Skip manual confirmation step" />
            <SettingRow label="Cancellation window" hint="Free cancel up to 4h before" on />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardBody className="py-0">
            <SettingRow label="WhatsApp reminders" hint="Send 24h & 2h before appointment" on />
            <SettingRow label="Email receipts" hint="Email invoice after payment" on />
            <SettingRow label="SMS OTP login" hint="Enable OTP-based login" on />
            <SettingRow label="Marketing opt-in default" hint="New customers opted in" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Loyalty & Payments</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <Field label="Points per ₹100 spent" value="5 pts" />
            <Field label="Point value" value="₹0.50 / pt" />
            <Field label="Payment gateway" value="Razorpay" />
            <Field label="Wallet top-up" value="Enabled" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input defaultValue={value} className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
    </label>
  );
}
