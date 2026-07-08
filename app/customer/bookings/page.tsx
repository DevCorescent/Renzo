import Link from "next/link";
import { CalendarDays, MapPin, User, Clock, ArrowRight, Scissors } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card, StatusBadge } from "@/components/customer/ui";
import { BOOKINGS, rupee } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Bookings — history list (hardcoded)
export default function CustomerBookingsPage() {
  const upcoming = BOOKINGS.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING");
  const past = BOOKINGS.filter((b) => b.status === "COMPLETED" || b.status === "CANCELLED");

  return (
    <div>
      <PageHeader
        title="My Bookings"
        description="Track upcoming appointments and revisit your history."
        action={
          <Link href="/book" className={cn(buttonVariants())}>
            <Scissors className="size-4" />
            New Booking
          </Link>
        }
      />

      <Section title="Upcoming" bookings={upcoming} empty="No upcoming appointments." />
      <div className="mt-10">
        <Section title="Past" bookings={past} empty="No past appointments yet." />
      </div>
    </div>
  );
}

function Section({
  title,
  bookings,
  empty,
}: {
  title: string;
  bookings: typeof BOOKINGS;
  empty: string;
}) {
  return (
    <div>
      <h2 className="mb-4 font-heading text-xl font-semibold">{title}</h2>
      {bookings.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{empty}</Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-col overflow-hidden sm:flex-row">
              <img src={b.image} alt={b.service} className="h-36 w-full object-cover sm:h-auto sm:w-40" />
              <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-heading text-lg font-semibold">{b.service}</h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="size-4 text-primary" /> {b.stylist}</span>
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary" /> {b.date} · {b.time}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" /> {b.branch}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" /> {b.duration}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <span className="font-heading text-lg font-semibold">{rupee(b.price)}</span>
                  <Link href={`/customer/bookings/${b.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Details <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
