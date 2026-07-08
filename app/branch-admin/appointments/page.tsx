// OWNER: Hemant | MODULE: Branch Appointment Calendar (day / worker-wise grid)
import { PageHeader, Card, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const hours = ["9", "10", "11", "12", "1", "2", "3", "4", "5"];
const workers = ["Priya N.", "Arjun S.", "Zoya K.", "Rahul V."];

// [workerIndex][col] -> appointment spanning `span` hours
type Block = { col: number; span: number; label: string; sub: string; tone: string };
const grid: Block[][] = [
  [ { col: 1, span: 2, label: "Sneha K.", sub: "Balayage", tone: "bg-sky-500/15 border-sky-500/40" }, { col: 5, span: 1, label: "Ritika S.", sub: "Haircut", tone: "bg-emerald-500/15 border-emerald-500/40" } ],
  [ { col: 1, span: 1, label: "Karan M.", sub: "Haircut", tone: "bg-emerald-500/15 border-emerald-500/40" }, { col: 3, span: 2, label: "Aisha K.", sub: "Bridal Trial", tone: "bg-amber-500/15 border-amber-500/40" } ],
  [ { col: 2, span: 3, label: "Meera I.", sub: "Keratin", tone: "bg-fuchsia-500/15 border-fuchsia-500/40" } ],
  [ { col: 4, span: 2, label: "Pooja R.", sub: "Facial", tone: "bg-sky-500/15 border-sky-500/40" } ],
];

const views = ["Day", "Week", "Month", "Worker"];

export default function BranchAppointmentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bandra · Tue 8 Jul"
        title="Appointments"
        subtitle="Worker-wise day schedule."
        actions={
          <div className="flex border border-border">
            {views.map((v, i) => (
              <button key={v} className={i === 3 ? "bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground" : "px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted"}>{v}</button>
            ))}
          </div>
        }
      />

      <Card className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* header row */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `120px repeat(${hours.length}, 1fr)` }}>
            <div className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Stylist</div>
            {hours.map((h) => (
              <div key={h} className="border-l border-border px-2 py-2 text-center text-[0.65rem] font-semibold text-muted-foreground">{h}:00</div>
            ))}
          </div>
          {/* worker rows */}
          {workers.map((w, wi) => (
            <div key={w} className="grid border-b border-border/70 last:border-0" style={{ gridTemplateColumns: `120px repeat(${hours.length}, 1fr)` }}>
              <div className="flex items-center px-3 py-4 text-sm font-medium">{w}</div>
              <div className="relative col-span-9 grid" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                {hours.map((_, i) => <div key={i} className="h-16 border-l border-border/50" />)}
                {grid[wi]?.map((b, bi) => (
                  <div key={bi} className={`absolute top-1.5 bottom-1.5 border px-2 py-1 ${b.tone}`} style={{ left: `${((b.col - 1) / hours.length) * 100}%`, width: `${(b.span / hours.length) * 100}%` }}>
                    <p className="truncate text-xs font-semibold">{b.label}</p>
                    <p className="truncate text-[0.65rem] text-muted-foreground">{b.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Badge tone="info">Hair</Badge>
        <Badge tone="warning">Bridal</Badge>
        <Badge tone="success">Quick</Badge>
        <span>· 4 stylists · 12 appointments today</span>
      </div>
    </>
  );
}
