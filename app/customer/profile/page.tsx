import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer — Profile

export default async function CustomerProfilePage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
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
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["First Name", customer.firstName],
              ["Last Name", customer.lastName ?? "—"],
              ["Phone", customer.user.phone ?? "—"],
              ["Email", customer.user.email ?? "—"],
              ["Gender", customer.gender ?? "—"],
              ["Date of Birth", customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString("en-IN") : "—"],
              ["Anniversary", customer.anniversary ? new Date(customer.anniversary).toLocaleDateString("en-IN") : "—"],
              ["Member Since", new Date(customer.user.createdAt).toLocaleDateString("en-IN")],
              ["Referral Code", customer.referralCode],
              ["Total Visits", customer.totalVisits.toString()],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded border border-gray-100 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                <dd className="mt-1 text-sm text-gray-800">{String(value)}</dd>
              </div>
            ))}
          </dl>

          {customer.tagAssignments.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {customer.tagAssignments.map((t) => (
                  <Badge key={t.id} tone="info" style={t.tag.color ? { backgroundColor: t.tag.color + "20", color: t.tag.color } : undefined}>
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {customer.beautyProfile && (
        <Card>
          <CardHeader><CardTitle>Beauty Profile</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Hair Type", customer.beautyProfile.hairType ?? "—"],
                ["Hair Color", customer.beautyProfile.hairColor ?? "—"],
                ["Skin Type", customer.beautyProfile.skinType ?? "—"],
                ["Skin Concerns", customer.beautyProfile.skinConcerns.join(", ") || "—"],
                ["Nail Preferences", customer.beautyProfile.nailPreferences ?? "—"],
                ["Allergies", customer.beautyProfile.allergies ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded border border-gray-100 p-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
                  <dd className="mt-1 text-sm text-gray-800">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {customer.beautyProfile.preferences && (
              <div className="mt-3 rounded border border-gray-100 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Preferences</dt>
                <dd className="mt-1 text-sm text-gray-700">{customer.beautyProfile.preferences}</dd>
              </div>
            )}
            {customer.beautyProfile.medicalNotes && (
              <div className="mt-3 rounded border border-yellow-100 bg-yellow-50 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-yellow-700">Medical Notes</dt>
                <dd className="mt-1 text-sm text-yellow-800">{customer.beautyProfile.medicalNotes}</dd>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
