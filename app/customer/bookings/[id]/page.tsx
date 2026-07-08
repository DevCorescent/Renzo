import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  Scissors,
  CheckCircle2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, StatusBadge } from "@/components/customer/ui";
import { BOOKINGS, rupee } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Booking Detail (dynamic id param, hardcoded)
export default async function CustomerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = BOOKINGS.find((b) => b.id === id);
  if (!booking) notFound();

  const canManage = booking.status === "CONFIRMED" || booking.status === "PENDING";
  const timeline = [
    { label: "Booked", done: true },
    { label: "Confirmed", done: booking.status !== "PENDING" },
    { label: "Checked in", done: booking.status === "CHECKED_IN" || booking.status === "COMPLETED" },
    { label: "Completed", done: booking.status === "COMPLETED" },
  ];

  const gst = Math.round(booking.price * 0.18);

  return (
    <div>
      <Link
        href="/customer/bookings"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to bookings
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main detail */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <img src={booking.image} alt={booking.service} className="h-52 w-full object-cover" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Booking #{booking.id.replace("bk-", "")}
                  </p>
                  <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">{booking.service}</h1>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Detail icon={User} label="Stylist" value={booking.stylist} />
                <Detail icon={MapPin} label="Branch" value={booking.branch} />
                <Detail icon={CalendarDays} label="Date & time" value={`${booking.date} · ${booking.time}`} />
                <Detail icon={Clock} label="Duration" value={booking.duration} />
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <h2 className="mb-5 font-heading text-lg font-semibold">Status</h2>
            <ol className="flex items-center">
              {timeline.map((step, i) => (
                <li key={step.label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-full border",
                        step.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      <CheckCircle2 className="size-4.5" />
                    </span>
                    <span className={cn("text-xs", step.done ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {step.label}
                    </span>
                  </div>
                  {i < timeline.length - 1 && (
                    <div className={cn("mx-2 h-0.5 flex-1", step.done ? "bg-primary" : "bg-border")} />
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Summary + actions */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Payment summary</h2>
            <dl className="space-y-2.5 text-sm">
              <Row label="Service" value={rupee(booking.price)} />
              <Row label="GST (18%)" value={rupee(gst)} />
              <div className="my-2 border-t border-border" />
              <Row label="Total" value={rupee(booking.price + gst)} strong />
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Need help?</h2>
            <div className="space-y-3">
              {canManage ? (
                <>
                  <Link href={`/customer/bookings/${booking.id}`} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    Reschedule
                  </Link>
                  <Link href={`/customer/bookings/${booking.id}`} className={cn(buttonVariants({ variant: "destructive" }), "w-full")}>
                    Cancel booking
                  </Link>
                </>
              ) : (
                <Link href="/book" className={cn(buttonVariants(), "w-full")}>
                  <Scissors className="size-4" /> Book again
                </Link>
              )}
              <a href="tel:+919876543210" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
                <Phone className="size-4" /> Call the salon
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center bg-muted text-primary">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn("text-muted-foreground", strong && "font-semibold text-foreground")}>{label}</dt>
      <dd className={cn(strong ? "font-heading text-lg font-semibold" : "font-medium")}>{value}</dd>
    </div>
  );
}
