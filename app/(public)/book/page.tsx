import prisma from "@/lib/db";
import { BookWizard } from "./book-wizard";
import type { PreloadedBranch, PreloadedService } from "./book-wizard";

// Server Component — pre-loads branch + service from DB using URL params so the
// client wizard starts at the right step with zero loading flash.

export const metadata = { title: "Book an Appointment — Renzo" };

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; serviceId?: string }>;
}) {
  const { branchId, serviceId } = await searchParams;

  let branch: PreloadedBranch | null = null;
  let service: PreloadedService | null = null;

  if (branchId) {
    const raw = await prisma.branch.findFirst({
      where: { id: branchId, isActive: true, isPublic: true },
      select: { id: true, name: true, slug: true, city: true, address: true, coverImage: true },
    });
    if (raw) branch = raw;
  }

  if (serviceId && branch) {
    const raw = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: {
        id: true, name: true, image: true, duration: true, gender: true, basePrice: true,
        category: { select: { name: true } },
        branchPricings: {
          where: { branchId: branch.id, isActive: true },
          select: { price: true },
        },
      },
    });
    if (raw) {
      service = {
        id: raw.id, name: raw.name, image: raw.image,
        duration: raw.duration, gender: raw.gender, basePrice: raw.basePrice,
        category: raw.category,
        price: raw.branchPricings[0]?.price ?? raw.basePrice,
      };
    }
  }

  return <BookWizard initialBranch={branch} initialService={service} />;
}
