import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";
import { ProfileEditForm } from "./profile-edit-form";

export default async function CustomerProfilePage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");

  const customer = await prisma.customer.findUnique({
    where: { id: authUser.customerId },
    include: {
      beautyProfile: true,
      tagAssignments: { include: { tag: true } },
      user: { select: { email: true, phone: true, isVerified: true, createdAt: true } },
    },
  });
  if (!customer) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">My Profile</h1>
      </div>

      {/* Editable personal info */}
      <ProfileEditForm
        initial={{
          firstName:   customer.firstName,
          lastName:    customer.lastName ?? "",
          gender:      customer.gender ?? "",
          dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().split("T")[0] : "",
          anniversary: customer.anniversary ? customer.anniversary.toISOString().split("T")[0] : "",
        }}
      />

      {/* Read-only account info */}
      <div className="rounded-xl border border-white/8 bg-stone-900">
        <div className="border-b border-white/8 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-200">Account Details</h2>
        </div>
        <div className="p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {([
              ["Phone",        customer.user.phone ?? "—"],
              ["Email",        customer.user.email ?? "—"],
              ["Member Since", new Date(customer.user.createdAt).toLocaleDateString("en-IN")],
              ["Referral Code",customer.referralCode],
              ["Total Visits", customer.totalVisits.toString()],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/8 bg-stone-800/50 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
                <dd className="mt-1 text-sm text-stone-200">{value}</dd>
              </div>
            ))}
          </dl>

          {customer.tagAssignments.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Tags</p>
              <div className="flex flex-wrap gap-2">
                {customer.tagAssignments.map((t) => (
                  <Badge
                    key={t.id}
                    tone="info"
                    style={t.tag.color ? { backgroundColor: t.tag.color + "20", color: t.tag.color } : undefined}
                  >
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {customer.beautyProfile && (
        <div className="rounded-xl border border-white/8 bg-stone-900">
          <div className="border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-200">Beauty Profile</h2>
          </div>
          <div className="p-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              {([
                ["Hair Type",       customer.beautyProfile.hairType ?? "—"],
                ["Hair Color",      customer.beautyProfile.hairColor ?? "—"],
                ["Skin Type",       customer.beautyProfile.skinType ?? "—"],
                ["Skin Concerns",   customer.beautyProfile.skinConcerns.join(", ") || "—"],
                ["Nail Preferences",customer.beautyProfile.nailPreferences ?? "—"],
                ["Allergies",       customer.beautyProfile.allergies ?? "—"],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/8 bg-stone-800/50 p-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
                  <dd className="mt-1 text-sm text-stone-200">{value}</dd>
                </div>
              ))}
            </dl>
            {customer.beautyProfile.preferences && (
              <div className="mt-3 rounded-lg border border-white/8 bg-stone-800/50 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Preferences</dt>
                <dd className="mt-1 text-sm text-stone-300">{customer.beautyProfile.preferences}</dd>
              </div>
            )}
            {customer.beautyProfile.medicalNotes && (
              <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/8 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-yellow-400">Medical Notes</dt>
                <dd className="mt-1 text-sm text-yellow-300">{customer.beautyProfile.medicalNotes}</dd>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
