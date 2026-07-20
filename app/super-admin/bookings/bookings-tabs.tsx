"use client";

import * as React from "react";
import { List, CalendarDays } from "lucide-react";
import { BookingsCalendar, type CalEvent } from "@/components/bookings/bookings-calendar";

// List/Calendar switcher for the super-admin bookings page. The table is
// server-rendered and passed in as children; the calendar is built here from
// the upcoming-events window.
export function BookingsTabs({
  events,
  children,
}: {
  events: CalEvent[];
  children: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<"list" | "calendar">("list");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        <button
          onClick={() => setTab("list")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "list" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <List className="size-4" /> List
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            tab === "calendar" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CalendarDays className="size-4" /> Calendar
        </button>
      </div>

      {tab === "list" ? children : <BookingsCalendar events={events} showBranch />}
    </div>
  );
}
