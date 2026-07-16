import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { SettingsForm } from "@/components/settings/settings-form";

// OWNER: Hemant | MODULE: Super Admin — Settings
//
// FLOW   : Guard the route (SUPER_ADMIN only), then hand off to the client form which
//          fetches GET /admin/settings, tracks dirty state and saves via PATCH.
// ACCESS : SUPER_ADMIN only — any other role is redirected here and refused by the
//          API too. proxy.ts gates /super-admin/*; this is the second line.
// BACKEND: GET + PATCH /api/v1/admin/settings (existing PlatformConfig singleton).

export default async function SuperAdminSettingsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Platform configuration</p>
      </div>

      <SettingsForm />
    </div>
  );
}
