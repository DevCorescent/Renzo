// OWNER: Hemant | MODULE: Shift Scheduling — weekly grid
import { PageHeader, Card, CardHeader, CardTitle, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const workers = ["Priya Nair", "Arjun Singh", "Zoya Khan", "Rahul Verma", "Neha Gupta"];

// shift codes per worker per day
const M = "10–19", E = "12–21", O = "OFF", L = "LEAVE";
const roster: string[][] = [
  [M, M, M, M, M, M, O],
  [M, M, O, M, M, M, M],
  [E, E, E, E, O, E, E],
  [O, L, L, M, M, M, M],
  [E, E, E, O, E, E, E],
];

function tone(code: string) {
  if (code === O) return "bg-muted text-muted-foreground";
  if (code === L) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-primary/10 text-primary";
}

export default function BranchSchedulePage() {
  return (
    <>
      <PageHeader eyebrow="Week of 7 – 13 Jul" title="Shift Scheduler" subtitle="Assign weekly shifts for your team."
        actions={<><Button variant="outline" size="sm">Copy last week</Button><Button size="sm">Publish roster</Button></>} />

      <Card className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
            <div className="px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Stylist</div>
            {days.map((d) => <div key={d} className="border-l border-border px-2 py-3 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
          </div>
          {workers.map((w, wi) => (
            <div key={w} className="grid border-b border-border/70 last:border-0" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
              <div className="flex items-center px-4 py-3 text-sm font-medium">{w}</div>
              {roster[wi].map((code, di) => (
                <div key={di} className="border-l border-border/50 p-1.5">
                  <div className={`flex h-9 items-center justify-center text-[0.65rem] font-semibold ${tone(code)}`}>{code}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Badge tone="primary">Morning 10–19</Badge>
        <Badge tone="primary">Evening 12–21</Badge>
        <Badge tone="warning">Leave</Badge>
        <Badge tone="neutral">Off</Badge>
      </div>
    </>
  );
}
