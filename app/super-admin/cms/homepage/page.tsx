// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS
// ROUTE  : /super-admin/cms/homepage
//
// ACCESS : SUPER_ADMIN. The segment layout already gates this, and the guard is
//          repeated here so the page is safe on its own. The API it reads from
//          re-checks the role again — the UI never grants access, it only
//          reflects it.
//
// DATA   : fetched through the API with the caller's cookie (lib/api-server), not
//          through Prisma, so the same RBAC that protects the endpoint protects
//          this page. The editor receives it as initial state, so there is no
//          loading flash and no second round trip on mount.
// ============================================================================

import { redirect } from "next/navigation";

import { Card, CardBody } from "@/components/shared/ui";
import { HomepageCmsEditor, type HomepageCmsData } from "@/components/super-admin/homepage-cms-editor";
import { apiGet } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { getServerUser } from "@/lib/server-session";
import type { MediaItem } from "@/lib/cms/schema";

// The draft changes whenever an author saves, so this page is never cached.
export const dynamic = "force-dynamic";

export default async function HomepageCmsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [cms, media] = await Promise.all([
    apiGet<HomepageCmsData>(API.admin.cmsHomepage),
    apiGet<{ items: MediaItem[] }>(`${API.admin.cmsMedia}?includeDeleted=true`),
  ]);

  if (!cms.ok) {
    return (
      <Card>
        <CardBody className="space-y-1">
          <p className="text-sm font-medium text-gray-900">The Homepage CMS could not be loaded.</p>
          <p className="text-sm text-gray-500">{cms.message}</p>
        </CardBody>
      </Card>
    );
  }

  // The media library is a convenience, not a prerequisite: if only that call
  // fails the editor still opens, just with an empty library.
  return <HomepageCmsEditor initialData={cms.data} initialMedia={media.ok ? media.data.items : []} />;
}
