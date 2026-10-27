// ============================================================================
// OWNER  : Gauransh
// MODULE : Appointments — one service, several people
//
// A group at the desk ("Ram and Shyam, a haircut each") is ONE appointment with
// one AppointmentService row PER PERSON. The rows stay separate on purpose: each
// person has their own stylist, status and Sheet credit.
//
// Quantity is therefore not stored — it is derived here, for the two places that
// want the grouped view:
//   • invoice lines  — "Haircut × 2 @ ₹500 = ₹1,000" (amount = price × quantity)
//   • the store view — "Haircut ×2, Facial" so the desk sees how many people need
//                      each service
//
// Rows are grouped only when service, variant AND price all match, so two rows of
// the same service at different prices stay separate lines.
// ============================================================================

import { round2 } from "@/lib/billing-service";

type ServiceInstance = {
  serviceId: string;
  variantId?: string | null;
  price: number;
  service: { name: string };
};

export type GroupedServiceLine = {
  type: "SERVICE";
  refId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

/** One invoice line per service + variant + price, quantity = number of people. */
export function groupServiceLines(services: ServiceInstance[]): GroupedServiceLine[] {
  const lines = new Map<string, GroupedServiceLine>();
  for (const s of services) {
    const key = `${s.serviceId}|${s.variantId ?? ""}|${s.price}`;
    const line = lines.get(key);
    if (line) {
      line.quantity += 1;
      line.total = round2(line.unitPrice * line.quantity);
    } else {
      lines.set(key, {
        type: "SERVICE",
        refId: s.serviceId,
        name: s.service.name,
        quantity: 1,
        unitPrice: s.price,
        total: s.price,
      });
    }
  }
  return [...lines.values()];
}

/**
 * How many people need each service, and who is doing it, in first-seen order:
 *   "Haircut ×2 (Farhan, Riyaz), Facial (Sana)"   — two stylists
 *   "Haircut ×2 (Farhan ×2)"                      — one stylist does both
 *   "Haircut ×2 (Farhan, unassigned)"             — one still to assign
 * Without any stylist assigned it is just "Haircut ×2, Facial".
 */
export function serviceSummary(
  services: { service: { name: string }; worker?: { firstName: string } | null }[]
): string {
  const byService = new Map<string, (string | null)[]>();
  for (const s of services) {
    const people = byService.get(s.service.name) ?? [];
    people.push(s.worker?.firstName?.trim() || null);
    byService.set(s.service.name, people);
  }
  return [...byService]
    .map(([name, people]) => {
      const label = people.length > 1 ? `${name} ×${people.length}` : name;
      if (!people.some(Boolean)) return label;
      const counts = new Map<string, number>();
      for (const p of people) counts.set(p ?? "unassigned", (counts.get(p ?? "unassigned") ?? 0) + 1);
      const staff = [...counts].map(([who, n]) => (n > 1 ? `${who} ×${n}` : who)).join(", ");
      return `${label} (${staff})`;
    })
    .join(", ");
}

/** True when any service is booked for more than one person. */
export function hasRepeatedService(serviceIds: string[]): boolean {
  return new Set(serviceIds).size < serviceIds.length;
}
