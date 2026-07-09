// OWNER: Hemant | MODULE: Super Admin Dashboard
import Link from "next/link";
import { IndianRupee, CalendarDays, Users, UserCog, Building2 } from "lucide-react";
import { HeroBanner, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";

const branches = [
  { name: "Bandra", city: "Mumbai", revenue: "₹12.6L", bookings: 742, rating: 4.8, trend: 72 },
  { name: "Koramangala", city: "Bengaluru", revenue: "₹10.9L", bookings: 690, rating: 4.7, trend: 63 },
  { name: "Banjara Hills", city: "Hyderabad", revenue: "₹8.4L", bookings: 512, rating: 4.9, trend: 55 },
  { name: "CP", city: "Delhi", revenue: "₹9.7L", bookings: 604, rating: 4.6, trend: 60 },
];

export default function SuperAdminDashboardPage() {
  return (
    <>
      <HeroBanner
        eyebrow="Platform · July 2026"
        title="Global"
        highlight="Overview"
        subtitle="Performance across all Renzo branches, in real time."
        stats={[
          { label: "Revenue", value: "₹41.6L" },
          { label: "Bookings", value: "2,548" },
          { label: "Customers", value: "9.1K" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value="₹41.6L" delta={{ value: "11%", positive: true }} hint="MTD" icon={IndianRupee} />
        <StatCard label="Total Bookings" value="2,548" delta={{ value: "7%", positive: true }} icon={CalendarDays} />
        <StatCard label="Active Customers" value="9,120" delta={{ value: "4%", positive: true }} icon={Users} />
        <StatCard label="Staff" value="118" hint="4 branches" icon={UserCog} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Comparison</CardTitle>
          <Link href="/super-admin/branches" className="text-xs font-medium text-primary hover:underline">All branches →</Link>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {branches.map((b) => (
            <Link key={b.name} href="/super-admin/branches/br_1" className="border border-border p-4 hover:bg-muted/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="font-medium">{b.name}</span>
                </div>
                <Badge tone="neutral">★ {b.rating}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{b.city}</p>
              <p className="mt-4 font-heading text-2xl font-semibold tabular-nums">{b.revenue}</p>
              <p className="text-xs text-muted-foreground">{b.bookings} bookings</p>
              <div className="mt-3 h-1.5 w-full bg-muted"><div className="h-full bg-primary" style={{ width: `${b.trend}%` }} /></div>
            </Link>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
