// OWNER: Hemant | MODULE: Worker Leaves — balance, apply form, history
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const history = [
  { type: "Casual Leave", from: "12 Jun", to: "13 Jun", days: 2, status: "Approved", tone: "success" as const },
  { type: "Sick Leave", from: "28 May", to: "28 May", days: 1, status: "Approved", tone: "success" as const },
  { type: "Casual Leave", from: "15 Jul", to: "16 Jul", days: 2, status: "Pending", tone: "warning" as const },
  { type: "Earned Leave", from: "2 Apr", to: "6 Apr", days: 5, status: "Rejected", tone: "danger" as const },
];

export default function WorkerLeavesPage() {
  return (
    <>
      <PageHeader eyebrow="Time Off" title="Leaves" subtitle="Check your balance and request time off." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Casual Leave" value="6" hint="of 12 · remaining" />
        <StatCard label="Sick Leave" value="4" hint="of 8 · remaining" />
        <StatCard label="Earned Leave" value="9" hint="of 15 · remaining" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Apply for Leave</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
              <select className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring">
                <option>Casual Leave</option>
                <option>Sick Leave</option>
                <option>Earned Leave</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</span>
                <input type="date" className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</span>
                <input type="date" className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</span>
              <textarea rows={3} className="w-full resize-none border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
            </label>
            <Button className="w-full justify-center">Submit request</Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Leave History</CardTitle></CardHeader>
          <Table>
            <THead>
              <tr><TH>Type</TH><TH>From</TH><TH>To</TH><TH>Days</TH><TH>Status</TH></tr>
            </THead>
            <tbody>
              {history.map((r, i) => (
                <TR key={i}>
                  <TD className="font-medium">{r.type}</TD>
                  <TD className="tabular-nums">{r.from}</TD>
                  <TD className="tabular-nums">{r.to}</TD>
                  <TD className="tabular-nums">{r.days}</TD>
                  <TD><Badge tone={r.tone}>{r.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
