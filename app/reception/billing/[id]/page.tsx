// OWNER: Hemant | MODULE: POS Billing — invoice, payment methods, accept payment
import Link from "next/link";
import { ArrowLeft, Banknote, CreditCard, Smartphone, Wallet, Gift } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const lineItems = [
  { name: "Balayage", by: "Priya N.", qty: 1, price: 4500 },
  { name: "Gloss Treatment", by: "Priya N.", qty: 1, price: 1800 },
  { name: "Argan Hair Serum", by: "Retail", qty: 1, price: 900 },
];

const methods = [
  { name: "Cash", icon: Banknote },
  { name: "Card", icon: CreditCard },
  { name: "UPI", icon: Smartphone },
  { name: "Wallet", icon: Wallet },
  { name: "Gift Card", icon: Gift },
];

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default async function POSBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = lineItems.reduce((a, b) => a + b.price * b.qty, 0);
  const discount = 1260; // Gold 20% on services
  const tax = Math.round((sub - discount) * 0.18);
  const total = sub - discount + tax;

  return (
    <>
      <Link href="/reception/billing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to billing
      </Link>

      <PageHeader eyebrow={`Invoice · ${id}`} title="Sneha Kapoor" subtitle="Today · 12:05 PM · Bandra Branch" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <div className="p-0">
              {lineItems.map((l, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
                  <div className="flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.by}</p>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">×{l.qty}</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{inr(l.price * l.qty)}</span>
                </div>
              ))}
              <div className="space-y-2 px-5 py-4 text-sm">
                <Row label="Subtotal" value={inr(sub)} />
                <Row label="Membership discount (Gold 20%)" value={"– " + inr(discount)} muted />
                <Row label="GST (18%)" value={inr(tax)} />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Payable</span>
                  <span className="font-heading text-2xl font-semibold tabular-nums">{inr(total)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {methods.map((m, i) => (
                  <button key={m.name} className={`flex flex-col items-center gap-1.5 border py-3 text-xs font-medium ${i === 2 ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                    <m.icon className="size-5" />
                    {m.name}
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount received</span>
                <input defaultValue={inr(total)} className="w-full border border-input bg-transparent px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-ring" />
              </label>
              <Button className="w-full justify-center">Accept payment · {inr(total)}</Button>
              <Button variant="outline" className="w-full justify-center" size="sm">Print / email receipt</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "tabular-nums text-emerald-600 dark:text-emerald-500" : "font-medium tabular-nums"}>{value}</span>
    </div>
  );
}
