"use client";

import { MessageCircle } from "lucide-react";

export function SendReminderButton({
  phone,
  customerName,
  appointmentDate,
  startTime,
  services,
}: {
  phone: string;
  customerName: string;
  appointmentDate: Date;
  startTime: string;
  services: string;
}) {
  function open() {
    const dateStr = new Date(appointmentDate).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const msg = `Hi ${customerName},\n\nThis is a reminder for your appointment at our salon.\n\n📅 Date: ${dateStr}\n⏰ Time: ${startTime}\n💈 Services: ${services || "As booked"}\n\nWe look forward to seeing you! Please call us if you need to reschedule.`;
    const clean = phone.replace(/\D/g, "");
    const e164 = clean.startsWith("91") ? clean : `91${clean}`;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Send WhatsApp reminder"
      aria-label="Send WhatsApp reminder"
      className="inline-flex size-8 items-center justify-center rounded border border-green-200 text-green-600 transition hover:bg-green-50 hover:border-green-400 dark:border-green-500/30 dark:text-green-400 dark:hover:bg-green-500/10"
    >
      <MessageCircle className="size-4" aria-hidden="true" />
    </button>
  );
}
