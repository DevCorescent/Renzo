// OWNER: Hemant | MODULE: Queue Management — live salon queue
import { PageHeader, Card, CardHeader, CardTitle, Badge } from "@/components/shared/ui";

const columns = [
  {
    title: "Waiting",
    tone: "warning" as const,
    people: [
      { name: "Ritika Sharma", service: "Haircut & Style", wait: "8m", worker: "Priya N." },
      { name: "Aisha Khan", service: "Manicure", wait: "3m", worker: "Any" },
      { name: "Pooja Reddy", service: "Threading", wait: "1m", worker: "Zoya K." },
    ],
  },
  {
    title: "In Service",
    tone: "info" as const,
    people: [
      { name: "Sneha Kapoor", service: "Balayage", wait: "42m elapsed", worker: "Priya N." },
      { name: "Karan Malhotra", service: "Haircut", wait: "12m elapsed", worker: "Arjun S." },
    ],
  },
  {
    title: "Done · To Bill",
    tone: "success" as const,
    people: [
      { name: "Farah Ali", service: "Pedicure", wait: "ready", worker: "Zoya K." },
    ],
  },
];

export default function QueuePage() {
  return (
    <>
      <PageHeader eyebrow="Live · auto-refreshing" title="Queue" subtitle="Bandra branch — real-time floor status." />

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <Card key={col.title} className="bg-muted/30">
            <CardHeader className="bg-card">
              <CardTitle>{col.title}</CardTitle>
              <Badge tone={col.tone}>{col.people.length}</Badge>
            </CardHeader>
            <div className="space-y-3 p-3">
              {col.people.map((p, i) => (
                <div key={i} className="border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{p.name}</p>
                    <span className="text-xs text-muted-foreground tabular-nums">{p.wait}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.service}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{p.worker}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
