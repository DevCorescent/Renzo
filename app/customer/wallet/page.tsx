import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { WALLET, rupee } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Wallet (hardcoded)
export default function CustomerWalletPage() {
  return (
    <div>
      <PageHeader title="Wallet" description="Your Renzo balance and transaction history." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance card */}
        <Card className="bg-primary p-7 text-primary-foreground lg:col-span-1">
          <div className="flex items-center gap-2 text-primary-foreground/70">
            <Wallet className="size-5" />
            <span className="text-xs uppercase tracking-widest">Available balance</span>
          </div>
          <p className="mt-4 font-heading text-5xl font-bold">{rupee(WALLET.balance)}</p>
          <button className={cn(buttonVariants({ variant: "secondary" }), "mt-8 w-full bg-background text-foreground hover:bg-background/90")}>
            <Plus className="size-4" /> Add Money
          </button>
          <div className="mt-4 flex items-center gap-2 text-xs text-primary-foreground/60">
            <CreditCard className="size-4" /> UPI · Card · Net Banking
          </div>
        </Card>

        {/* Transactions */}
        <Card className="lg:col-span-2">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-heading text-lg font-semibold">Recent transactions</h2>
          </div>
          <ul className="divide-y divide-border">
            {WALLET.transactions.map((t) => {
              const credit = t.type === "CREDIT";
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex size-10 items-center justify-center",
                        credit ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {credit ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                  <span className={cn("font-heading text-base font-semibold", credit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                    {credit ? "+" : "−"}{rupee(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
